// ─────────────────────────────────────────────
// INFRASTRUCTURE — JwtTokenService
// Implementa ITokenService con JWT + bcrypt + crypto
// ─────────────────────────────────────────────

import jwt       from 'jsonwebtoken'
import bcrypt    from 'bcryptjs'
import crypto    from 'crypto'
import { AuthUser } from '../../domain/entities/Auth'
import { ITokenService } from '../../domain/repositories/IAuthRepository'

export class JwtTokenService implements ITokenService {
  private readonly jwtSecret:          string
  private readonly accessTokenExpiry:  string
  private readonly refreshTokenBytes:  number

  constructor() {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET no está definido en las variables de entorno.')

    this.jwtSecret         = secret
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN ?? '15m'  // corto: 15 minutos
    this.refreshTokenBytes = 64
  }

  // Access token: JWT firmado con los datos del usuario
  generateAccessToken(user: AuthUser): string {
    return jwt.sign(
      {
        id:         user.id,
        email:      user.email,
        role:       user.role,
        buildingId: user.buildingId,
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    )
  }

  // Refresh token: bytes aleatorios criptográficamente seguros (no JWT)
  // Así podemos revocarlo en la BD sin necesidad de lista negra de JWTs
  generateRefreshToken(): string {
    return crypto.randomBytes(this.refreshTokenBytes).toString('hex')
  }

  // Verifica el access token y devuelve el payload o null si es inválido
  verifyAccessToken(token: string): AuthUser | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any
      return {
        id:         payload.id,
        name:       payload.name ?? '',
        email:      payload.email,
        role:       payload.role,
        buildingId: payload.buildingId ?? null,
      }
    } catch {
      return null
    }
  }

  // Hash SHA-256 del refresh token para guardarlo en la BD
  // Nunca guardamos el token plano
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  // Comparación segura de contraseña con bcrypt
  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash)
  }
}
