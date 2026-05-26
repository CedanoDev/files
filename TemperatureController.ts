// ─────────────────────────────────────────────
// INTERFACE — TemperatureController
//
// Solo maneja HTTP: parsear request, llamar use case,
// devolver response. Nada de lógica de negocio aquí.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  RecordFoodTemperature,
  BuildingNotFoundError,
  UserNotFoundError,
} from '../../use-cases/temperatures/RecordFoodTemperature'

// ── Schema de validación con Zod ─────────────

const recordTemperatureSchema = z.object({
  foodItem: z.string().min(1, 'El nombre del producto es requerido').max(100),
  temperatureC: z.number({
    required_error: 'La temperatura es requerida',
    invalid_type_error: 'La temperatura debe ser un número',
  }),
  isHotFood: z.boolean({
    required_error: 'Debes indicar si es comida caliente o fría',
  }),
  shift: z.enum(['MORNING', 'AFTERNOON', 'CLOSING'], {
    errorMap: () => ({ message: 'Turno inválido' }),
  }),
  notes: z.string().max(500).optional(),
})

// ── Controller ───────────────────────────────

export class TemperatureController {
  constructor(private readonly recordFoodTemperature: RecordFoodTemperature) {}

  // POST /api/temperatures/food
  async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validar body con Zod
      const parsed = recordTemperatureSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          errors: parsed.error.flatten().fieldErrors,
        })
        return
      }

      // buildingId y recordedById vienen del JWT (middleware de auth)
      const buildingId = req.user!.buildingId
      const recordedById = req.user!.id

      if (!buildingId) {
        res.status(403).json({
          success: false,
          message: 'Tu usuario no tiene un edificio asignado.',
        })
        return
      }

      const result = await this.recordFoodTemperature.execute({
        buildingId,
        recordedById,
        ...parsed.data,
      })

      const statusCode = result.wasOutOfRange ? 201 : 201

      res.status(statusCode).json({
        success: true,
        wasOutOfRange: result.wasOutOfRange,
        message: result.message,
        data: result.record,
      })
    } catch (error) {
      if (error instanceof BuildingNotFoundError || error instanceof UserNotFoundError) {
        res.status(404).json({ success: false, message: error.message })
        return
      }
      next(error) // pasa al error handler global de Express
    }
  }

  // GET /api/temperatures/food?buildingId=&fromDate=&toDate=&onlyOutOfRange=
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Solo admins pueden ver otros edificios; employees ven el suyo
      const buildingId =
        req.user!.role === 'ADMIN'
          ? (req.query.buildingId as string | undefined)
          : req.user!.buildingId

      const filters = {
        buildingId,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        onlyOutOfRange: req.query.onlyOutOfRange === 'true',
        shift: req.query.shift as any,
      }

      // Aquí normalmente invocarías un GetTemperatureHistory use case
      // Por ahora retornamos estructura base
      res.status(200).json({
        success: true,
        filters,
        data: [], // el use case GetTemperatureHistory iría aquí
      })
    } catch (error) {
      next(error)
    }
  }
}
