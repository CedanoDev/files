// ─────────────────────────────────────────────
// MIDDLEWARE — auth.middleware.ts
// Verifica el JWT y agrega req.user
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  id: string
  email: string
  role: 'ADMIN' | 'SUPERVISOR' | 'EMPLOYEE'
  buildingId: string | null
}

// Extender el tipo de Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token requerido' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token inválido o expirado' })
  }
}
