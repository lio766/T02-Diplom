const express = require('express')
const mysql = require('mysql2/promise')
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 3000

// Simple CORS for development (Vite runs on 5173)
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*')
	res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
	res.header('Access-Control-Allow-Headers', 'Content-Type')
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

app.get('/bookings', async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT 
				 b.Buchung_Id AS id,
				 r.Bezeichnung AS room,
				 DATE_FORMAT(b.Startzeit, '%Y-%m-%d') AS date,
				 DATE_FORMAT(b.Startzeit, '%H:%i') AS start_time,
				 DATE_FORMAT(b.Endzeit, '%H:%i') AS end_time,
				 TRIM(CONCAT(COALESCE(u.Vorname,''), ' ', COALESCE(u.Nachname,''))) AS person
			 FROM Buchungen b
			 JOIN Raum r ON r.Raum_Id = b.Raum_Id
			 LEFT JOIN Buchung_Benutzer bb ON bb.Buchung_Id = b.Buchung_Id
			 LEFT JOIN Benutzer u ON u.Benutzer_Id = bb.Benutzer_Id
			 ORDER BY b.Startzeit DESC`
		)
		const data = rows.map((r) => ({
			id: r.id,
			room: r.room,
			date: r.date,
			start_time: r.start_time,
			end_time: r.end_time,
			person: r.person || ''
		}))
		res.json(data)
	} catch (err) {
		console.error('GET /bookings error:', err)
		res.status(500).json({ error: 'Fehler beim Laden der Buchungen' })
	}
})

// POST /bookings -> create booking, optional link to Benutzer
app.post('/bookings', async (req, res) => {
	try {
		const { room, room_id, date, start_time, end_time, person } = req.body || {}
		if ((!room && !room_id) || !date || !start_time || !end_time) {
			return res.status(400).json({ error: 'Felder (room oder room_id), date, start_time, end_time sind erforderlich' })
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

		const [ins] = await pool.query(
			'INSERT INTO Buchungen (Raum_Id, Startzeit, Endzeit, Status, Prioritaet) VALUES (?, ?, ?, ?, ?)',
			[raumId, startTs, endTs, status, prioritaet]
		)

		// Optional person mapping
		const benutzerId = await findBenutzerByName(person)
		if (benutzerId) {
			try {
				await pool.query(
					'INSERT INTO Buchung_Benutzer (Buchung_Id, Benutzer_Id) VALUES (?, ?)',
					[ins.insertId, benutzerId]
				)
			} catch (_) {}
		}

		return res.status(201).json({ id: ins.insertId })
	} catch (err) {
		console.error('POST /bookings error:', err)
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

// Login route: creates entry in `Benutzer` if not existing, default role = Mitarbeiter
app.post('/login', async (req, res) => {
	try {
		const { email, vorname, nachname, abteilung_id } = req.body || {}
		if (!email) {
			return res.status(400).json({ error: 'E-Mail erforderlich' })
		}

		// Ensure Abteilung_Id is present; default to 'Allgemein'
		let deptId = abteilung_id
		if (deptId == null) {
			const [deptRows] = await pool.query('SELECT Abteilung_Id AS id FROM Abteilungen WHERE Name = ? LIMIT 1', ['Allgemein'])
			if (!deptRows.length) {
				const [insertDept] = await pool.query('INSERT INTO Abteilungen (Name, Parent_Abt) VALUES (?, ?)', ['Allgemein', null])
				deptId = insertDept.insertId
			} else {
				deptId = deptRows[0].id
			}
		}

		const [existing] = await pool.query('SELECT Benutzer_Id, Rollen_Id, Abteilung_Id FROM Benutzer WHERE Email = ? LIMIT 1', [email])
		if (!existing.length) {
			const roleId = await getMitarbeiterRoleId()
			const [result] = await pool.query(
				'INSERT INTO Benutzer (Vorname, Nachname, Email, Rollen_Id, Abteilung_Id) VALUES (?, ?, ?, ?, ?)',
				[vorname || '', nachname || '', email, roleId, deptId]
			)
			return res.status(201).json({ benutzer_id: result.insertId, email, rollen_id: roleId, newUser: true })
		}

		const user = existing[0]
		return res.json({ benutzer_id: user.Benutzer_Id, email, rollen_id: user.Rollen_Id, newUser: false })
	} catch (err) {
		console.error('POST /login error:', err)
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

