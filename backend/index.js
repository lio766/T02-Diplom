import express from 'express';
import mysql from 'mysql2/promise'
import { authenticate } from './authenticate.js'
import { requireRole } from "./authorize.js";
import { sendMail } from './emailService.js'

const app = express()
const PORT = process.env.PORT || 3000
const REMINDER_LEAD_MINUTES = Math.max(1, Number(process.env.BOOKING_REMINDER_MINUTES || 30))
const REMINDER_POLL_MS = Math.max(15000, Number(process.env.BOOKING_REMINDER_POLL_MS || 60000))
let reminderTimer = null

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

async function ensureBookingRequesterColumn() {
    const [colRows] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'Buchungen'
           AND COLUMN_NAME = 'Benutzer_Id'`,
        [DB_CONFIG.database]
    )

    if (Number(colRows[0]?.cnt || 0) === 0) {
        await pool.query('ALTER TABLE Buchungen ADD COLUMN Benutzer_Id INT NULL')
    }

    const [fkRows] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = ?
           AND TABLE_NAME = 'Buchungen'
           AND CONSTRAINT_NAME = 'fk_buchungen_benutzer'`,
        [DB_CONFIG.database]
    )

    if (Number(fkRows[0]?.cnt || 0) === 0) {
        await pool.query(
            `ALTER TABLE Buchungen
             ADD CONSTRAINT fk_buchungen_benutzer
             FOREIGN KEY (Benutzer_Id)
             REFERENCES Benutzer (Benutzer_Id)`
        )
    }
}

async function ensureBookingReminderColumn() {
    const [colRows] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'Buchungen'
           AND COLUMN_NAME = 'Reminder_Sent_At'`,
        [DB_CONFIG.database]
    )

    if (Number(colRows[0]?.cnt || 0) === 0) {
        await pool.query('ALTER TABLE Buchungen ADD COLUMN Reminder_Sent_At DATETIME NULL')
    }
}

async function initDb() {
    pool = mysql.createPool(DB_CONFIG)
    await ensureBookingRequesterColumn()
    await ensureBookingReminderColumn()
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
        `SELECT COUNT(*) AS cnt
         FROM Buchungen
         WHERE Raum_Id = ?
           AND Status = 'Genehmigt'
           AND NOT (Endzeit <= ? OR Startzeit >= ?)`,
        [raumId, startTs, endTs]
    )
    return rows[0].cnt > 0
}

async function hasConflictExcludingBooking(raumId, bookingId, startTs, endTs) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM Buchungen
         WHERE Raum_Id = ?
           AND Buchung_Id <> ?
           AND Status = 'Genehmigt'
           AND NOT (Endzeit <= ? OR Startzeit >= ?)`,
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

function parseParticipantsRaw(raw) {
    return String(raw || '')
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
}

function formatParticipantsForTemplate(participants) {
    return (participants || [])
        .map((p) => {
            const name = String(p?.name || '').trim()
            const email = String(p?.email || '').trim()
            if (name && email) return `${name} (${email})`
            return name || email
        })
        .filter(Boolean)
}

function uniqueEmails(values) {
    return Array.from(
        new Set(
            (values || [])
                .map((x) => String(x || '').trim().toLowerCase())
                .filter(Boolean)
        )
    )
}

async function getBookingMailDataById(bookingId, conn = pool) {
    const [rows] = await conn.query(
        `SELECT
            b.Buchung_Id AS id,
            b.Raum_Id AS room_id,
            r.Bezeichnung AS room_name,
            DATE_FORMAT(b.Startzeit, '%Y-%m-%d') AS date,
            DATE_FORMAT(b.Startzeit, '%H:%i') AS start_time,
            DATE_FORMAT(b.Endzeit, '%H:%i') AS end_time,
            b.Name AS booking_name,
            b.Beschreibung AS description,
            b.Status AS status,
            MAX(req_u.Email) AS requester_email,
            MAX(TRIM(CONCAT(COALESCE(req_u.Vorname,''), ' ', COALESCE(req_u.Nachname,'')))) AS requester_name,
            GROUP_CONCAT(DISTINCT CONCAT(
                u.Benutzer_Id, '::', COALESCE(u.Email,''), '::',
                TRIM(CONCAT(COALESCE(u.Vorname,''), ' ', COALESCE(u.Nachname,'')))
            ) SEPARATOR '||') AS participants_raw
         FROM Buchungen b
         JOIN Raum r ON r.Raum_Id = b.Raum_Id
         LEFT JOIN Benutzer req_u ON req_u.Benutzer_Id = b.Benutzer_Id
         LEFT JOIN Buchung_Benutzer bb ON bb.Buchung_Id = b.Buchung_Id
         LEFT JOIN Benutzer u ON u.Benutzer_Id = bb.Benutzer_Id
         WHERE b.Buchung_Id = ?
         GROUP BY b.Buchung_Id
         LIMIT 1`,
        [bookingId]
    )

    if (!rows.length) return null

    const row = rows[0]
    const participants = parseParticipantsRaw(row.participants_raw)
    return {
        id: Number(row.id),
        room_id: Number(row.room_id),
        room_name: String(row.room_name || ''),
        date: String(row.date || ''),
        start_time: String(row.start_time || ''),
        end_time: String(row.end_time || ''),
        booking_name: String(row.booking_name || ''),
        description: String(row.description || ''),
        status: String(row.status || ''),
        requester_email: String(row.requester_email || '').trim(),
        requester_name: String(row.requester_name || '').trim(),
        participants,
        participant_display: formatParticipantsForTemplate(participants),
        participant_emails: uniqueEmails(participants.map((p) => p.email)),
    }
}

async function sendMailSafe(to, subject, templateName, contextData) {
    try {
        await sendMail(to, subject, templateName, contextData)
        return true
    } catch (err) {
        console.error(`Mail send failed (${templateName} -> ${to}):`, err)
        return false
    }
}

async function sendBookingDecisionMailToRequester(mailData, approved) {
    const requesterEmail = String(mailData?.requester_email || '').trim()
    if (!requesterEmail) return

    const templateName = approved ? 'booking-approved-requester' : 'booking-rejected-requester'
    const subject = approved
        ? `AGORA Buchung genehmigt - ${mailData.booking_name}`
        : `AGORA Buchung abgelehnt - ${mailData.booking_name}`

    await sendMailSafe(requesterEmail, subject, templateName, {
        room_name: mailData.room_name,
        date: mailData.date,
        start_time: mailData.start_time,
        end_time: mailData.end_time,
        booking_name: mailData.booking_name,
        description: mailData.description,
        requester_name: mailData.requester_name,
        participants: mailData.participant_display,
    })
}

async function sendBookingApprovedDetailsToParticipants(mailData) {
    const recipients = uniqueEmails(mailData?.participant_emails || [])
    if (!recipients.length) return

    for (const email of recipients) {
        await sendMailSafe(
            email,
            `AGORA Meeting-Zusage - ${mailData.booking_name}`,
            'booking-approved-participant',
            {
                room_name: mailData.room_name,
                date: mailData.date,
                start_time: mailData.start_time,
                end_time: mailData.end_time,
                booking_name: mailData.booking_name,
                description: mailData.description,
                requester_name: mailData.requester_name,
                participants: mailData.participant_display,
            }
        )
    }
}

async function sendBookingReminderToParticipants(mailData) {
    const recipients = uniqueEmails(mailData?.participant_emails || [])
    if (!recipients.length) return

    for (const email of recipients) {
        await sendMailSafe(
            email,
            `AGORA Erinnerung - ${mailData.booking_name} um ${mailData.start_time}`,
            'booking-reminder',
            {
                room_name: mailData.room_name,
                date: mailData.date,
                start_time: mailData.start_time,
                end_time: mailData.end_time,
                booking_name: mailData.booking_name,
                description: mailData.description,
                requester_name: mailData.requester_name,
                participants: mailData.participant_display,
                reminder_minutes: REMINDER_LEAD_MINUTES,
            }
        )
    }
}

async function processUpcomingReminders() {
    const [rows] = await pool.query(
        `SELECT Buchung_Id AS id
         FROM Buchungen
         WHERE Status = 'Genehmigt'
           AND Reminder_Sent_At IS NULL
           AND Startzeit > NOW()
           AND Startzeit <= DATE_ADD(NOW(), INTERVAL ? MINUTE)
         ORDER BY Startzeit ASC
         LIMIT 100`,
        [REMINDER_LEAD_MINUTES]
    )

    for (const row of rows) {
        const bookingId = Number(row.id)
        if (!Number.isFinite(bookingId)) continue

        try {
            const mailData = await getBookingMailDataById(bookingId)
            if (!mailData) continue

            await sendBookingReminderToParticipants(mailData)

            await pool.query(
                'UPDATE Buchungen SET Reminder_Sent_At = NOW() WHERE Buchung_Id = ? AND Reminder_Sent_At IS NULL',
                [bookingId]
            )
        } catch (err) {
            console.error(`Reminder handling failed for booking ${bookingId}:`, err)
        }
    }
}

function startReminderScheduler() {
    if (reminderTimer) clearInterval(reminderTimer)

    // Run once after startup and then in a fixed cadence.
    processUpcomingReminders().catch((err) => {
        console.error('Initial reminder processing failed:', err)
    })

    reminderTimer = setInterval(() => {
        processUpcomingReminders().catch((err) => {
            console.error('Reminder processing failed:', err)
        })
    }, REMINDER_POLL_MS)
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

async function listApproversHandler(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT b.Benutzer_Id AS id, b.Email AS email, b.Vorname AS vorname, b.Nachname AS nachname
             FROM Benutzer b
             JOIN Rollen r ON r.Rollen_Id = b.Rollen_Id
             WHERE b.Rollen_Id = 2 OR LOWER(r.Name) = 'genehmiger'
             ORDER BY b.Nachname ASC, b.Vorname ASC`
        )

        return res.json(
            rows.map((u) => ({
                id: u.id,
                email: u.email,
                vorname: u.vorname,
                nachname: u.nachname,
                name: `${u.vorname || ''} ${u.nachname || ''}`.trim(),
            }))
        )
    } catch (err) {
        console.error('GET /api/admin/approvers error:', err)
        return res.status(500).json({ error: 'Fehler beim Laden der Genehmiger' })
    }
}

async function getRoomApproversHandler(req, res) {
    try {
        const roomId = Number(req.params.id)
        if (!Number.isFinite(roomId)) return res.status(400).json({ error: 'Ungültige Raum-ID' })

        const [roomRows] = await pool.query('SELECT Raum_Id AS id FROM Raum WHERE Raum_Id = ? LIMIT 1', [roomId])
        if (!roomRows.length) return res.status(404).json({ error: 'Raum nicht gefunden' })

        const [rows] = await pool.query(
            `SELECT b.Benutzer_Id AS id, b.Email AS email, b.Vorname AS vorname, b.Nachname AS nachname
             FROM Genehmiger_Raum gr
             JOIN Benutzer b ON b.Benutzer_Id = gr.Benutzer_Id
             WHERE gr.Raum_Id = ?
             ORDER BY b.Nachname ASC, b.Vorname ASC`,
            [roomId]
        )

        return res.json({
            room_id: roomId,
            approvers: rows.map((u) => ({
                id: u.id,
                email: u.email,
                vorname: u.vorname,
                nachname: u.nachname,
                name: `${u.vorname || ''} ${u.nachname || ''}`.trim(),
            })),
        })
    } catch (err) {
        console.error('GET /api/admin/rooms/:id/approvers error:', err)
        return res.status(500).json({ error: 'Fehler beim Laden der Raumzuweisungen' })
    }
}

async function updateRoomApproversHandler(req, res) {
    const conn = await pool.getConnection()
    try {
        const roomId = Number(req.params.id)
        if (!Number.isFinite(roomId)) return res.status(400).json({ error: 'Ungültige Raum-ID' })

        const rawIds = Array.isArray(req.body?.approver_ids) ? req.body.approver_ids : []
        const approverIds = Array.from(
            new Set(
                rawIds
                    .map((x) => Number(x))
                    .filter((x) => Number.isFinite(x) && x > 0)
            )
        )

        const [roomRows] = await conn.query('SELECT Raum_Id AS id FROM Raum WHERE Raum_Id = ? LIMIT 1', [roomId])
        if (!roomRows.length) return res.status(404).json({ error: 'Raum nicht gefunden' })

        if (approverIds.length) {
            const placeholders = approverIds.map(() => '?').join(',')
            const [validApprovers] = await conn.query(
                `SELECT b.Benutzer_Id AS id
                 FROM Benutzer b
                 JOIN Rollen r ON r.Rollen_Id = b.Rollen_Id
                 WHERE b.Benutzer_Id IN (${placeholders})
                   AND (b.Rollen_Id = 2 OR LOWER(r.Name) = 'genehmiger')`,
                approverIds
            )
            const validIds = new Set(validApprovers.map((x) => Number(x.id)))
            const invalidIds = approverIds.filter((x) => !validIds.has(x))
            if (invalidIds.length) {
                return res.status(400).json({
                    error: `Nur Benutzer mit Genehmigerrolle sind erlaubt. Ungültige IDs: ${invalidIds.join(', ')}`,
                    invalid_ids: invalidIds,
                })
            }
        }

        await conn.beginTransaction()
        await conn.query('DELETE FROM Genehmiger_Raum WHERE Raum_Id = ?', [roomId])

        for (const approverId of approverIds) {
            await conn.query(
                'INSERT INTO Genehmiger_Raum (Raum_Id, Benutzer_Id) VALUES (?, ?)',
                [roomId, approverId]
            )
        }

        await conn.commit()
        return res.json({ room_id: roomId, approver_ids: approverIds })
    } catch (err) {
        try {
            await conn.rollback()
        } catch (_) { }
        console.error('PUT /api/admin/rooms/:id/approvers error:', err)
        return res.status(500).json({ error: 'Fehler beim Speichern der Raumzuweisungen' })
    } finally {
        conn.release()
    }
}

async function listPendingApprovalsHandler(req, res) {
    try {
        const approverId = await getBenutzerIdForRequestUser(req.user)
        if (!Number.isFinite(Number(approverId))) {
            return res.status(404).json({ error: 'Genehmiger-Benutzer nicht gefunden' })
        }

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
                b.Status AS status,
                MAX(req_u.Email) AS requester_email,
                MAX(TRIM(CONCAT(COALESCE(req_u.Vorname,''), ' ', COALESCE(req_u.Nachname,'')))) AS requester_name,
                GROUP_CONCAT(DISTINCT CONCAT(
                    u.Benutzer_Id, '::', COALESCE(u.Email,''), '::',
                    TRIM(CONCAT(COALESCE(u.Vorname,''), ' ', COALESCE(u.Nachname,'')))
                ) SEPARATOR '||') AS participants_raw
             FROM Buchungen b
             JOIN Raum r ON r.Raum_Id = b.Raum_Id
             JOIN Genehmiger_Raum gr ON gr.Raum_Id = b.Raum_Id
             LEFT JOIN Benutzer req_u ON req_u.Benutzer_Id = b.Benutzer_Id
             LEFT JOIN Buchung_Benutzer bb ON bb.Buchung_Id = b.Buchung_Id
             LEFT JOIN Benutzer u ON u.Benutzer_Id = bb.Benutzer_Id
             WHERE gr.Benutzer_Id = ?
               AND b.Status = 'Geplant'
             GROUP BY b.Buchung_Id
             ORDER BY b.Startzeit ASC, b.Erstellzeit ASC`,
            [Number(approverId)]
        )

        const data = rows.map((r) => {
            const participants = parseParticipantsRaw(r.participants_raw)
            const requesterName = String(r.requester_name || '').trim()
            const requesterEmail = String(r.requester_email || '').trim()
            const fallbackRequester = participants[0] || null
            return {
                id: r.id,
                room_id: r.room_id,
                room: r.room,
                date: r.date,
                start_time: r.start_time,
                end_time: r.end_time,
                name: r.name,
                beschreibung: r.beschreibung,
                status: r.status,
                requester_name: requesterName || fallbackRequester?.name || '',
                requester_email: requesterEmail || fallbackRequester?.email || '',
                requester_display: requesterName || requesterEmail || fallbackRequester?.name || fallbackRequester?.email || '',
                participants,
            }
        })

        return res.json(data)
    } catch (err) {
        console.error('GET /api/approvals error:', err)
        return res.status(500).json({ error: 'Fehler beim Laden der Genehmigungen' })
    }
}

async function decideApprovalHandler(req, res) {
    const conn = await pool.getConnection()
    try {
        const bookingId = Number(req.params.id)
        const decision = String(req.body?.decision || '').trim().toLowerCase()

        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: 'Ungültige Buchungs-ID' })
        if (!['approve', 'reject'].includes(decision)) {
            return res.status(400).json({ error: 'Ungültige Entscheidung. Erlaubt: approve oder reject' })
        }

        const approverId = await getBenutzerIdForRequestUser(req.user)
        if (!Number.isFinite(Number(approverId))) {
            return res.status(404).json({ error: 'Genehmiger-Benutzer nicht gefunden' })
        }

        await conn.beginTransaction()

        const [bookingRows] = await conn.query(
            `SELECT Buchung_Id AS id, Raum_Id AS room_id, Startzeit AS start_ts, Endzeit AS end_ts, Status AS status
             FROM Buchungen
             WHERE Buchung_Id = ?
             LIMIT 1`,
            [bookingId]
        )
        if (!bookingRows.length) {
            await conn.rollback()
            return res.status(404).json({ error: 'Buchungsanfrage nicht gefunden' })
        }

        const booking = bookingRows[0]
        if (String(booking.status || '') !== 'Geplant') {
            await conn.rollback()
            return res.status(409).json({ error: 'Buchung wurde bereits entschieden' })
        }

        const [assignmentRows] = await conn.query(
            `SELECT 1 AS ok
             FROM Genehmiger_Raum
             WHERE Raum_Id = ? AND Benutzer_Id = ?
             LIMIT 1`,
            [booking.room_id, Number(approverId)]
        )
        if (!assignmentRows.length) {
            await conn.rollback()
            return res.status(403).json({ error: 'Keine Berechtigung für diesen Raum' })
        }

        const mailData = await getBookingMailDataById(bookingId, conn)

        if (decision === 'approve') {
            const [conflictRows] = await conn.query(
                `SELECT COUNT(*) AS cnt
                 FROM Buchungen
                 WHERE Raum_Id = ?
                   AND Buchung_Id <> ?
                   AND Status = 'Genehmigt'
                   AND NOT (Endzeit <= ? OR Startzeit >= ?)`,
                [booking.room_id, bookingId, booking.start_ts, booking.end_ts]
            )

            if (Number(conflictRows[0]?.cnt || 0) > 0) {
                await conn.rollback()
                return res.status(409).json({ error: 'Zeitfenster wurde bereits durch eine andere Anfrage genehmigt' })
            }

            await conn.query('UPDATE Buchungen SET Status = ?, Reminder_Sent_At = NULL WHERE Buchung_Id = ?', ['Genehmigt', bookingId])
            await conn.commit()

            if (mailData) {
                mailData.status = 'Genehmigt'
                await sendBookingDecisionMailToRequester(mailData, true)
                await sendBookingApprovedDetailsToParticipants(mailData)
            }

            return res.json({ id: bookingId, status: 'Genehmigt' })
        }

        await conn.query('DELETE FROM Buchungen WHERE Buchung_Id = ?', [bookingId])
        await conn.commit()

        if (mailData) {
            mailData.status = 'Abgelehnt'
            await sendBookingDecisionMailToRequester(mailData, false)
        }

        return res.json({ id: bookingId, status: 'Abgelehnt' })
    } catch (err) {
        try {
            await conn.rollback()
        } catch (_) { }
        console.error('PUT /api/approvals/:id error:', err)
        return res.status(500).json({ error: 'Fehler beim Entscheiden der Anfrage' })
    } finally {
        conn.release()
    }
}

// Admin: create new room, auth + role required
app.post('/api/admin/rooms', authenticate, requireRole("administrator"), createRoomHandler)
app.get('/api/admin/approvers', authenticate, requireRole("administrator"), listApproversHandler)
app.get('/api/admin/rooms/:id/approvers', authenticate, requireRole("administrator"), getRoomApproversHandler)
app.put('/api/admin/rooms/:id/approvers', authenticate, requireRole("administrator"), updateRoomApproversHandler)
app.get('/api/approvals', authenticate, requireRole("genehmiger"), listPendingApprovalsHandler)
app.put('/api/approvals/:id', authenticate, requireRole("genehmiger"), decideApprovalHandler)

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
        const [existsRows] = await pool.query(
            "SELECT Benutzer_Id, Status, Raum_Id, Reminder_Sent_At AS reminder_sent_at, DATE_FORMAT(Startzeit, '%Y-%m-%d %H:%i:00') AS start_db, DATE_FORMAT(Endzeit, '%Y-%m-%d %H:%i:00') AS end_db FROM Buchungen WHERE Buchung_Id = ? LIMIT 1",
            [bookingId]
        )
        if (!existsRows.length) return res.status(404).json({ error: 'Buchung nicht gefunden' })
        const existing = existsRows[0]

        const authUserId = await getBenutzerIdForRequestUser(req.user)
        if (existing.Benutzer_Id !== authUserId) {
            return res.status(403).json({ error: 'Nur der Ersteller darf diese Buchung bearbeiten.' })
        }

        let newStatus = existing.Status
        if (existing.Status === 'Genehmigt') {
            if (existing.Raum_Id !== raumId || existing.start_db !== startTs || existing.end_db !== endTs) {
                newStatus = 'Geplant'
            }
        }

        // room exists?
        const [roomRows] = await pool.query('SELECT Raum_Id AS id FROM Raum WHERE Raum_Id = ? LIMIT 1', [raumId])
        if (!roomRows.length) return res.status(404).json({ error: 'Raum nicht gefunden' })

        // Check if room has an approver
        const [approverRows] = await pool.query('SELECT Benutzer_Id FROM Genehmiger_Raum WHERE Raum_Id = ? LIMIT 1', [raumId])
        if (!approverRows.length) {
            return res.status(400).json({ error: 'Dieser Raum hat keinen zugewiesenen Genehmiger und kann daher nicht neu gebucht werden.' })
        }

        if (await hasConflictExcludingBooking(raumId, bookingId, startTs, endTs)) {
            return res.status(409).json({ error: 'Zeitfenster bereits genehmigt' })
        }

        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            const nameFinal = String(name || '').trim()
            const beschreibungFinal = String(beschreibung || '').trim() || null
            await conn.query(
                'UPDATE Buchungen SET Raum_Id = ?, Startzeit = ?, Endzeit = ?, Name = ?, Beschreibung = ?, Status = ?, Reminder_Sent_At = ? WHERE Buchung_Id = ?',
                [
                    raumId,
                    startTs,
                    endTs,
                    nameFinal,
                    beschreibungFinal,
                    newStatus,
                    newStatus === 'Genehmigt' ? existing.reminder_sent_at : null,
                    bookingId,
                ]
            )

            // participants
            await conn.query('DELETE FROM Buchung_Benutzer WHERE Buchung_Id = ?', [bookingId])
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
            return res.json({ id: bookingId, status: newStatus })
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

        const [existsRows] = await pool.query('SELECT Benutzer_Id, Raum_Id FROM Buchungen WHERE Buchung_Id = ? LIMIT 1', [bookingId])
        if (!existsRows.length) return res.status(404).json({ error: 'Buchung nicht gefunden' })

        const existing = existsRows[0]
        const authUserId = await getBenutzerIdForRequestUser(req.user)

        let roles = req.user?.realm_access?.roles || []
        const isGenehmiger = roles.includes("genehmiger")

        if (existing.Benutzer_Id !== authUserId) {
            if (!isGenehmiger) {
                return res.status(403).json({ error: 'Nur der Ersteller darf diese Buchung löschen.' })
            }

            // Verifizieren dass der Genehmiger für diesen Raum berechtigt ist
            const [genehmigerRaumRows] = await pool.query(
                'SELECT 1 FROM Genehmiger_Raum WHERE Raum_Id = ? AND Benutzer_Id = ? LIMIT 1',
                [existing.Raum_Id, authUserId]
            )

            if (!genehmigerRaumRows.length) {
                return res.status(403).json({ error: 'Sie sind nicht als Genehmiger für diesen Raum eingeteilt und dürfen die Buchung daher nicht löschen.' })
            }
        }

        const [result] = await pool.query('DELETE FROM Buchungen WHERE Buchung_Id = ?', [bookingId])
        if (!result.affectedRows) return res.status(404).json({ error: 'Buchung nicht gefunden' })
        return res.status(204).send()
    } catch (err) {
        console.error('DELETE booking error:', err)
        return res.status(500).json({ error: 'Fehler beim Löschen der Buchung' })
    }
}

// User/Admin: update/delete bookings
app.put('/api/bookings/:id', authenticate, updateBookingHandler)
app.delete('/api/bookings/:id', authenticate, deleteBookingHandler)

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

app.get('/api/roomrights', authenticate, requireRole("genehmiger"), async (req, res) => {
    console.log('Checking room rights for user:', req.user)
    const userId = await getBenutzerIdForRequestUser(req.user)
    if (!Number.isFinite(Number(userId))) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' })
    }

    const [rows] = await pool.query(
        `SELECT 1 as ok
             FROM Genehmiger_Raum gr
             JOIN Raum r ON r.Raum_Id = gr.Raum_Id
             WHERE gr.Benutzer_Id = ?
             AND r.Raum_Id = ?`,
        [Number(userId), Number(req.query.room_id)]
    )

    if (!rows.length) {
        return res.json({ has_rights: false })
    }
    return res.json({ has_rights: true })
}
)

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
                 b.Status AS status,
				 (SELECT Keycloak_Id FROM Benutzer WHERE Benutzer_Id = b.Benutzer_Id) AS requester_sub,
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
            const parts = parseParticipantsRaw(r.participants_raw)
            return {
                id: r.id,
                room_id: r.room_id,
                room: r.room,
                status: r.status,
                requester_sub: r.requester_sub,
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

        const [assignedApprovers] = await pool.query(
            'SELECT Benutzer_Id AS id FROM Genehmiger_Raum WHERE Raum_Id = ?',
            [raumId]
        )
        if (!assignedApprovers.length) {
            return res.status(400).json({ error: 'Für diesen Raum sind keine Genehmiger zugewiesen' })
        }

        // Conflict check
        if (await hasConflict(raumId, startTs, endTs)) {
            return res.status(409).json({ error: 'Zeitfenster bereits genehmigt' })
        }

        // Default values
        const status = 'Geplant'
        const requesterId = Number.isFinite(Number(authUserId)) ? Number(authUserId) : null

        const nameFinal = String(name || '').trim()
        const beschreibungFinal = String(beschreibung || '').trim() || null

        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            const [ins] = await conn.query(
                'INSERT INTO Buchungen (Raum_Id, Benutzer_Id, Startzeit, Endzeit, Status, Name, Beschreibung) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [raumId, requesterId, startTs, endTs, status, nameFinal, beschreibungFinal]
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

            return res.status(201).json({ id: bookingId, status, requested_approver_count: assignedApprovers.length })
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
        startReminderScheduler()
        app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
    })
    .catch((err) => {
        console.error('Startup failed:', err)
        process.exit(1)
    })

