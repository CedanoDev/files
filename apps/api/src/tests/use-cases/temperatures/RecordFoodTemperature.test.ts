// ─────────────────────────────────────────────
// tests/use-cases/temperatures/RecordFoodTemperature.test.ts
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  RecordFoodTemperature,
  BuildingNotFoundError,
  UserNotFoundError,
} from '../../../use-cases/temperatures/RecordFoodTemperature'
import { TemperatureRange } from '../../../domain/entities/FoodTemperature'
import {
  makeMockTemperatureRepo,
  makeMockBuildingRepo,
  makeMockUserRepo,
  makeMockEmailService,
  makeFoodTemperature,
  makeBuilding,
  makeUser,
} from '../../helpers/factories'

// ─────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────

function makeUseCase(overrides: {
  buildingExists?: boolean
  userExists?: boolean
} = {}) {
  const temperatureRepo = makeMockTemperatureRepo()
  const buildingRepo    = makeMockBuildingRepo(overrides.buildingExists ?? true)
  const userRepo        = makeMockUserRepo(overrides.userExists ?? true)
  const emailService    = makeMockEmailService()

  const useCase = new RecordFoodTemperature(
    temperatureRepo,
    buildingRepo,
    userRepo,
    emailService,
    'admin@storyland.com'
  )

  return { useCase, temperatureRepo, buildingRepo, userRepo, emailService }
}

const BASE_INPUT = {
  buildingId:   'building-1',
  recordedById: 'user-1',
  foodItem:     'Hot Dogs',
  temperatureC: 65,
  isHotFood:    true,
  shift:        'MORNING' as const,
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('RecordFoodTemperature', () => {

  describe('✅ Casos exitosos', () => {

    it('registra temperatura de comida caliente dentro del rango', async () => {
      const { useCase, temperatureRepo } = makeUseCase()
      const expected = makeFoodTemperature({ temperatureC: 65, isInRange: true })
      temperatureRepo.createFoodTemperature.mockResolvedValue(expected)

      const result = await useCase.execute({ ...BASE_INPUT, temperatureC: 65 })

      expect(result.wasOutOfRange).toBe(false)
      expect(result.record.isInRange).toBe(true)
      expect(temperatureRepo.createFoodTemperature).toHaveBeenCalledOnce()
      expect(temperatureRepo.createFoodTemperature).toHaveBeenCalledWith(
        expect.objectContaining({
          temperatureC: 65,
          isInRange:    true,
          minSafeTemp:  TemperatureRange.HOT_FOOD_MIN_C,
        })
      )
    })

    it('registra temperatura de comida fría dentro del rango', async () => {
      const { useCase, temperatureRepo } = makeUseCase()
      const expected = makeFoodTemperature({ temperatureC: 3, isInRange: true, isHotFood: false } as any)
      temperatureRepo.createFoodTemperature.mockResolvedValue(expected)

      const result = await useCase.execute({
        ...BASE_INPUT,
        foodItem:     'Ice Cream Mix',
        temperatureC: 3,
        isHotFood:    false,
      })

      expect(result.wasOutOfRange).toBe(false)
      expect(temperatureRepo.createFoodTemperature).toHaveBeenCalledWith(
        expect.objectContaining({
          temperatureC: 3,
          isInRange:    true,
          maxSafeTemp:  TemperatureRange.COLD_FOOD_MAX_C,
        })
      )
    })

    it('detecta temperatura de comida caliente FUERA del rango', async () => {
      const { useCase, temperatureRepo, emailService } = makeUseCase()
      const expected = makeFoodTemperature({ temperatureC: 45, isInRange: false })
      temperatureRepo.createFoodTemperature.mockResolvedValue(expected)

      const result = await useCase.execute({ ...BASE_INPUT, temperatureC: 45 })

      expect(result.wasOutOfRange).toBe(true)
      expect(result.message).toContain('ALERTA')
    })

    it('envía alerta por email cuando la temperatura está fuera de rango', async () => {
      const { useCase, temperatureRepo, emailService } = makeUseCase()
      temperatureRepo.createFoodTemperature.mockResolvedValue(
        makeFoodTemperature({ temperatureC: 45, isInRange: false })
      )

      await useCase.execute({ ...BASE_INPUT, temperatureC: 45 })

      // El email se dispara de forma asíncrona (no bloqueante)
      // Esperamos que se haya llamado
      await vi.waitFor(() => {
        expect(emailService.sendTemperatureAlert).toHaveBeenCalledOnce()
      })
      expect(emailService.sendTemperatureAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          to:          'admin@storyland.com',
          foodItem:    'Hot Dogs',
          temperatureC: 45,
          shift:        'MORNING',
        })
      )
    })

    it('NO envía alerta cuando la temperatura está en rango', async () => {
      const { useCase, temperatureRepo, emailService } = makeUseCase()
      temperatureRepo.createFoodTemperature.mockResolvedValue(
        makeFoodTemperature({ temperatureC: 65, isInRange: true })
      )

      await useCase.execute({ ...BASE_INPUT, temperatureC: 65 })

      expect(emailService.sendTemperatureAlert).not.toHaveBeenCalled()
    })

    it('guarda las notas opcionales', async () => {
      const { useCase, temperatureRepo } = makeUseCase()
      temperatureRepo.createFoodTemperature.mockResolvedValue(
        makeFoodTemperature({ notes: 'Recién sacado del horno' })
      )

      await useCase.execute({ ...BASE_INPUT, notes: 'Recién sacado del horno' })

      expect(temperatureRepo.createFoodTemperature).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Recién sacado del horno' })
      )
    })
  })

  describe('❌ Casos de error', () => {

    it('lanza BuildingNotFoundError si el edificio no existe', async () => {
      const { useCase } = makeUseCase({ buildingExists: false })

      await expect(useCase.execute(BASE_INPUT))
        .rejects.toThrow(BuildingNotFoundError)
    })

    it('lanza UserNotFoundError si el usuario no existe', async () => {
      const { useCase } = makeUseCase({ userExists: false })

      await expect(useCase.execute(BASE_INPUT))
        .rejects.toThrow(UserNotFoundError)
    })

    it('no persiste el registro si el edificio no existe', async () => {
      const { useCase, temperatureRepo } = makeUseCase({ buildingExists: false })

      await expect(useCase.execute(BASE_INPUT)).rejects.toThrow()
      expect(temperatureRepo.createFoodTemperature).not.toHaveBeenCalled()
    })

    it('no envía email si falla la persistencia', async () => {
      const { useCase, temperatureRepo, emailService } = makeUseCase()
      temperatureRepo.createFoodTemperature.mockRejectedValue(new Error('DB error'))

      await expect(useCase.execute(BASE_INPUT)).rejects.toThrow('DB error')
      expect(emailService.sendTemperatureAlert).not.toHaveBeenCalled()
    })

    it('no falla si el email lanza un error (fire and forget)', async () => {
      const { useCase, temperatureRepo, emailService } = makeUseCase()
      temperatureRepo.createFoodTemperature.mockResolvedValue(
        makeFoodTemperature({ temperatureC: 45, isInRange: false })
      )
      emailService.sendTemperatureAlert.mockRejectedValue(new Error('SMTP error'))

      // No debe propagar el error del email
      await expect(
        useCase.execute({ ...BASE_INPUT, temperatureC: 45 })
      ).resolves.toBeDefined()
    })
  })
})

// ─────────────────────────────────────────────
// Tests del Value Object TemperatureRange
// ─────────────────────────────────────────────

describe('TemperatureRange', () => {

  describe('isInRange para comida caliente', () => {
    it('true cuando temperatura >= 60°C', () => {
      expect(TemperatureRange.isInRange(60, 60, 999)).toBe(true)
      expect(TemperatureRange.isInRange(65, 60, 999)).toBe(true)
      expect(TemperatureRange.isInRange(80, 60, 999)).toBe(true)
    })

    it('false cuando temperatura < 60°C', () => {
      expect(TemperatureRange.isInRange(59.9, 60, 999)).toBe(false)
      expect(TemperatureRange.isInRange(45,   60, 999)).toBe(false)
      expect(TemperatureRange.isInRange(0,    60, 999)).toBe(false)
    })
  })

  describe('isInRange para comida fría', () => {
    it('true cuando temperatura <= 4°C', () => {
      expect(TemperatureRange.isInRange(4,   0, 4)).toBe(true)
      expect(TemperatureRange.isInRange(2,   0, 4)).toBe(true)
      expect(TemperatureRange.isInRange(-1,  0, 4)).toBe(true)
    })

    it('false cuando temperatura > 4°C', () => {
      expect(TemperatureRange.isInRange(4.1, 0, 4)).toBe(false)
      expect(TemperatureRange.isInRange(10,  0, 4)).toBe(false)
    })
  })
})
