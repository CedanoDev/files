// ─────────────────────────────────────────────
// tests/use-cases/waste/waste.test.ts
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { RecordWaste }    from '../../../use-cases/waste/RecordWaste'
import { GetWasteTrends } from '../../../use-cases/waste/GetWasteTrends'
import {
  WasteCostEstimator,
  InvalidWasteQuantityError,
} from '../../../domain/entities/Waste'
import {
  makeMockWasteRepo,
  makeMockTemperatureRepo,
  makeMockBuildingRepo,
  makeWasteLog,
  makeFoodTemperature,
} from '../../helpers/factories'

// ══════════════════════════════════════════════
// RecordWaste
// ══════════════════════════════════════════════

describe('RecordWaste', () => {
  function makeUseCase(buildingExists = true) {
    const wasteRepo    = makeMockWasteRepo()
    const tempRepo     = makeMockTemperatureRepo()
    const buildingRepo = makeMockBuildingRepo(buildingExists)
    const useCase      = new RecordWaste(wasteRepo, tempRepo, buildingRepo)
    return { useCase, wasteRepo, tempRepo }
  }

  const BASE_INPUT = {
    buildingId:    'building-1',
    recordedById:  'user-1',
    productName:   'Hot Dogs',
    quantityKg:    3.5,
    discardReason: 'OVERPRODUCTION' as const,
    shift:         'CLOSING' as const,
  }

  it('registra un desperdicio correctamente', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.createWasteLog.mockResolvedValue(makeWasteLog())

    const result = await useCase.execute(BASE_INPUT)

    expect(wasteRepo.createWasteLog).toHaveBeenCalledOnce()
    expect(result.log).toBeDefined()
    expect(result.message).toContain('Hot Dogs')
  })

  it('estima el costo si no se provee', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.createWasteLog.mockResolvedValue(makeWasteLog({ estimatedCostUsd: 15.75 }))

    const result = await useCase.execute(BASE_INPUT) // sin estimatedCostUsd

    expect(result.estimatedCost).toBeGreaterThan(0)
    // 3.5kg * $4.5/kg = $15.75
    expect(result.estimatedCost).toBe(WasteCostEstimator.estimate('Hot Dogs', 3.5))
  })

  it('usa el costo provisto si se pasa explícitamente', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.createWasteLog.mockResolvedValue(makeWasteLog({ estimatedCostUsd: 99 }))

    const result = await useCase.execute({ ...BASE_INPUT, estimatedCostUsd: 99 })

    expect(result.estimatedCost).toBe(99)
    expect(wasteRepo.createWasteLog).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedCostUsd: 99 })
    )
  })

  it('acepta cantidad en unidades en lugar de kg', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.createWasteLog.mockResolvedValue(makeWasteLog({ quantityKg: null, quantityUnits: 12 }))

    const result = await useCase.execute({
      ...BASE_INPUT,
      quantityKg:    undefined,
      quantityUnits: 12,
    })

    expect(wasteRepo.createWasteLog).toHaveBeenCalledWith(
      expect.objectContaining({ quantityUnits: 12, quantityKg: undefined })
    )
  })

  it('detecta correlación con temperatura cuando motivo es TEMP_VIOLATION', async () => {
    const { useCase, wasteRepo, tempRepo } = makeUseCase()
    wasteRepo.createWasteLog.mockResolvedValue(makeWasteLog({ discardReason: 'TEMP_VIOLATION' }))

    // Simula que hay temperatura fuera de rango para Hot Dogs hoy
    tempRepo.findOutOfRangeToday.mockResolvedValue([
      makeFoodTemperature({ foodItem: 'Hot Dogs', isInRange: false }),
    ])

    const result = await useCase.execute({
      ...BASE_INPUT,
      discardReason: 'TEMP_VIOLATION',
    })

    expect(result.wasTempRelated).toBe(true)
    expect(tempRepo.findOutOfRangeToday).toHaveBeenCalledWith('building-1')
    expect(result.message).toContain('temperatura fuera de rango')
  })

  it('wasTempRelated=false cuando no hay temperatura fuera de rango para ese producto', async () => {
    const { useCase, wasteRepo, tempRepo } = makeUseCase()
    wasteRepo.createWasteLog.mockResolvedValue(makeWasteLog())
    tempRepo.findOutOfRangeToday.mockResolvedValue([
      makeFoodTemperature({ foodItem: 'Fries', isInRange: false }), // diferente producto
    ])

    const result = await useCase.execute({
      ...BASE_INPUT,
      discardReason: 'TEMP_VIOLATION',
    })

    expect(result.wasTempRelated).toBe(false)
  })

  it('lanza InvalidWasteQuantityError si no hay kg ni unidades', async () => {
    const { useCase } = makeUseCase()

    await expect(useCase.execute({
      ...BASE_INPUT,
      quantityKg:    undefined,
      quantityUnits: undefined,
    })).rejects.toThrow(InvalidWasteQuantityError)
  })

  it('lanza BuildingNotFoundError si el edificio no existe', async () => {
    const { useCase } = makeUseCase(false)
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow('Edificio no encontrado')
  })
})

// ══════════════════════════════════════════════
// GetWasteTrends
// ══════════════════════════════════════════════

describe('GetWasteTrends', () => {
  function makeUseCase(buildingExists = true) {
    const wasteRepo    = makeMockWasteRepo()
    const buildingRepo = makeMockBuildingRepo(buildingExists)
    const useCase      = new GetWasteTrends(wasteRepo, buildingRepo)
    return { useCase, wasteRepo }
  }

  const BASE_INPUT = {
    buildingId: 'building-1',
    fromDate:   new Date('2025-07-01'),
    toDate:     new Date('2025-07-14'),
  }

  it('devuelve KPIs correctos con datos de desperdicio', async () => {
    const { useCase, wasteRepo } = makeUseCase()

    wasteRepo.getSummaryByProduct.mockResolvedValue([
      { productName: 'Hot Dogs', totalKg: 42, totalUnits: 0, totalCostUsd: 189, recordCount: 12, topReason: 'OVERPRODUCTION' },
      { productName: 'Fries',    totalKg: 18, totalUnits: 0, totalCostUsd: 81,  recordCount: 8,  topReason: 'OVERPRODUCTION' },
    ])
    wasteRepo.getDailyTrend.mockResolvedValue([
      { date: '2025-07-01', totalKg: 8,  totalCostUsd: 36,  recordCount: 3 },
      { date: '2025-07-02', totalKg: 12, totalCostUsd: 54,  recordCount: 5 },
    ])
    wasteRepo.getTotalCost.mockResolvedValue(270)  // período actual
    // segunda llamada = período anterior
    wasteRepo.getTotalCost.mockResolvedValueOnce(270).mockResolvedValueOnce(340)

    const result = await useCase.execute(BASE_INPUT)

    expect(result.kpis.totalKg).toBe(60)       // 42 + 18
    expect(result.kpis.topProduct).toBe('Hot Dogs')
    expect(result.kpis.topReason).toBe('Sobreproducción')
    expect(result.topProducts).toHaveLength(2)
  })

  it('indica isImproving=true cuando el costo bajó vs período anterior', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.getSummaryByProduct.mockResolvedValue([])
    wasteRepo.getDailyTrend.mockResolvedValue([])
    // actual=200, anterior=300 → bajó
    wasteRepo.getTotalCost
      .mockResolvedValueOnce(200)  // período actual
      .mockResolvedValueOnce(300)  // período anterior

    const result = await useCase.execute(BASE_INPUT)

    expect(result.comparison.isImproving).toBe(true)
    expect(result.comparison.changePercent).toBe(-33)
  })

  it('indica isImproving=false cuando el costo subió', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.getSummaryByProduct.mockResolvedValue([])
    wasteRepo.getDailyTrend.mockResolvedValue([])
    wasteRepo.getTotalCost
      .mockResolvedValueOnce(300)  // actual
      .mockResolvedValueOnce(200)  // anterior → subió

    const result = await useCase.execute(BASE_INPUT)

    expect(result.comparison.isImproving).toBe(false)
    expect(result.comparison.changePercent).toBe(50)
  })

  it('limita topProducts a 5 aunque haya más', async () => {
    const { useCase, wasteRepo } = makeUseCase()
    wasteRepo.getSummaryByProduct.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        productName: `Producto ${i}`, totalKg: 10 - i, totalUnits: 0,
        totalCostUsd: 50, recordCount: 5, topReason: 'OVERPRODUCTION' as const,
      }))
    )
    wasteRepo.getDailyTrend.mockResolvedValue([])
    wasteRepo.getTotalCost.mockResolvedValue(0)

    const result = await useCase.execute(BASE_INPUT)

    expect(result.topProducts).toHaveLength(5)
  })

  it('lanza BuildingNotFoundError si el edificio no existe', async () => {
    const { useCase } = makeUseCase(false)
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow('Edificio no encontrado')
  })
})

// ══════════════════════════════════════════════
// WasteCostEstimator (Value Object)
// ══════════════════════════════════════════════

describe('WasteCostEstimator', () => {
  it('usa el costo por defecto ($4.5/kg) para productos desconocidos', () => {
    expect(WasteCostEstimator.estimate('Producto Raro', 2)).toBe(9)
  })

  it('calcula correctamente para múltiples cantidades', () => {
    expect(WasteCostEstimator.estimate('Hot Dogs', 1)).toBe(4.5)
    expect(WasteCostEstimator.estimate('Hot Dogs', 3.5)).toBe(15.75)
    expect(WasteCostEstimator.estimate('Hot Dogs', 10)).toBe(45)
  })

  it('devuelve 0 para cantidad 0', () => {
    expect(WasteCostEstimator.estimate('Hot Dogs', 0)).toBe(0)
  })
})
