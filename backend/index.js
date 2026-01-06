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

