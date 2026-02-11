const express = require('express')
const mysql = require('mysql2/promise')
const crypto = require('crypto')

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

let pool

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me'

function hashPassword(password) {
	const pw = String(password || '')
	if (!pw) throw new Error('Passwort erforderlich')
	// scrypt parameters (reasonable defaults)
	const cost = 16384
	const blockSize = 8
	const parallelization = 1
	const keyLen = 64
	const salt = crypto.randomBytes(16).toString('base64url')
	const derived = crypto.scryptSync(pw, salt, keyLen, { cost, blockSize, parallelization })
	const hash = Buffer.from(derived).toString('base64url')
	return `scrypt$${cost}$${blockSize}$${parallelization}$${salt}$${hash}`
}

function verifyPassword(storedHash, password) {
	try {
		const pw = String(password || '')
		if (!pw) return false
		const parts = String(storedHash || '').split('$')
		if (parts.length !== 6) return false
		const [scheme, costStr, blockStr, parStr, salt, hash] = parts
		if (scheme !== 'scrypt') return false
		const cost = Number(costStr)
		const blockSize = Number(blockStr)
		const parallelization = Number(parStr)
		if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelization)) return false
		const keyLen = Buffer.from(String(hash), 'base64url').length
		if (!keyLen) return false
		const derived = crypto.scryptSync(pw, salt, keyLen, { cost, blockSize, parallelization })
		const actual = Buffer.from(derived).toString('base64url')
		if (actual.length !== String(hash).length) return false
		return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(String(hash)))
	} catch (_) {
		return false
	}
}

async function ensureDefaultDepartmentId(abteilungId) {
	let deptId = abteilungId
	if (deptId == null) {
		const [deptRows] = await pool.query('SELECT Abteilung_Id AS id FROM Abteilungen WHERE Name = ? LIMIT 1', ['Allgemein'])
		if (!deptRows.length) {
			const [insertDept] = await pool.query('INSERT INTO Abteilungen (Name, Parent_Abt) VALUES (?, ?)', ['Allgemein', null])
			deptId = insertDept.insertId
		} else {
			deptId = deptRows[0].id
		}
	}
	return deptId
}

function base64urlEncode(obj) {
	return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
}

function base64urlDecode(str) {
	return JSON.parse(Buffer.from(String(str), 'base64url').toString('utf8'))
}

function signToken(payload) {
	const body = base64urlEncode(payload)
	const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
	return `${body}.${sig}`
}

function verifyToken(token) {
	const parts = String(token || '').split('.')
	if (parts.length !== 2) return null
	const [body, sig] = parts
	const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
	if (sig.length !== expected.length) return null
	if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
	const payload = base64urlDecode(body)
	if (!payload || !payload.uid) return null
	if (payload.exp && Date.now() > Number(payload.exp)) return null
	return payload
}

function getBearerToken(req) {
	const h = req.header('Authorization') || ''
	const m = String(h).match(/^Bearer\s+(.+)$/i)
	return m ? m[1].trim() : null
}

async function requireAuth(req, res, next) {
	try {
		const token = getBearerToken(req)
		if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' })
		const payload = verifyToken(token)
		if (!payload) return res.status(401).json({ error: 'Ungültige Sitzung' })
		const uid = Number(payload.uid)
		if (!Number.isFinite(uid)) return res.status(401).json({ error: 'Ungültige Sitzung' })

		const [rows] = await pool.query('SELECT Benutzer_Id AS id FROM Benutzer WHERE Benutzer_Id = ? LIMIT 1', [uid])
		if (!rows.length) return res.status(401).json({ error: 'Benutzer nicht gefunden' })
		req.user = { id: uid }
		next()
	} catch (err) {
		console.error('Auth error:', err)
		return res.status(401).json({ error: 'Nicht autorisiert' })
	}
}

async function getUserRoleInfo(userId) {
	const uid = Number(userId)
	if (!Number.isFinite(uid)) return null
	const [rows] = await pool.query(
		`SELECT b.Benutzer_Id AS id,
				b.Email AS email,
				b.Rollen_Id AS rollen_id,
				r.Name AS rollen_name,
				r.Prioritaet AS prioritaet
		 FROM Benutzer b
		 LEFT JOIN Rollen r ON r.Rollen_Id = b.Rollen_Id
		 WHERE b.Benutzer_Id = ?
		 LIMIT 1`,
		[uid]
	)
	return rows.length ? rows[0] : null
}

function isAdminRole(roleInfo) {
	if (!roleInfo) return false
	const rollenId = Number(roleInfo.rollen_id)
	// Only Rollen_Id = 2 is admin
	if (rollenId === 2) return true
	return false
}

async function requireAdmin(req, res, next) {
	try {
		const uid = req.user?.id
		const roleInfo = await getUserRoleInfo(uid)
		if (!roleInfo) return res.status(401).json({ error: 'Benutzer nicht gefunden' })
		if (!isAdminRole(roleInfo)) return res.status(403).json({ error: 'Keine Admin-Berechtigung' })
		req.user.role = {
			rollen_id: roleInfo.rollen_id,
			rollen_name: roleInfo.rollen_name,
			prioritaet: roleInfo.prioritaet,
		}
		next()
	} catch (err) {
		console.error('Admin auth error:', err)
		return res.status(500).json({ error: 'Berechtigungsprüfung fehlgeschlagen' })
	}
}

async function requireAuthForBookingEdit(req, res, next) {
	try {
		const uid = req.user?.id
		const bookingId = Number(req.params.id)
		if (!Number.isFinite(bookingId)) return res.status(400).json({ error: 'Ungültige Buchungs-ID' })
		
		const roleInfo = await getUserRoleInfo(uid)
		if (!roleInfo) return res.status(401).json({ error: 'Benutzer nicht gefunden' })
		
		// Admins (Rollen_Id = 2) can always edit
		if (isAdminRole(roleInfo)) return next()
		
		// Check if user is participant in this booking
		const [rows] = await pool.query(
			'SELECT COUNT(*) AS cnt FROM Buchung_Benutzer WHERE Buchung_Id = ? AND Benutzer_Id = ?',
			[bookingId, uid]
		)
		if (!rows[0].cnt) return res.status(403).json({ error: 'Berechtigung verweigert' })
		
		next()
	} catch (err) {
		console.error('Booking auth error:', err)
		return res.status(500).json({ error: 'Berechtigungsprüfung fehlgeschlagen' })
	}
}

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
app.get('/rooms', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT Raum_Id AS id, Bezeichnung AS name, Standort, Kapazitaet FROM Raum ORDER BY Bezeichnung ASC')
		res.json(rows)
	} catch (err) {
		console.error('GET /rooms error:', err)
		res.status(500).json({ error: 'Fehler beim Laden der Räume' })
	}
})

// Current user info (server-truth, incl. role)
app.get('/me', requireAuth, async (req, res) => {
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
		console.error('GET /me error:', err)
		return res.status(500).json({ error: 'Fehler beim Laden des Profils' })
	}
})

app.get('/api/me', requireAuth, async (req, res) => {
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

// Admin: create new room
app.post('/admin/rooms', requireAuth, requireAdmin, createRoomHandler)
app.post('/api/admin/rooms', requireAuth, requireAdmin, createRoomHandler)

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
				} catch (_) {}
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

// Update/delete bookings: Admins can edit all, users can edit their own
app.put('/bookings/:id', requireAuth, requireAuthForBookingEdit, updateBookingHandler)
app.put('/api/bookings/:id', requireAuth, requireAuthForBookingEdit, updateBookingHandler)
app.delete('/bookings/:id', requireAuth, requireAuthForBookingEdit, deleteBookingHandler)
app.delete('/api/bookings/:id', requireAuth, requireAuthForBookingEdit, deleteBookingHandler)

app.get('/api/rooms', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT Raum_Id AS id, Bezeichnung AS name, Standort, Kapazitaet FROM Raum ORDER BY Bezeichnung ASC')
		res.json(rows)
	} catch (err) {
		console.error('GET /api/rooms error:', err)
		res.status(500).json({ error: 'Fehler beim Laden der Räume' })
	}
})

async function searchUsersHandler(req, res) {
	try {
		const q = req.query.q != null ? String(req.query.q).trim().toLowerCase() : ''
		const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)))

		let sql = `SELECT Benutzer_Id AS id, Email AS email, Vorname AS vorname, Nachname AS nachname
			FROM Benutzer`
		const params = []
		if (q) {
			const like = `%${q}%`
			sql += ` WHERE LOWER(Email) LIKE ?
				OR LOWER(Vorname) LIKE ?
				OR LOWER(Nachname) LIKE ?
				OR LOWER(CONCAT(Vorname, ' ', Nachname)) LIKE ?`
			params.push(like, like, like, like)
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
app.get('/users', requireAuth, searchUsersHandler)
app.get('/api/users', requireAuth, searchUsersHandler)

app.get('/bookings', async (req, res) => {
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

		const where = []
		const params = []
		if (roomId != null && Number.isFinite(roomId)) {
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

app.get('/api/bookings', async (req, res) => {
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

		const where = []
		const params = []
		if (roomId != null && Number.isFinite(roomId)) {
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
		console.error('GET /api/bookings error:', err)
		res.status(500).json({ error: 'Fehler beim Laden der Buchungen' })
	}
})

// POST /bookings -> create booking, optional link to Benutzer
app.post('/bookings', requireAuth, async (req, res) => {
	try {
		const { room, room_id, date, start_time, end_time, name, beschreibung } = req.body || {}
		const authUserId = req.user.id
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
		const prioritaet = 1
		const nameFinal = String(name || '').trim()
		const beschreibungFinal = String(beschreibung || '').trim() || null

		const conn = await pool.getConnection()
		try {
			await conn.beginTransaction()
			const [ins] = await conn.query(
				'INSERT INTO Buchungen (Raum_Id, Startzeit, Endzeit, Status, Prioritaet, Name, Beschreibung) VALUES (?, ?, ?, ?, ?, ?, ?)',
				[raumId, startTs, endTs, status, prioritaet, nameFinal, beschreibungFinal]
			)
			const bookingId = ins.insertId

			const { users, unknown } = await resolveUserIdsByEmails(participantEmails)
			if (unknown.length) {
				await conn.rollback()
				return res.status(400).json({ error: `Unbekannte Teilnehmer: ${unknown.join(', ')}`, unknown })
			}

			const userIds = Array.from(new Set([authUserId, ...users.map((u) => u.id)].filter((x) => Number.isFinite(Number(x)))))
			for (const uid of userIds) {
				try {
					await conn.query('INSERT INTO Buchung_Benutzer (Buchung_Id, Benutzer_Id) VALUES (?, ?)', [bookingId, uid])
				} catch (_) {}
			}

			await conn.commit()
			return res.status(201).json({ id: bookingId })
		} finally {
			conn.release()
		}
	} catch (err) {
		console.error('POST /bookings error:', err)
		res.status(500).json({ error: 'Fehler beim Speichern der Buchung' })
	}
})

app.post('/api/bookings', requireAuth, async (req, res) => {
	try {
		const { room, room_id, date, start_time, end_time, name, beschreibung } = req.body || {}
		const authUserId = req.user.id
		const participantEmails = parseParticipantsFromBody(req.body)

		if ((!room && !room_id) || !date || !start_time || !end_time || !name) {
			return res.status(400).json({ error: 'Felder (room oder room_id), date, start_time, end_time, name sind erforderlich' })
		}
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

		if (await hasConflict(raumId, startTs, endTs)) {
			return res.status(409).json({ error: 'Zeitfenster belegt' })
		}

		const status = 'Geplant'
		const prioritaet = 1
		const nameFinal = String(name || '').trim()
		const beschreibungFinal = String(beschreibung || '').trim() || null

		const conn = await pool.getConnection()
		try {
			await conn.beginTransaction()
			const [ins] = await conn.query(
				'INSERT INTO Buchungen (Raum_Id, Startzeit, Endzeit, Status, Prioritaet, Name, Beschreibung) VALUES (?, ?, ?, ?, ?, ?, ?)',
				[raumId, startTs, endTs, status, prioritaet, nameFinal, beschreibungFinal]
			)
			const bookingId = ins.insertId

			const { users, unknown } = await resolveUserIdsByEmails(participantEmails)
			if (unknown.length) {
				await conn.rollback()
				return res.status(400).json({ error: `Unbekannte Teilnehmer: ${unknown.join(', ')}`, unknown })
			}

			const userIds = Array.from(new Set([authUserId, ...users.map((u) => u.id)].filter((x) => Number.isFinite(Number(x)))))
			for (const uid of userIds) {
				try {
					await conn.query('INSERT INTO Buchung_Benutzer (Buchung_Id, Benutzer_Id) VALUES (?, ?)', [bookingId, uid])
				} catch (_) {}
			}

			await conn.commit()
			return res.status(201).json({ id: bookingId })
		} finally {
			conn.release()
		}
	} catch (err) {
		console.error('POST /api/bookings error:', err)
		res.status(500).json({ error: 'Fehler beim Speichern der Buchung' })
	}
})

// Resolve Mitarbeiter role id from existing roles table (capitalized: Rollen)
async function getMitarbeiterRoleId() {
	const [rows] = await pool.query('SELECT Rollen_Id AS id FROM Rollen WHERE Name = ? LIMIT 1', ['Mitarbeiter'])
	if (rows.length) return rows[0].id
	// Fallback: Rolle anlegen, falls nicht vorhanden
	const [ins] = await pool.query('INSERT INTO Rollen (Name, Prioritaet) VALUES (?, ?)', ['Mitarbeiter', 1])
	return ins.insertId
}

// Registration: creates entry in `Benutzer`, default role = Mitarbeiter
app.post('/register', async (req, res) => {
	try {
		const { email, password, vorname, nachname, abteilung_id } = req.body || {}
		if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' })
		if (!password) return res.status(400).json({ error: 'Passwort erforderlich' })
		if (String(password).length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' })
		if (!vorname || !nachname) return res.status(400).json({ error: 'Vorname und Nachname erforderlich' })

		const [existing] = await pool.query('SELECT Benutzer_Id AS id FROM Benutzer WHERE Email = ? LIMIT 1', [email])
		if (existing.length) return res.status(409).json({ error: 'E-Mail ist bereits registriert' })

		const deptId = await ensureDefaultDepartmentId(abteilung_id)
		const roleId = await getMitarbeiterRoleId()
		const pwHash = hashPassword(password)

		const [result] = await pool.query(
			'INSERT INTO Benutzer (Vorname, Nachname, Email, Passwort_Hash, Rollen_Id, Abteilung_Id) VALUES (?, ?, ?, ?, ?, ?)',
			[String(vorname), String(nachname), String(email), pwHash, roleId, deptId]
		)

		const token = signToken({ uid: result.insertId, iat: Date.now(), exp: Date.now() + (7 * 24 * 60 * 60 * 1000) })
		const info = await getUserRoleInfo(result.insertId)
		return res.status(201).json({
			benutzer_id: result.insertId,
			email,
			rollen_id: roleId,
			rollen_name: info?.rollen_name || null,
			prioritaet: info?.prioritaet ?? null,
			is_admin: isAdminRole(info),
			token,
		})
	} catch (err) {
		console.error('POST /register error:', err)
		res.status(500).json({ error: 'Registrierung fehlgeschlagen' })
	}
})

app.post('/api/register', async (req, res) => {
	try {
		const { email, password, vorname, nachname, abteilung_id } = req.body || {}
		if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' })
		if (!password) return res.status(400).json({ error: 'Passwort erforderlich' })
		if (String(password).length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' })
		if (!vorname || !nachname) return res.status(400).json({ error: 'Vorname und Nachname erforderlich' })

		const [existing] = await pool.query('SELECT Benutzer_Id AS id FROM Benutzer WHERE Email = ? LIMIT 1', [email])
		if (existing.length) return res.status(409).json({ error: 'E-Mail ist bereits registriert' })

		const deptId = await ensureDefaultDepartmentId(abteilung_id)
		const roleId = await getMitarbeiterRoleId()
		const pwHash = hashPassword(password)

		const [result] = await pool.query(
			'INSERT INTO Benutzer (Vorname, Nachname, Email, Passwort_Hash, Rollen_Id, Abteilung_Id) VALUES (?, ?, ?, ?, ?, ?)',
			[String(vorname), String(nachname), String(email), pwHash, roleId, deptId]
		)

		const token = signToken({ uid: result.insertId, iat: Date.now(), exp: Date.now() + (7 * 24 * 60 * 60 * 1000) })
		const info = await getUserRoleInfo(result.insertId)
		return res.status(201).json({
			benutzer_id: result.insertId,
			email,
			rollen_id: roleId,
			rollen_name: info?.rollen_name || null,
			prioritaet: info?.prioritaet ?? null,
			is_admin: isAdminRole(info),
			token,
		})
	} catch (err) {
		console.error('POST /api/register error:', err)
		res.status(500).json({ error: 'Registrierung fehlgeschlagen' })
	}
})

// Login route: verifies password (no auto-create)
app.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body || {}
		if (!email) {
			return res.status(400).json({ error: 'E-Mail erforderlich' })
		}
		if (!password) {
			return res.status(400).json({ error: 'Passwort erforderlich' })
		}

		const [rows] = await pool.query('SELECT Benutzer_Id, Rollen_Id, Passwort_Hash FROM Benutzer WHERE Email = ? LIMIT 1', [email])
		if (!rows.length) {
			return res.status(401).json({ error: 'E-Mail oder Passwort falsch' })
		}
		const user = rows[0]
		if (!verifyPassword(user.Passwort_Hash, password)) {
			return res.status(401).json({ error: 'E-Mail oder Passwort falsch' })
		}

		const token = signToken({ uid: user.Benutzer_Id, iat: Date.now(), exp: Date.now() + (7 * 24 * 60 * 60 * 1000) })
		const info = await getUserRoleInfo(user.Benutzer_Id)
		return res.json({
			benutzer_id: user.Benutzer_Id,
			email,
			rollen_id: user.Rollen_Id,
			rollen_name: info?.rollen_name || null,
			prioritaet: info?.prioritaet ?? null,
			is_admin: isAdminRole(info),
			token,
		})
	} catch (err) {
		console.error('POST /login error:', err)
		res.status(500).json({ error: 'Login fehlgeschlagen' })
	}
})

app.post('/api/login', async (req, res) => {
	try {
		const { email, password } = req.body || {}
		if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' })
		if (!password) return res.status(400).json({ error: 'Passwort erforderlich' })

		const [rows] = await pool.query('SELECT Benutzer_Id, Rollen_Id, Passwort_Hash FROM Benutzer WHERE Email = ? LIMIT 1', [email])
		if (!rows.length) return res.status(401).json({ error: 'E-Mail oder Passwort falsch' })
		const user = rows[0]
		if (!verifyPassword(user.Passwort_Hash, password)) {
			return res.status(401).json({ error: 'E-Mail oder Passwort falsch' })
		}

		const token = signToken({ uid: user.Benutzer_Id, iat: Date.now(), exp: Date.now() + (7 * 24 * 60 * 60 * 1000) })
		const info = await getUserRoleInfo(user.Benutzer_Id)
		return res.json({
			benutzer_id: user.Benutzer_Id,
			email,
			rollen_id: user.Rollen_Id,
			rollen_name: info?.rollen_name || null,
			prioritaet: info?.prioritaet ?? null,
			is_admin: isAdminRole(info),
			token,
		})
	} catch (err) {
		console.error('POST /api/login error:', err)
		res.status(500).json({ error: 'Login fehlgeschlagen' })
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

