// ─────────────────────────────────────────────
// DOMAIN — IAuthRepository + ITokenService
// ─────────────────────────────────────────────

import { AuthUser, RefreshTokenRecord, TokenPair } from '../entities/Auth'

// ── Repositorio ───────────────────────────────

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string; isActive: boolean }) | null>
  findUserById(id: string): Promise<(AuthUser & { isActive: boolean }) | null>
  saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshTokenRecord>
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>
  revokeRefreshToken(tokenHash: string): Promise<void>
  revokeAllUserTokens(userId: string): Promise<void>  // para logout de todos los dispositivos
}

// ── Servicio de tokens ────────────────────────

export interface ITokenService {
  generateAccessToken(user: AuthUser): string
  generateRefreshToken(): string   // UUID seguro
  verifyAccessToken(token: string): AuthUser | null
  hashToken(token: string): string
  comparePassword(plain: string, hash: string): Promise<boolean>
}
