// ─────────────────────────────────────────────
// INTERFACE — ChecklistController
// Solo maneja HTTP. Nada de lógica de negocio.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { OpenChecklistSession } from '../../use-cases/checklist/OpenChecklistSession'
import { CompleteChecklistItem } from '../../use-cases/checklist/CompleteChecklistItem'
import { SignChecklistSession, UnauthorizedSignatureError } from '../../use-cases/checklist/SignChecklistSession'
import {
  SessionAlreadyExistsError,
  SessionNotFoundError,
  SessionAlreadySignedError,
  ItemNotFoundError,
  ItemBelongsToDifferentSessionError,
  SessionIncompleteError,
} from '../../domain/entities/Checklist'
import { BuildingNotFoundError } from '../../use-cases/temperatures/RecordFoodTemperature'

// ── Schemas de validación ─────────────────────

const openSessionSchema = z.object({
  shift: z.enum(['MORNING', 'AFTERNOON', 'CLOSING']),
  moment: z.enum(['OPENING', 'DURING', 'CLOSING']),
  sessionDate: z.string().optional(), // ISO date string, ej: "2025-07-04"
})

const completeItemSchema = z.object({
  observation: z.string().max(500).optional(),
})

// ── Controller ────────────────────────────────

export class ChecklistController {
  constructor(
    private readonly openChecklistSession: OpenChecklistSession,
    private readonly completeChecklistItem: CompleteChecklistItem,
    private readonly signChecklistSession: SignChecklistSession
  ) {}

  // POST /api/checklist/sessions
  // Abre (o recupera) una sesión de checklist
  async openSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = openSessionSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const buildingId = req.user!.buildingId
      if (!buildingId) {
        res.status(403).json({ success: false, message: 'Tu usuario no tiene edificio asignado.' })
        return
      }

      const result = await this.openChecklistSession.execute({
        buildingId,
        supervisorId: req.user!.id,
        shift: parsed.data.shift,
        moment: parsed.data.moment,
        sessionDate: parsed.data.sessionDate ? new Date(parsed.data.sessionDate) : undefined,
      })

      res.status(result.isNew ? 201 : 200).json({
        success: true,
        isNew: result.isNew,
        message: result.message,
        data: result.session,
      })
    } catch (error) {
      this.handleChecklistError(error, res, next)
    }
  }

  // GET /api/checklist/sessions/:sessionId
  // Devuelve el detalle de una sesión con todos sus ítems
  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Normalmente invocarías un GetChecklistSessionDetail use case
      // Por ahora retornamos que el endpoint existe
      res.status(200).json({
        success: true,
        message: 'Endpoint disponible. Implementar GetChecklistSessionDetail use case.',
        sessionId: req.params.sessionId,
      })
    } catch (error) {
      next(error)
    }
  }

  // PATCH /api/checklist/sessions/:sessionId/items/:itemId/complete
  // Marca un ítem como completado
  async completeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = completeItemSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors })
        return
      }

      const result = await this.completeChecklistItem.execute({
        sessionId: req.params.sessionId,
        itemId: req.params.itemId,
        completedById: req.user!.id,
        observation: parsed.data.observation,
      })

      res.status(200).json({
        success: true,
        message: result.message,
        completionRate: result.completionRate,
        allCompleted: result.allCompleted,
        data: result.item,
      })
    } catch (error) {
      this.handleChecklistError(error, res, next)
    }
  }

  // POST /api/checklist/sessions/:sessionId/sign
  // Firma digitalmente la sesión (solo supervisor o admin)
  async signSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.signChecklistSession.execute({
        sessionId: req.params.sessionId,
        signedById: req.user!.id,
        signedByRole: req.user!.role,
      })

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.session,
      })
    } catch (error) {
      this.handleChecklistError(error, res, next)
    }
  }

  // ── Manejo centralizado de errores de dominio ──

  private handleChecklistError(error: unknown, res: Response, next: NextFunction): void {
    if (
      error instanceof SessionNotFoundError ||
      error instanceof ItemNotFoundError ||
      error instanceof BuildingNotFoundError
    ) {
      res.status(404).json({ success: false, message: (error as Error).message })
      return
    }

    if (
      error instanceof SessionAlreadySignedError ||
      error instanceof SessionIncompleteError ||
      error instanceof ItemBelongsToDifferentSessionError ||
      error instanceof SessionAlreadyExistsError
    ) {
      res.status(409).json({ success: false, message: (error as Error).message })
      return
    }

    if (error instanceof UnauthorizedSignatureError) {
      res.status(403).json({ success: false, message: (error as Error).message })
      return
    }

    next(error)
  }
}
