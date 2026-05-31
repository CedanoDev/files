// ─────────────────────────────────────────────
// DOMAIN ENTITIES — Auth
// ─────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'EMPLOYEE'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  buildingId: string | null
}

export interface TokenPair {
  accessToken:  string   // expira en 15min
  refreshToken: string   // expira en 7 días
}

export interface RefreshTokenRecord {
  id:        string
  userId:    string
  tokenHash: string      // guardamos el hash, nunca el token plano
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
}

// ── Errores de dominio ────────────────────────

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email o contraseña incorrectos.')
    this.name = 'InvalidCredentialsError'
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Token de refresco inválido o expirado.')
    this.name = 'InvalidRefreshTokenError'
  }
}

export class UserInactiveError extends Error {
  constructor() {
    super('Tu cuenta está desactivada. Contacta al administrador.')
    this.name = 'UserInactiveError'
  }
}
