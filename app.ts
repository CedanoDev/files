// ─────────────────────────────────────────────
// INTERFACE — app.ts
// Setup de Express: middlewares globales + rutas
// ─────────────────────────────────────────────

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'
import { temperatureRouter } from './routes/temperature.routes'
// import { checklistRouter } from './routes/checklist.routes'
// import { stockRouter }      from './routes/stock.routes'
// import { wasteRouter }      from './routes/waste.routes'
// import { reportRouter }     from './routes/report.routes'
// import { authRouter }       from './routes/auth.routes'

export function createApp(prisma: PrismaClient) {
  const app = express()

  // ── Middlewares globales ──────────────────
  app.use(helmet())
  app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
  app.use(express.json())

  // ── Health check ─────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ── Rutas de la API ───────────────────────
  app.use('/api/temperatures', temperatureRouter(prisma))
  // app.use('/api/checklist',    checklistRouter(prisma))
  // app.use('/api/stock',        stockRouter(prisma))
  // app.use('/api/waste',        wasteRouter(prisma))
  // app.use('/api/reports',      reportRouter(prisma))
  // app.use('/api/auth',         authRouter(prisma))

  // ── Error handler global ──────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ERROR]', err)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      ...(process.env.NODE_ENV === 'development' && { error: err.message }),
    })
  })

  return app
}

// ─────────────────────────────────────────────
// server.ts — arranque del servidor
// ─────────────────────────────────────────────

const prisma = new PrismaClient()

async function main() {
  const app = createApp(prisma)
  const PORT = process.env.PORT ?? 3001

  app.listen(PORT, () => {
    console.log(`Server corriendo en http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
