// ─────────────────────────────────────────────
// INTERFACE — temperature.routes.ts
// Conecta rutas HTTP → middlewares → controller
// ─────────────────────────────────────────────

import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { PrismaTemperatureRepository } from '../../infrastructure/database/repositories/PrismaTemperatureRepository'
import { NodemailerEmailService } from '../../infrastructure/services/EmailService'
import { RecordFoodTemperature } from '../../use-cases/temperatures/RecordFoodTemperature'
import { TemperatureController } from '../controllers/TemperatureController'

// Dependency Injection manual (sin framework DI)
// En producción podrías usar tsyringe o inversify
function buildController(prisma: PrismaClient): TemperatureController {
  const temperatureRepo = new PrismaTemperatureRepository(prisma)
  const emailService = new NodemailerEmailService()

  // PrismaUserRepository y PrismaBuildingRepository seguirían el mismo patrón
  const userRepo = {
    findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  }
  const buildingRepo = {
    findById: (id: string) => prisma.building.findUnique({ where: { id } }),
  }

  const useCase = new RecordFoodTemperature(
    temperatureRepo,
    buildingRepo,
    userRepo,
    emailService,
    process.env.ADMIN_ALERT_EMAIL ?? 'admin@storyland.com'
  )

  return new TemperatureController(useCase)
}

export function temperatureRouter(prisma: PrismaClient): Router {
  const router = Router()
  const controller = buildController(prisma)

  // Todas las rutas requieren JWT válido
  router.use(authMiddleware)

  // Registrar temperatura de comida
  // Empleados y supervisores pueden registrar
  router.post(
    '/food',
    requireRole(['EMPLOYEE', 'SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.record(req, res, next)
  )

  // Listar temperaturas con filtros
  router.get(
    '/food',
    requireRole(['SUPERVISOR', 'ADMIN']),
    (req, res, next) => controller.list(req, res, next)
  )

  return router
}
