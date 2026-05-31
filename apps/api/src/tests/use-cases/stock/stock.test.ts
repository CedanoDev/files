// ─────────────────────────────────────────────
// tests/use-cases/stock/stock.test.ts
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { CreateStockRequest }  from '../../../use-cases/stock/CreateStockRequest'
import { GetStockSuggestion }  from '../../../use-cases/stock/GetStockSuggestion'
import {
  StockSuggestionCalculator,
  assertValidTransition,
  InvalidStatusTransitionError,
  EmptyStockRequestError,
} from '../../../domain/entities/Stock'
import {
  makeMockStockRepo,
  makeMockBuildingRepo,
  makeStockRequest,
} from '../../helpers/factories'

// ══════════════════════════════════════════════
// CreateStockRequest
// ══════════════════════════════════════════════

describe('CreateStockRequest', () => {
  function makeUseCase(buildingExists = true) {
    const repo         = makeMockStockRepo()
    const buildingRepo = makeMockBuildingRepo(buildingExists)
    const useCase      = new CreateStockRequest(repo, buildingRepo)
    return { useCase, repo }
  }

  const BASE_INPUT = {
    buildingId:  'building-1',
    createdById: 'user-super',
    items: [
      { productName: 'Hot Dogs', unit: 'kg', quantityRequested: 18 },
      { productName: 'Fries',    unit: 'kg', quantityRequested: 10 },
    ],
  }

  it('crea una solicitud en estado DRAFT', async () => {
    const { useCase, repo } = makeUseCase()
    const request = makeStockRequest({ status: 'DRAFT', items: [] })
    repo.createRequest.mockResolvedValue(request)

    const result = await useCase.execute(BASE_INPUT)

    expect(result.request.status).toBe('DRAFT')
    expect(repo.createRequest).toHaveBeenCalledOnce()
  })

  it('enriquece ítems con sugerencia cuando hay historial de desperdicio', async () => {
    const { useCase, repo } = makeUseCase()
    const request = makeStockRequest()
    repo.createRequest.mockResolvedValue(request)

    // Simula 14 días de historial: 42kg desperdiciados en 12 registros
    repo.getWasteHistoryByBuilding.mockResolvedValue([{
      productName:    'Hot Dogs',
      totalWasteKg:   42,
      totalWasteUnits: 0,
      recordCount:    12,   // >= 3, suficiente para sugerir
    }])
    repo.getAverageRequestedByProduct.mockResolvedValue(18) // promedio pedido

    const result = await useCase.execute(BASE_INPUT)
    const hotDogItem = result.itemsWithSuggestions.find((i) => i.productName === 'Hot Dogs')

    expect(hotDogItem?.hasSuggestion).toBe(true)
    expect(hotDogItem?.quantitySuggested).toBeDefined()
    expect(hotDogItem?.quantitySuggested!).toBeLessThan(18) // sugerido < pedido
  })

  it('no sugiere cantidad cuando hay menos de 3 días de historial', async () => {
    const { useCase, repo } = makeUseCase()
    repo.createRequest.mockResolvedValue(makeStockRequest())
    repo.getWasteHistoryByBuilding.mockResolvedValue([{
      productName: 'Hot Dogs', totalWasteKg: 5, totalWasteUnits: 0, recordCount: 2, // < 3
    }])

    const result = await useCase.execute(BASE_INPUT)
    const hotDogItem = result.itemsWithSuggestions.find((i) => i.productName === 'Hot Dogs')

    expect(hotDogItem?.hasSuggestion).toBe(false)
    expect(hotDogItem?.quantitySuggested).toBeNull()
  })

  it('alerta en el mensaje cuando hay ítems sobre la cantidad sugerida', async () => {
    const { useCase, repo } = makeUseCase()
    repo.createRequest.mockResolvedValue(makeStockRequest())
    repo.getWasteHistoryByBuilding.mockResolvedValue([{
      productName: 'Hot Dogs', totalWasteKg: 42, totalWasteUnits: 0, recordCount: 12,
    }])
    repo.getAverageRequestedByProduct.mockResolvedValue(18)

    const result = await useCase.execute(BASE_INPUT)

    expect(result.message).toContain('por encima de la cantidad sugerida')
  })

  it('lanza EmptyStockRequestError si no hay ítems', async () => {
    const { useCase } = makeUseCase()
    await expect(useCase.execute({ ...BASE_INPUT, items: [] }))
      .rejects.toThrow(EmptyStockRequestError)
  })

  it('lanza BuildingNotFoundError si el edificio no existe', async () => {
    const { useCase } = makeUseCase(false)
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow('Edificio no encontrado')
  })
})

// ══════════════════════════════════════════════
// GetStockSuggestion
// ══════════════════════════════════════════════

describe('GetStockSuggestion', () => {
  function makeUseCase(buildingExists = true) {
    const repo         = makeMockStockRepo()
    const buildingRepo = makeMockBuildingRepo(buildingExists)
    const useCase      = new GetStockSuggestion(repo, buildingRepo)
    return { useCase, repo }
  }

  it('devuelve hasEnoughData=false sin historial', async () => {
    const { useCase, repo } = makeUseCase()
    repo.getWasteHistoryByBuilding.mockResolvedValue([])

    const result = await useCase.execute({ buildingId: 'building-1' })

    expect(result.hasEnoughData).toBe(false)
    expect(result.suggestions).toHaveLength(0)
  })

  it('genera sugerencias ordenadas por mayor desperdicio primero', async () => {
    const { useCase, repo } = makeUseCase()
    repo.getWasteHistoryByBuilding.mockResolvedValue([
      { productName: 'Fries',    totalWasteKg: 10, totalWasteUnits: 0, recordCount: 5 },
      { productName: 'Hot Dogs', totalWasteKg: 42, totalWasteUnits: 0, recordCount: 12 },
    ])
    repo.getAverageRequestedByProduct.mockResolvedValue(20)

    const result = await useCase.execute({ buildingId: 'building-1' })

    expect(result.suggestions[0].productName).toBe('Hot Dogs')   // mayor desperdicio primero
    expect(result.suggestions[1].productName).toBe('Fries')
  })

  it('la sugerencia siempre es al menos 1', async () => {
    const { useCase, repo } = makeUseCase()
    repo.getWasteHistoryByBuilding.mockResolvedValue([{
      productName: 'Napkins', totalWasteKg: 100, totalWasteUnits: 0, recordCount: 10,
    }])
    repo.getAverageRequestedByProduct.mockResolvedValue(1)  // promedio muy bajo

    const result = await useCase.execute({ buildingId: 'building-1' })
    expect(result.suggestions[0].suggestedQuantity).toBeGreaterThanOrEqual(1)
  })

  it('usa el lookbackDays personalizado', async () => {
    const { useCase, repo } = makeUseCase()
    repo.getWasteHistoryByBuilding.mockResolvedValue([])

    await useCase.execute({ buildingId: 'building-1', lookbackDays: 30 })

    expect(repo.getWasteHistoryByBuilding).toHaveBeenCalledWith('building-1', 30)
  })
})

// ══════════════════════════════════════════════
// StockSuggestionCalculator (Value Object)
// ══════════════════════════════════════════════

describe('StockSuggestionCalculator', () => {
  it('reduce el pedido basado en el desperdicio', () => {
    // promedio pedido 18kg, desperdicio 3.5kg/día
    // sugerido = 18 - (3.5 * 0.8) = 18 - 2.8 = 15.2
    const result = StockSuggestionCalculator.calculate(18, 3.5)
    expect(result).toBe(15.2)
  })

  it('nunca sugiere menos de 1', () => {
    expect(StockSuggestionCalculator.calculate(1, 10)).toBe(1)
    expect(StockSuggestionCalculator.calculate(0, 100)).toBe(1)
  })

  it('cuando no hay desperdicio mantiene el promedio pedido', () => {
    expect(StockSuggestionCalculator.calculate(15, 0)).toBe(15)
  })

  it('genera un reasoning legible', () => {
    const msg = StockSuggestionCalculator.buildReasoning('Hot Dogs', 18, 3.5, 15.2)
    expect(msg).toContain('Hot Dogs')
    expect(msg).toContain('18')
    expect(msg).toContain('3.5')
    expect(msg).toContain('15.2')
  })
})

// ══════════════════════════════════════════════
// assertValidTransition
// ══════════════════════════════════════════════

describe('assertValidTransition (Stock state machine)', () => {
  it('permite DRAFT → SUBMITTED', () => {
    expect(() => assertValidTransition('DRAFT', 'SUBMITTED')).not.toThrow()
  })

  it('permite DRAFT → CANCELLED', () => {
    expect(() => assertValidTransition('DRAFT', 'CANCELLED')).not.toThrow()
  })

  it('permite SUBMITTED → DISPATCHED', () => {
    expect(() => assertValidTransition('SUBMITTED', 'DISPATCHED')).not.toThrow()
  })

  it('lanza error en DRAFT → DISPATCHED (salto de estado)', () => {
    expect(() => assertValidTransition('DRAFT', 'DISPATCHED'))
      .toThrow(InvalidStatusTransitionError)
  })

  it('lanza error en DISPATCHED → CANCELLED (estado final)', () => {
    expect(() => assertValidTransition('DISPATCHED', 'CANCELLED'))
      .toThrow(InvalidStatusTransitionError)
  })

  it('lanza error en CANCELLED → SUBMITTED (estado final)', () => {
    expect(() => assertValidTransition('CANCELLED', 'SUBMITTED'))
      .toThrow(InvalidStatusTransitionError)
  })
})
