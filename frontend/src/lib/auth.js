const STORAGE_KEY = 'agora_auth'

export function getAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.token) return null
    return parsed
  } catch {
    return null
  }
}

export function getToken() {
  return getAuth()?.token || ''
}

export function setAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}
