import nodemailer from 'nodemailer'
import { Liquid } from 'liquidjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const liquidEngine = new Liquid({
    root: path.join(__dirname, 'templates'),
    extname: '.liquid',
})

const mailHost = process.env.SMTP_HOST || process.env.MAIL_HOST
const mailPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587)
const mailSecure = String(process.env.SMTP_SECURE || process.env.MAIL_SECURE || 'false').toLowerCase() === 'true'
const mailUser = process.env.SMTP_USER || process.env.MAIL_USER
const rawMailPass = process.env.SMTP_PASS || process.env.MAIL_PASS
const mailPass = rawMailPass ? String(rawMailPass).replace(/\s+/g, '') : undefined

const mailTransporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailSecure,
    auth: mailUser
        ? {
            user: mailUser,
            pass: mailPass,
        }
        : undefined,
})

export async function sendMail(to, subject, templateName, contextData = {}) {
    if (!to) {
        throw new Error('sendMail: Empfängeradresse fehlt')
    }

    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || mailUser
    if (!from) {
        throw new Error('sendMail: MAIL_FROM/SMTP_FROM/SMTP_USER/MAIL_USER ist nicht gesetzt')
    }

    if (!mailHost) {
        throw new Error('sendMail: SMTP_HOST/MAIL_HOST ist nicht gesetzt')
    }

    const html = await liquidEngine.renderFile(templateName, contextData)

    return mailTransporter.sendMail({
        from,
        to,
        subject,
        html,
    })
}
