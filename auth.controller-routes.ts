// ─────────────────────────────────────────────
// INTERFACE — AuthController + auth.routes.ts
// ─────────────────────────────────────────────

import { Request, Response, NextFunction, Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { Login, RefreshToken, Logout } from '../../use-cases/auth/auth.use-cases'
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserInactiveError,
} from '../../domain/entities/Auth'
import { PrismaAuthRepository } from '../../infrastructure/database/repositories/PrismaAuthRepository'
import { JwtTokenService } from '../../infrastructure/services/JwtTokenService'
import { authMiddleware } from './middlewares/auth.middleware'

// ── Schemas ───────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'El refresh token es requerido'),
})

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
  logoutAll:    z.boolean().optional().default(false),
})

// ── Helpers de cookie ─────────────────────────

const REFRESH_COOKIE = 'storyland_refresh'

const COOKIE_OPTIONS = {
  httpOnly: true,       // no accesible desde JS → protege XSS
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge:   7 * 24 * 60 * 60 * 1000,  // 7 días en ms
  path:     '/api/auth',               // solo se envía en rutas de auth
}

// ── Controller ────────────────────────────────

export class AuthController {
  constructor(
    private readonly loginUC:        Login,
    private readonly refreshTokenUC: RefreshToken,
    private readonly logoutUC:       Logout
  ) {}

  // POST /api/auth/login
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const result = await this.loginUC.execute(parsed.data)

      // Refresh token en cookie HttpOnly (más seguro que en body)
      res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS)

      res.status(200).json({
        success: true,
        user: result.user,
        accessToken: result.tokens.accessToken,
        // NO devolvemos refreshToken en el body — solo en cookie
      })
    } catch (error) {
      this.handleAuthError(error, res, next)
    }
  }

  // POST /api/auth/refresh
  // El cliente envía el refreshToken desde la cookie HttpOnly
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Intentar leer desde cookie primero, luego desde body (compatibilidad)
      const refreshToken =
        req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken

      if (!refreshToken) {
        res.status(401).json({ success: false, message: 'Refresh token requerido.' })
        return
      }

      const result = await this.refreshTokenUC.execute({ refreshToken })

      // Emitir nuevo refresh token en cookie (rotación)
      res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS)

      res.status(200).json({
        success:     true,
        user:        result.user,
        accessToken: result.tokens.accessToken,
      })
    } catch (error) {
      this.handleAuthError(error, res, next)
    }
  }

  // POST /api/auth/logout
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken

      if (refreshToken) {
        await this.logoutUC.execute({
          refreshToken,
          logoutAll: req.body?.logoutAll === true,
          userId:    req.user?.id,
        })
      }

      // Borrar la cookie siempre, aunque el token no exista
      res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTIONS, maxAge: 0 })

      res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' })
    } catch (error) {
      next(error)
    }
  }

  // GET /api/auth/me
  // Devuelve el usuario del JWT actual (sin consultar la BD)
  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      user:    req.user,
    })
  }

  // ── Error handler específico de Auth ──────

  private handleAuthError(error: unknown, res: Response, next: NextFunction): void {
    if (
      error instanceof InvalidCredentialsError ||
      error instanceof InvalidRefreshTokenError
    ) {
      res.status(401).json({ success: false, message: (error as Error).message })
      return
    }
    if (error instanceof UserInactiveError) {
      res.status(403).json({ success: false, message: (error as Error).message })
      return
    }
    next(error)
  }
}

// ── Router ────────────────────────────────────

export function authRouter(prisma: PrismaClient): Router {
  const router       = Router()
  const authRepo     = new PrismaAuthRepository(prisma)
  const tokenService = new JwtTokenService()

  const controller = new AuthController(
    new Login(authRepo, tokenService),
    new RefreshToken(authRepo, tokenService),
    new Logout(authRepo, tokenService)
  )

  // Rutas públicas
  router.post('/login',   (req, res, next) => controller.login(req, res, next))
  router.post('/refresh', (req, res, next) => controller.refresh(req, res, next))

  // Logout: preferimos tener el JWT para auditoría, pero no es obligatorio
  router.post('/logout', (req, res, next) => controller.logout(req, res, next))

  // Ruta protegida: devuelve el usuario actual
  router.get('/me', authMiddleware, (req, res) => controller.me(req, res))

  return router
}
