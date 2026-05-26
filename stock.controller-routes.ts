// ─────────────────────────────────────────────
// INTERFACE — StockController + stock.routes.ts
// ─────────────────────────────────────────────

import { Request, Response, NextFunction, Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { CreateStockRequest } from '../../use-cases/stock/CreateStockRequest'
import { GetStockSuggestion } from '../../use-cases/stock/GetStockSuggestion'
import {
  StockRequestNotFoundError,
  InvalidStatusTransitionError,
  EmptyStockRequestError,
  assertValidTransition,
} from '../../domain/entities/Stock'
import { BuildingNotFoundError } from '../../use-cases/temperatures/RecordFoodTemperature'
import { PrismaStockRepository } from '../../infrastructure/database/repositories/PrismaStockRepository'
import { authMiddleware } from './middlewares/auth.middleware'
import { requireRole } from './middlewares/role.middleware'

// ── Schemas ───────────────────────────────────

const createRequestSchema = z.object({
  notes: z.string().max(500).optional(),
  requestDate: z.string().optional(),
  items: z
    .array(
      z.object({
        productName: z.string().min(1).max(100),
        unit: z.string().min(1).max(20),
        quantityRequested: z.number().positive('La cantidad debe ser mayor a 0'),
      })
    )
    .min(1, 'Debe incluir al menos un producto'),
})

const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'DISPATCHED', 'CANCELLED']),
})

// ── Controller ────────────────────────────────

export class StockController {
  constructor(
    private readonly createStockRequest: CreateStockRequest,
    private readonly getStockSuggestion: GetStockSuggestion,
    private readonly stockRepo: PrismaStockRepository
  ) {}

  // GET /api/stock/suggestions
  // Devuelve sugerencias basadas en historial de desperdicio
  async getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.user!.role === 'ADMIN'
        ? (req.query.buildingId as string) ?? req.user!.buildingId
        : req.user!.buildingId

      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Sin edificio asignado.' })
        return
      }

      const lookbackDays = req.query.days ? parseInt(req.query.days as string) : undefined

      const result = await this.getStockSuggestion.execute({ buildingId, lookbackDays })

      res.status(200).json({
        success: true,
        hasEnoughData: result.hasEnoughData,
        basedOnDays: result.basedOnDays,
        message: result.message,
        data: result.suggestions,
      })
    } catch (error) {
      this.handleError(error, res, next)
    }
  }

  // POST /api/stock/requests
  // Crea una solicitud de stock en estado DRAFT
  async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const buildingId = req.user!.buildingId
      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Sin edificio asignado.' })
        return
      }

      const result = await this.createStockRequest.execute({
        buildingId,
        createdById: req.user!.id,
        notes: parsed.data.notes,
        requestDate: parsed.data.requestDate ? new Date(parsed.data.requestDate) : undefined,
        items: parsed.data.items,
      })

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.request,
        itemsWithSuggestions: result.itemsWithSuggestions,
      })
    } catch (error) {
      this.handleError(error, res, next)
    }
  }

  // GET /api/stock/requests
  // Lista solicitudes del edificio
  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.user!.role === 'ADMIN'
        ? (req.query.buildingId as string) ?? req.user!.buildingId
        : req.user!.buildingId

      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Sin edificio asignado.' })
        return
      }

      const requests = await this.stockRepo.findRequestsByBuilding(buildingId)
      res.status(200).json({ success: true, data: requests })
    } catch (error) {
      next(error)
    }
  }

  // PATCH /api/stock/requests/:id/status
  // Avanza el estado: DRAFT → SUBMITTED → DISPATCHED
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateStatusSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const request = await this.stockRepo.findRequestById(req.params.id)
      if (!request) throw new StockRequestNotFoundError(req.params.id)

      // Verificar transición válida
      assertValidTransition(request.status, parsed.data.status)

      const updated = await this.stockRepo.updateStatus(
        req.params.id,
        parsed.data.status,
        new Date()
      )

      res.status(200).json({
        success: true,
        message: `Estado actualizado a ${parsed.data.status}.`,
        data: updated,
      })
    } catch (error) {
      this.handleError(error, res, next)
    }
  }

  // ── Error handler ─────────────────────────

  private handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof StockRequestNotFoundError || error instanceof BuildingNotFoundError) {
      res.status(404).json({ success: false, message: (error as Error).message })
      return
    }
    if (
      error instanceof InvalidStatusTransitionError ||
      error instanceof EmptyStockRequestError
    ) {
      res.status(409).json({ success: false, message: (error as Error).message })
      return
    }
    next(error)
  }
}

// ── Router ────────────────────────────────────

export function stockRouter(prisma: PrismaClient): Router {
  const router = Router()
  const stockRepo = new PrismaStockRepository(prisma)
  const buildingRepo = { findById: (id: string) => prisma.building.findUnique({ where: { id } }) }

  const controller = new StockController(
    new CreateStockRequest(stockRepo, buildingRepo),
    new GetStockSuggestion(stockRepo, buildingRepo),
    stockRepo
  )

  router.use(authMiddleware)

  // Sugerencias basadas en historial de desperdicio
  router.get('/suggestions', requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.getSuggestions(req, res, next))

  // CRUD de solicitudes
  router.get('/requests', requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.listRequests(req, res, next))

  router.post('/requests', requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.createRequest(req, res, next))

  router.patch('/requests/:id/status', requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.updateStatus(req, res, next))

  return router
}
