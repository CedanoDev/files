// ─────────────────────────────────────────────
// USE CASES — Auth (Login · RefreshToken · Logout)
// ─────────────────────────────────────────────

import {
  TokenPair,
  AuthUser,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserInactiveError,
} from '../../domain/entities/Auth'
import { IAuthRepository, ITokenService } from '../../domain/repositories/IAuthRepository'

// ══════════════════════════════════════════════
// USE CASE: Login
// ══════════════════════════════════════════════

export interface LoginInput {
  email:    string
  password: string
}

export interface LoginOutput {
  user:   AuthUser
  tokens: TokenPair
}

export class Login {
  // Refresh token expira en 7 días
  private static readonly REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

  constructor(
    private readonly authRepo:     IAuthRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    // 1. Buscar usuario por email
    const record = await this.authRepo.findUserByEmail(input.email.toLowerCase().trim())

    // Error genérico: no revelar si el email existe o no
    if (!record) throw new InvalidCredentialsError()

    // 2. Verificar contraseña
    const isValid = await this.tokenService.comparePassword(input.password, record.passwordHash)
    if (!isValid) throw new InvalidCredentialsError()

    // 3. Verificar que la cuenta está activa
    if (!record.isActive) throw new UserInactiveError()

    // 4. Generar par de tokens
    const user: AuthUser = {
      id:         record.id,
      name:       record.name,
      email:      record.email,
      role:       record.role,
      buildingId: record.buildingId,
    }

    const accessToken  = this.tokenService.generateAccessToken(user)
    const refreshToken = this.tokenService.generateRefreshToken()
    const tokenHash    = this.tokenService.hashToken(refreshToken)

    const expiresAt = new Date(Date.now() + Login.REFRESH_TOKEN_TTL_MS)
    await this.authRepo.saveRefreshToken(record.id, tokenHash, expiresAt)

    return {
      user,
      tokens: { accessToken, refreshToken },
    }
  }
}

// ══════════════════════════════════════════════
// USE CASE: RefreshToken
// ══════════════════════════════════════════════

export interface RefreshTokenInput {
  refreshToken: string
}

export interface RefreshTokenOutput {
  tokens: TokenPair
  user:   AuthUser
}

export class RefreshToken {
  private static readonly REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

  constructor(
    private readonly authRepo:     IAuthRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const tokenHash = this.tokenService.hashToken(input.refreshToken)

    // 1. Buscar el token en la base de datos
    const record = await this.authRepo.findRefreshToken(tokenHash)

    if (!record)              throw new InvalidRefreshTokenError()
    if (record.revokedAt)     throw new InvalidRefreshTokenError()
    if (record.expiresAt < new Date()) throw new InvalidRefreshTokenError()

    // 2. Buscar el usuario
    const userRecord = await this.authRepo.findUserById(record.userId)
    if (!userRecord || !userRecord.isActive) throw new InvalidRefreshTokenError()

    const user: AuthUser = {
      id:         userRecord.id,
      name:       userRecord.name,
      email:      userRecord.email,
      role:       userRecord.role,
      buildingId: userRecord.buildingId,
    }

    // 3. Rotación de tokens: revocar el anterior, emitir uno nuevo
    // (si el token es robado, no puede usarse dos veces)
    await this.authRepo.revokeRefreshToken(tokenHash)

    const newAccessToken  = this.tokenService.generateAccessToken(user)
    const newRefreshToken = this.tokenService.generateRefreshToken()
    const newTokenHash    = this.tokenService.hashToken(newRefreshToken)

    const expiresAt = new Date(Date.now() + RefreshToken.REFRESH_TOKEN_TTL_MS)
    await this.authRepo.saveRefreshToken(user.id, newTokenHash, expiresAt)

    return {
      user,
      tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    }
  }
}

// ══════════════════════════════════════════════
// USE CASE: Logout
// ══════════════════════════════════════════════

export interface LogoutInput {
  refreshToken: string
  logoutAll?:   boolean  // true = cerrar sesión en todos los dispositivos
  userId?:      string   // requerido si logoutAll=true
}

export class Logout {
  constructor(
    private readonly authRepo:     IAuthRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (input.logoutAll && input.userId) {
      // Revocar TODOS los refresh tokens del usuario
      await this.authRepo.revokeAllUserTokens(input.userId)
      return
    }

    // Revocar solo este refresh token
    const tokenHash = this.tokenService.hashToken(input.refreshToken)
    await this.authRepo.revokeRefreshToken(tokenHash)
    // No lanzar error si el token ya no existe — logout es idempotente
  }
}
