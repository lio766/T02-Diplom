import express from 'express';
import mysql from 'mysql2/promise'
import { authenticate } from './authenticate.js'
import { requireRole } from "./authorize.js";
import { sendMail } from './emailService.js'

const app = express()
const PORT = process.env.PORT || 3000

// Simple CORS for development (Vite runs on 5173)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    next()
})

app.use(express.json())

// DB config (defaults to MariaDB/MySQL on localhost:3306, root/root)
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'agora',
    connectionLimit: 10,
}

let pool;

async function initDb() {
    pool = mysql.createPool(DB_CONFIG)
}

async function checkDbConnection() {
    try {
        await pool.query('SELECT 1')
        console.log('DB connection OK ->', `${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`)
    } catch (err) {
        console.error('DB connection failed:', err.message)
        throw err
    }
}

// Helper: resolve Raum_Id by room name (Bezeichnung)
async function getRoomIdByName(name) {
    const [rows] = await pool.query('SELECT Raum_Id AS id FROM Raum WHERE Bezeichnung = ? LIMIT 1', [name])
    return rows.length ? rows[0].id : null
}

async function getRoomNameById(id) {
    const [rows] = await pool.query('SELECT Bezeichnung AS name FROM Raum WHERE Raum_Id = ? LIMIT 1', [id])
    return rows.length ? rows[0].name : null
}

// Helper: optional resolve Benutzer by "Vorname Nachname" string
async function findBenutzerByName(fullName) {
    if (!fullName) return null
    const parts = String(fullName).trim().split(/\s+/)
    let vor = parts[0] || ''
    let nach = parts.slice(1).join(' ') || ''
    const [rows] = await pool.query('SELECT Benutzer_Id AS id FROM Benutzer WHERE Vorname = ? AND Nachname = ? LIMIT 1', [vor, nach])
    if (rows.length) return rows[0].id
    // Fallback: try Vorname-only match
    if (vor && !nach) {
        const [rows2] = await pool.query('SELECT Benutzer_Id AS id FROM Benutzer WHERE Vorname = ? LIMIT 1', [vor])
        if (rows2.length) return rows2[0].id
    }
    return null
}

// Helper: check time conflict for a room
async function hasConflict(raumId, startTs, endTs) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM Buchungen WHERE Raum_Id = ? AND NOT (Endzeit <= ? OR Startzeit >= ?)',
        [raumId, startTs, endTs]
    )
    return rows[0].cnt > 0
}

async function hasConflictExcludingBooking(raumId, bookingId, startTs, endTs) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM Buchungen WHERE Raum_Id = ? AND Buchung_Id <> ? AND NOT (Endzeit <= ? OR Startzeit >= ?)',
        [raumId, bookingId, startTs, endTs]
    )
    return rows[0].cnt > 0
}

async function resolveUserIdsByEmails(emails) {
    const cleaned = Array.from(new Set(
        (emails || [])
            .map((e) => String(e || '').trim())
            .filter(Boolean)
            .map((e) => e.toLowerCase())
    ))
    if (!cleaned.length) return { users: [], unknown: [] }

    const placeholders = cleaned.map(() => '?').join(',')
    const [rows] = await pool.query(
        `SELECT Benutzer_Id AS id, Email AS email, Vorname AS vorname, Nachname AS nachname
		 FROM Benutzer
		 WHERE LOWER(Email) IN (${placeholders})`,
        cleaned
    )
    const byEmail = new Map(rows.map((u) => [String(u.email || '').toLowerCase(), u]))
    const unknown = cleaned.filter((e) => !byEmail.has(e))
    const users = cleaned.map((e) => byEmail.get(e)).filter(Boolean)
    return { users, unknown }
}

async function getBenutzerIdForRequestUser(user) {
    const email = String(user?.email || '').trim().toLowerCase()
    if (email) {
        const [rowsByEmail] = await pool.query(
            'SELECT Benutzer_Id AS id FROM Benutzer WHERE LOWER(Email) = ? LIMIT 1',
            [email]
        )
        if (rowsByEmail.length) return rowsByEmail[0].id
    }

    const keycloakId = String(user?.sub || '').trim()
    if (keycloakId) {
        const [rowsBySub] = await pool.query(
            'SELECT Benutzer_Id AS id FROM Benutzer WHERE Keycloak_Id = ? LIMIT 1',
            [keycloakId]
        )
        if (rowsBySub.length) return rowsBySub[0].id
    }

    return null
}

function parseParticipantsFromBody(body) {
    const b = body || {}
    const raw = b.participant_emails ?? b.participants_emails ?? b.participantsEmails ?? b.participants
    if (raw == null) return []
    if (Array.isArray(raw)) return raw
    return String(raw)
        .split(/[,;\n\r\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
}

// GET /bookings -> list bookings with room and optional person name
// List rooms
app.get('/api/rooms', authenticate, async (req, res) => {
    console.log('GET /rooms called')
    try {
        const [rows] = await pool.query('SELECT Raum_Id AS id, Bezeichnung AS name, Standort, Kapazitaet FROM Raum ORDER BY Bezeichnung ASC')
        res.json(rows)
    } catch (err) {
        console.error('GET /rooms error:', err)
        res.status(500).json({ error: 'Fehler beim Laden der Räume' })
    }
})

app.get('/api/me', authenticate, async (req, res) => {
    try {
        const info = await getUserRoleInfo(req.user.id)
        if (!info) return res.status(404).json({ error: 'Benutzer nicht gefunden' })
        return res.json({
            benutzer_id: info.id,
            email: info.email,
            rollen_id: info.rollen_id,
            rollen_name: info.rollen_name,
            prioritaet: info.prioritaet,
            is_admin: isAdminRole(info),
        })
    } catch (err) {
        console.error('GET /api/me error:', err)
        return res.status(500).json({ error: 'Fehler beim Laden des Profils' })
    }
})

async function createRoomHandler(req, res) {
    try {
        const { bezeichnung, standort, kapazitaet } = req.body || {}
        const bz = String(bezeichnung || '').trim()
        const st = String(standort || '').trim()
        const kap = Number(kapazitaet)
        if (!bz) return res.status(400).json({ error: 'Bezeichnung erforderlich' })
        if (!st) return res.status(400).json({ error: 'Standort erforderlich' })
        if (!Number.isFinite(kap) || kap <= 0) return res.status(400).json({ error: 'Kapazitaet muss > 0 sein' })

        const [result] = await pool.query(
            'INSERT INTO Raum (Bezeichnung, Standort, Kapazitaet) VALUES (?, ?, ?)',
            [bz, st, Math.trunc(kap)]
        )
        return res.status(201).json({ id: result.insertId })
    } catch (err) {
        console.error('POST admin room error:', err)
        return res.status(500).json({ error: 'Fehler beim Anlegen des Raums' })
    }
}

// Admin: create new room, auth + role required
app.post('/api/admin/rooms', authenticate, requireRole("administrator"), createRoomHandler)

async function updateBookingHandler(req, res) {
    try {
        const bookingId = Number(req.params.id)
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: 'Ungültige Buchungs-ID' })

        const { room_id, date, start_time, end_time, name, beschreibung } = req.body || {}
        const participantEmails = parseParticipantsFromBody(req.body)

        if (!room_id || !date || !start_time || !end_time || !name) {
            return res.status(400).json({ error: 'Felder room_id, date, start_time, end_time, name sind erforderlich' })
        }

        const raumId = Number(room_id)
        if (!Number.isFinite(raumId)) return res.status(400).json({ error: 'Ungültige room_id' })

        const startTs = `${String(date).trim()} ${String(start_time).trim()}:00`
        const endTs = `${String(date).trim()} ${String(end_time).trim()}:00`
        if (endTs <= startTs) return res.status(400).json({ error: 'Endzeit muss nach der Startzeit liegen.' })

        // booking exists?
        const [exists] = await pool.query('SELECT Buchung_Id AS id FROM Buchungen WHERE Buchung_Id = ? LIMIT 1', [bookingId])
        if (!exists.length) return res.status(404).json({ error: 'Buchung nicht gefunden' })

        // room exists?
        const [roomRows] = await pool.query('SELECT Raum_Id AS id FROM Raum WHERE Raum_Id = ? LIMIT 1', [raumId])
        if (!roomRows.length) return res.status(404).json({ error: 'Raum nicht gefunden' })

        if (await hasConflictExcludingBooking(raumId, bookingId, startTs, endTs)) {
            return res.status(409).json({ error: 'Zeitfenster belegt' })
        }

        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            const nameFinal = String(name || '').trim()
            const beschreibungFinal = String(beschreibung || '').trim() || null
            await conn.query(
                'UPDATE Buchungen SET Raum_Id = ?, Startzeit = ?, Endzeit = ?, Name = ?, Beschreibung = ? WHERE Buchung_Id = ?',
                [raumId, startTs, endTs, nameFinal, beschreibungFinal, bookingId]
            )

            // participants
            await conn.query('DELETE FROM Buchung_Benutzer WHERE Buchung_Id = ?', [bookingId])
            const { users, unknown } = await resolveUserIdsByEmails(participantEmails)
            if (unknown.length) {
                await conn.rollback()
                return res.status(400).json({ error: `Unbekannte Teilnehmer: ${unknown.join(', ')}`, unknown })
            }

            const userIds = Array.from(new Set(users.map((u) => u.id).filter((x) => Number.isFinite(Number(x)))))
            for (const uid of userIds) {
                try {
                    await conn.query('INSERT INTO Buchung_Benutzer (Buchung_Id, Benutzer_Id) VALUES (?, ?)', [bookingId, uid])
                } catch (_) { }
            }

            await conn.commit()
            return res.json({ id: bookingId })
        } finally {
            conn.release()
        }
    } catch (err) {
        console.error('PUT booking error:', err)
        return res.status(500).json({ error: 'Fehler beim Aktualisieren der Buchung' })
    }
}

async function deleteBookingHandler(req, res) {
    try {
        const bookingId = Number(req.params.id)
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: 'Ungültige Buchungs-ID' })
        const [result] = await pool.query('DELETE FROM Buchungen WHERE Buchung_Id = ?', [bookingId])
        if (!result.affectedRows) return res.status(404).json({ error: 'Buchung nicht gefunden' })
        return res.status(204).send()
    } catch (err) {
        console.error('DELETE booking error:', err)
        return res.status(500).json({ error: 'Fehler beim Löschen der Buchung' })
    }
}

// Admin: update/delete bookings
app.put('/api/bookings/:id', authenticate, requireRole("administrator"), updateBookingHandler)
app.delete('/api/bookings/:id', authenticate, requireRole("administrator"), deleteBookingHandler)

async function searchUsersHandler(req, res) {
    try {
        const q = req.query.q != null ? String(req.query.q).trim().toLowerCase() : ''
        const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)))
        const currentEmail = String(req.user?.email || '').trim().toLowerCase()
        const currentSub = String(req.user?.sub || '').trim()

        let sql = `SELECT Benutzer_Id AS id, Email AS email, Vorname AS vorname, Nachname AS nachname
			FROM Benutzer`
        const params = []
        const whereParts = []

        if (q) {
            const like = `%${q}%`
            whereParts.push(`(LOWER(Email) LIKE ?
				OR LOWER(Vorname) LIKE ?
				OR LOWER(Nachname) LIKE ?
				OR LOWER(CONCAT(Vorname, ' ', Nachname)) LIKE ?)`)
            params.push(like, like, like, like)
        }

        if (currentEmail) {
            whereParts.push('LOWER(Email) <> ?')
            params.push(currentEmail)
        }

        if (currentSub) {
            whereParts.push('Keycloak_Id <> ?')
            params.push(currentSub)
        }

        if (whereParts.length) {
            sql += ` WHERE ${whereParts.join(' AND ')}`
        }

        sql += ` ORDER BY Nachname ASC, Vorname ASC LIMIT ?`
        params.push(limit)

        const [rows] = await pool.query(sql, params)
        const data = rows.map((u) => ({
            id: u.id,
            email: u.email,
            name: `${u.vorname || ''} ${u.nachname || ''}`.trim(),
            vorname: u.vorname,
            nachname: u.nachname,
        }))
        return res.json(data)
    } catch (err) {
        console.error('GET /users error:', err)
        return res.status(500).json({ error: 'Fehler beim Laden der Benutzer' })
    }
}

// Users search (for booking participants). Auth required.
app.get('/api/users', authenticate, searchUsersHandler)

app.post('/api/sync-user', authenticate, syncUser)

async function syncUser(req, res, next) {
    console.log('Syncing user from token:', req.user)
    try {
        // 1. Extract data from the Keycloak token (req.user)
        // sub is the standard OIDC field for the unique Keycloak_Id
        const { sub, given_name, family_name, email, realm_access } = req.user;
        let roles = realm_access && Array.isArray(realm_access.roles) ? realm_access.roles : [];
        let rollen_id = await getRoleID(roles);

        if (!sub || !email) {
            return res.status(400).json({ error: "Missing user information in token." });
        }

        // 3. Perform the Upsert logic
        // We use ON DUPLICATE KEY UPDATE to refresh roles if they changed in Keycloak
        const sql = `
      INSERT INTO Benutzer (Keycloak_Id, Vorname, Nachname, Email, Rollen_Id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        Vorname = VALUES(Vorname),
        Nachname = VALUES(Nachname),
        Email = VALUES(Email),
        Rollen_Id = VALUES(Rollen_Id);
    `;

        await pool.query(sql, [
            sub,
            given_name || '',
            family_name || '',
            email,
            rollen_id,
        ]);

    } catch (error) {
        console.error("Error syncing user:", error);
        res.status(500).json({ error: "Internal Server Error during user sync." });
    }
}

async function getRoleID(keycloakRoles) {
    // Mapping of Keycloak roles to Rollen_Id in our database, Ids: 1 = Mitarbeiter, 2 = Genehmiger, 3 = Administrator, default to 1 if no match
    let roleID;
    if (keycloakRoles.includes("administrator")) roleID = 3;
    else if (keycloakRoles.includes("genehmiger")) roleID = 2;
    else roleID = 1;
    return roleID;
}

app.get('/api/bookings', authenticate, async (req, res) => {
    console.log(req);
    try {
        const roomId = req.query.room_id != null && String(req.query.room_id).trim() !== ''
            ? Number(req.query.room_id)
            : null
        const from = req.query.from != null && String(req.query.from).trim() !== ''
            ? String(req.query.from).trim()
            : null
        const to = req.query.to != null && String(req.query.to).trim() !== ''
            ? String(req.query.to).trim()
            : null
        const mine = req.query.mine === 'true'

        const where = []
        const params = []

        if (mine) {
            const benutzerId = await getBenutzerIdForRequestUser(req.user)
            if (!Number.isFinite(Number(benutzerId))) {
                return res.json([])
            }
            where.push('EXISTS (SELECT 1 FROM Buchung_Benutzer bb_mine WHERE bb_mine.Buchung_Id = b.Buchung_Id AND bb_mine.Benutzer_Id = ?)')
            params.push(Number(benutzerId))
        } else if (roomId != null && Number.isFinite(roomId)) {
            where.push('b.Raum_Id = ?')
            params.push(roomId)
        }

        if (from && to) {
            where.push('b.Startzeit >= ? AND b.Startzeit <= ?')
            params.push(`${from} 00:00:00`, `${to} 23:59:59`)
        } else if (from) {
            where.push('b.Startzeit >= ?')
            params.push(`${from} 00:00:00`)
        } else if (to) {
            where.push('b.Startzeit <= ?')
            params.push(`${to} 23:59:59`)
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
        const [rows] = await pool.query(
            `SELECT 
				 b.Buchung_Id AS id,
				 b.Raum_Id AS room_id,
				 r.Bezeichnung AS room,
				 DATE_FORMAT(b.Startzeit, '%Y-%m-%d') AS date,
				 DATE_FORMAT(b.Startzeit, '%H:%i') AS start_time,
				 DATE_FORMAT(b.Endzeit, '%H:%i') AS end_time,
				 b.Name AS name,
				 b.Beschreibung AS beschreibung,
				 GROUP_CONCAT(DISTINCT CONCAT(
					 u.Benutzer_Id, '::', COALESCE(u.Email,''), '::',
					 TRIM(CONCAT(COALESCE(u.Vorname,''), ' ', COALESCE(u.Nachname,'')))
				 ) SEPARATOR '||') AS participants_raw
			 FROM Buchungen b
			 JOIN Raum r ON r.Raum_Id = b.Raum_Id
			 LEFT JOIN Buchung_Benutzer bb ON bb.Buchung_Id = b.Buchung_Id
			 LEFT JOIN Benutzer u ON u.Benutzer_Id = bb.Benutzer_Id
			 ${whereSql}
			 GROUP BY b.Buchung_Id
			 ORDER BY b.Startzeit DESC`,
            params
        )
        const data = rows.map((r) => {
            const parts = String(r.participants_raw || '')
                .split('||')
                .map((x) => x.trim())
                .filter(Boolean)
                .map((x) => {
                    const [idStr, email, name] = x.split('::')
                    const id = Number(idStr)
                    return {
                        id: Number.isFinite(id) ? id : null,
                        email: email || '',
                        name: (name || '').trim(),
                    }
                })
                .filter((p) => p.id != null)
            return {
                id: r.id,
                room_id: r.room_id,
                room: r.room,
                date: r.date,
                start_time: r.start_time,
                end_time: r.end_time,
                name: r.name,
                beschreibung: r.beschreibung,
                participants: parts,
                person: parts.map((p) => p.name || p.email).filter(Boolean).join(', '),
            }
        })
        res.json(data)
    } catch (err) {
        console.error('GET /bookings error:', err)
        res.status(500).json({ error: 'Fehler beim Laden der Buchungen' })
    }
})

// POST /bookings -> create booking, optional link to Benutzer
app.post('/api/bookings', authenticate, async (req, res) => {
    try {
        console.log('POST /bookings called with body:', req.body)
        const { room, room_id, date, start_time, end_time, name, beschreibung } = req.body || {}
        const authUserId = await getBenutzerIdForRequestUser(req.user)
        const participantEmails = parseParticipantsFromBody(req.body)

        if ((!room && !room_id) || !date || !start_time || !end_time || !name) {
            return res.status(400).json({ error: 'Felder (room oder room_id), date, start_time, end_time, name sind erforderlich' })
        }
        // Build MySQL DATETIME strings
        const startTs = `${date} ${start_time}:00`
        const endTs = `${date} ${end_time}:00`
        if (endTs <= startTs) {
            return res.status(400).json({ error: 'Endzeit muss nach der Startzeit liegen.' })
        }

        let raumId = room_id
        if (!raumId) {
            raumId = await getRoomIdByName(room)
        }
        if (!raumId) {
            return res.status(404).json({ error: `Raum nicht gefunden` })
        }

        // Conflict check
        if (await hasConflict(raumId, startTs, endTs)) {
            return res.status(409).json({ error: 'Zeitfenster belegt' })
        }

        // Default values
        const status = 'Geplant'
        
        const nameFinal = String(name || '').trim()
        const beschreibungFinal = String(beschreibung || '').trim() || null

        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            const [ins] = await conn.query(
                'INSERT INTO Buchungen (Raum_Id, Startzeit, Endzeit, Status, Name, Beschreibung) VALUES (?, ?, ?, ?, ?, ?)',
                [raumId, startTs, endTs, status, nameFinal, beschreibungFinal]
            )
            const bookingId = ins.insertId

            const { users, unknown } = await resolveUserIdsByEmails(participantEmails)
            if (unknown.length) {
                await conn.rollback()
                return res.status(400).json({ error: `Unbekannte Teilnehmer: ${unknown.join(', ')}`, unknown })
            }

            const userIds = Array.from(
                new Set([authUserId, ...users.map((u) => u.id)].filter((x) => Number.isFinite(Number(x))))
            )
            for (const uid of userIds) {
                try {
                    await conn.query('INSERT INTO Buchung_Benutzer (Buchung_Id, Benutzer_Id) VALUES (?, ?)', [bookingId, uid])
                } catch (_) { }
            }

            await conn.commit()

            const recipientEmail = String(req.user?.email || '').trim()
            if (recipientEmail) {
                try {
                    const resolvedRoomName = room || await getRoomNameById(raumId) || `Raum ${raumId}`
                    await sendMail(
                        recipientEmail,
                        `AGORA Buchung ausstehend - ${nameFinal}`,
                        'booking-pending',
                        {
                            room_name: resolvedRoomName,
                            date: String(date),
                            start_time: String(start_time),
                            end_time: String(end_time),
                            booking_name: nameFinal,
                            description: beschreibungFinal,
                            participants: participantEmails,
                            requester_name: String(req.user?.name || req.user?.preferred_username || req.user?.email || '').trim(),
                        }
                    )
                } catch (mailErr) {
                    console.error('Pending mail send failed:', mailErr)
                }
            }

            return res.status(201).json({ id: bookingId })
        } finally {
            conn.release()
        }
    } catch (err) {
        console.error('POST /bookings error:', err)
        res.status(500).json({ error: 'Fehler beim Speichern der Buchung' })
    }
})


initDb()
    .then(() => checkDbConnection())
    .then(() => {
        app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
    })
    .catch((err) => {
        console.error('Startup failed:', err)
        process.exit(1)
    })

