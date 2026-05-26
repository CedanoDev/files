// ─────────────────────────────────────────────
// INTERFACE — WasteController + waste.routes.ts
// ─────────────────────────────────────────────

import { Request, Response, NextFunction, Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { RecordWaste } from '../../use-cases/waste/RecordWaste'
import { GetWasteTrends } from '../../use-cases/waste/GetWasteTrends'
import { InvalidWasteQuantityError } from '../../domain/entities/Waste'
import { BuildingNotFoundError } from '../../use-cases/temperatures/RecordFoodTemperature'
import { PrismaWasteRepository } from '../../infrastructure/database/repositories/PrismaWasteRepository'
import { PrismaTemperatureRepository } from '../../infrastructure/database/repositories/PrismaTemperatureRepository'
import { authMiddleware } from './middlewares/auth.middleware'
import { requireRole } from './middlewares/role.middleware'

// ── Schemas ───────────────────────────────────

const recordWasteSchema = z.object({
  productName: z.string().min(1).max(100),
  quantityKg: z.number().positive().optional(),
  quantityUnits: z.number().int().positive().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  discardReason: z.enum([
    'EXPIRED', 'TEMP_VIOLATION', 'OVERPRODUCTION', 'DAMAGED', 'OTHER',
  ]),
  shift: z.enum(['MORNING', 'AFTERNOON', 'CLOSING']),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.quantityKg !== undefined || data.quantityUnits !== undefined,
  { message: 'Debes indicar la cantidad en kg o en unidades.' }
)

const trendsQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
  buildingId: z.string().uuid().optional(),
})

// ── Controller ────────────────────────────────

export class WasteController {
  constructor(
    private readonly recordWaste: RecordWaste,
    private readonly getWasteTrends: GetWasteTrends,
    private readonly wasteRepo: PrismaWasteRepository
  ) {}

  // POST /api/waste
  async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = recordWasteSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const buildingId = req.user!.buildingId
      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Sin edificio asignado.' })
        return
      }

      const result = await this.recordWaste.execute({
        buildingId,
        recordedById: req.user!.id,
        ...parsed.data,
      })

      res.status(201).json({
        success: true,
        wasTempRelated: result.wasTempRelated,
        estimatedCost: result.estimatedCost,
        message: result.message,
        data: result.log,
      })
    } catch (error) {
      this.handleError(error, res, next)
    }
  }

  // GET /api/waste?fromDate=&toDate=&shift=&discardReason=
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId =
        req.user!.role === 'ADMIN'
          ? (req.query.buildingId as string) ?? req.user!.buildingId
          : req.user!.buildingId

      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Sin edificio asignado.' })
        return
      }

      const logs = await this.wasteRepo.findWasteLogs({
        buildingId,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        shift: req.query.shift as any,
        discardReason: req.query.discardReason as any,
      })

      res.status(200).json({ success: true, data: logs })
    } catch (error) {
      next(error)
    }
  }

  // GET /api/waste/trends?fromDate=&toDate=&buildingId=
  async trends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = trendsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const buildingId =
        req.user!.role === 'ADMIN'
          ? parsed.data.buildingId ?? req.user!.buildingId
          : req.user!.buildingId

      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Sin edificio asignado.' })
        return
      }

      const result = await this.getWasteTrends.execute({
        buildingId,
        fromDate: new Date(parsed.data.fromDate),
        toDate: new Date(parsed.data.toDate),
      })

      res.status(200).json({ success: true, ...result })
    } catch (error) {
      this.handleError(error, res, next)
    }
  }

  private handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof BuildingNotFoundError) {
      res.status(404).json({ success: false, message: (error as Error).message })
      return
    }
    if (error instanceof InvalidWasteQuantityError) {
      res.status(400).json({ success: false, message: (error as Error).message })
      return
    }
    next(error)
  }
}

// ── Router ────────────────────────────────────

export function wasteRouter(prisma: PrismaClient): Router {
  const router = Router()
  const wasteRepo = new PrismaWasteRepository(prisma)
  const tempRepo  = new PrismaTemperatureRepository(prisma)
  const buildingRepo = { findById: (id: string) => prisma.building.findUnique({ where: { id } }) }

  const controller = new WasteController(
    new RecordWaste(wasteRepo, tempRepo, buildingRepo),
    new GetWasteTrends(wasteRepo, buildingRepo),
    wasteRepo
  )

  router.use(authMiddleware)

  // Registrar desperdicio (todos los roles)
  router.post('/', requireRole(['EMPLOYEE', 'SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.record(req, res, next))

  // Listar registros
  router.get('/', requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.list(req, res, next))

  // Tendencias para el dashboard
  router.get('/trends', requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.trends(req, res, next))

  return router
}
