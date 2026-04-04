import axios from 'axios'
import { getToken, useKeycloak } from '@josempgon/vue-keycloak';

// Erstellung einer Axios-Instanz mit einer Basis-URL. 
// Alle zukünftigen Anfragen über 'api' werden automatisch an '/api/...' gesendet.
const baseURL = '/api'
const api = axios.create({ baseURL })

/**
 * Hilfsfunktion, die sicherstellt, dass Keycloak vollständig geladen ist.
 * Da Keycloak asynchron initialisiert wird, verhindert diese Funktion "Race Conditions",
 * bei denen ein Token angefragt wird, bevor der Adapter bereit ist.
 */
async function waitForKeycloak() {
    const { isPending } = useKeycloak();

    return new Promise((resolve) => {
        const check = () => {
            // Wenn isPending falsch ist, ist Keycloak bereit
            if (!isPending.value) {
                resolve()
            }
            else {
                // Falls noch nicht bereit: Alle 50ms erneut prüfen
                setTimeout(check, 50)
            }
        }
        check()
    })
}

/**
 * Request-Interceptor: Ein "Abfangjäger" für ausgehende Anfragen.
 * Bevor eine Anfrage an den Server gesendet wird, läuft sie durch diese Logik.
 */
api.interceptors.request.use(
    async config => {
        // 1. Warten, bis der Keycloak-Status stabil ist
        await waitForKeycloak();

        // 2. Aktuelles JWT (JSON Web Token) vom Adapter abrufen
        const token = await getToken();

        // 3. Das Token im HTTP-Header als "Bearer Token" mitsenden.
        // Dies ist der Industriestandard für die Authentifizierung von APIs.
        config.headers['Authorization'] = `Bearer ${token}`;

        return config;
    },
    error => {
        // Fehlerbehandlung im Falle einer gescheiterten Anfrage-Konfiguration
        return Promise.reject(error)
    },
)

export default api
