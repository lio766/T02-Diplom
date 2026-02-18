import jwt from 'jsonwebtoken'

export async function authenticate(req, res, next) {
    const bearerHeader = req.headers["authorization"];
    const token = bearerHeader && bearerHeader.split(' ')[1];
    console.log('Received token:', token);
    if (token == null) {
        console.error('No token provided');
        return res.sendStatus(401);
    }
    const decoded = jwt.decode(token, { complete: true });
    console.log(decoded.payload.iss);

    try {
        const response = await fetchWithRetry('http://keycloak:8080/auth/realms/agora/');
        const data = await response.json();
        const publicKey = "-----BEGIN PUBLIC KEY-----\n" + data.public_key + "\n-----END PUBLIC KEY-----";
        console.log('Fetched public key:', publicKey);

        jwt.verify(token, publicKey, {
            issuer: 'http://localhost:8080/auth/realms/agora',
            algorithms: ['RS256']
        }, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err.message);
                return res.status(401).json({ error: 'Invalid token' });
            }

            req.user = decoded;
            console.log('Decoded token:', decoded);
            next();
        });
    } catch (err) {
        console.error('Error fetching public key or verifying token:', err.message);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}
async function fetchWithRetry(url, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return res;
        } catch (e) { }

        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error("Keycloak not reachable");
}
