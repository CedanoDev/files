// ─────────────────────────────────────────────
// MIDDLEWARE — role.middleware.ts
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { JwtPayload } from './auth.middleware'

type Role = 'ADMIN' | 'SUPERVISOR' | 'EMPLOYEE'

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as JwtPayload | undefined

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción.',
      })
      return
    }

    next()
  }
}
