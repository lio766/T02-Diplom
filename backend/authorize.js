export function requireRole(role) {
    return (req, res, next) => {

        console.log('Checking role:', role, 'for user:', req.user)
        if (!req.user || !Array.isArray(req.user.realm_access.roles)) {
            return res.status(401).json({ error: 'Nicht authoriziert' })
        }

        if (!req.user.realm_access.roles.includes(role)) {
            return res.status(403).json({ error: 'Keine Berechtigung' })
        }
        next()
    }
}
