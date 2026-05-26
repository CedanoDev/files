// ─────────────────────────────────────────────
// INTERFACE — checklist.routes.ts
// ─────────────────────────────────────────────

import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { PrismaChecklistRepository } from '../../infrastructure/database/repositories/PrismaChecklistRepository'
import { OpenChecklistSession } from '../../use-cases/checklist/OpenChecklistSession'
import { CompleteChecklistItem } from '../../use-cases/checklist/CompleteChecklistItem'
import { SignChecklistSession } from '../../use-cases/checklist/SignChecklistSession'
import { ChecklistController } from '../controllers/ChecklistController'

function buildController(prisma: PrismaClient): ChecklistController {
  const checklistRepo = new PrismaChecklistRepository(prisma)

  const buildingRepo = {
    findById: (id: string) => prisma.building.findUnique({ where: { id } }),
  }

  return new ChecklistController(
    new OpenChecklistSession(checklistRepo, buildingRepo),
    new CompleteChecklistItem(checklistRepo),
    new SignChecklistSession(checklistRepo)
  )
}

export function checklistRouter(prisma: PrismaClient): Router {
  const router = Router()
  const controller = buildController(prisma)

  router.use(authMiddleware)

  // Abrir / recuperar sesión de checklist
  // POST /api/checklist/sessions
  router.post(
    '/sessions',
    requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.openSession(req, res, next)
  )

  // Ver detalle de una sesión
  // GET /api/checklist/sessions/:sessionId
  router.get(
    '/sessions/:sessionId',
    requireRole(['EMPLOYEE', 'SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.getSession(req, res, next)
  )

  // Completar un ítem (cualquier empleado del edificio)
  // PATCH /api/checklist/sessions/:sessionId/items/:itemId/complete
  router.patch(
    '/sessions/:sessionId/items/:itemId/complete',
    requireRole(['EMPLOYEE', 'SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.completeItem(req, res, next)
  )

  // Firmar la sesión (solo supervisor o admin)
  // POST /api/checklist/sessions/:sessionId/sign
  router.post(
    '/sessions/:sessionId/sign',
    requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.signSession(req, res, next)
  )

  return router
}
