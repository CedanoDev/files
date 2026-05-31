// ─────────────────────────────────────────────
// DOMAIN ENTITIES — Stock
// ─────────────────────────────────────────────

export type StockRequestStatus = 'DRAFT' | 'SUBMITTED' | 'DISPATCHED' | 'CANCELLED'

export interface StockRequestItem {
  id: string
  requestId: string
  productName: string
  unit: string
  quantityRequested: number
  quantitySuggested: number | null  // calculado por el sistema
  quantityDispatched: number | null // lo que realmente salió del warehouse
}

export interface StockRequest {
  id: string
  buildingId: string
  createdById: string
  requestDate: Date
  status: StockRequestStatus
  notes: string | null
  submittedAt: Date | null
  dispatchedAt: Date | null
  createdAt: Date
  items: StockRequestItem[]
}

// Sugerencia calculada por el sistema para un producto
export interface StockSuggestion {
  productName: string
  unit: string
  suggestedQuantity: number
  averageWastePerDay: number      // promedio de desperdicio diario
  averageRequestedPerDay: number  // promedio pedido históricamente
  reasoning: string               // explicación legible para el supervisor
}

// ── Value Objects ─────────────────────────────

export class StockSuggestionCalculator {
  // Lógica anti-desperdicio:
  // Sugerencia = promedio pedido - (promedio desperdicio * factor de ajuste)
  // Factor 0.8 = reducimos el desperdicio en un 20% gradualmente
  static readonly WASTE_REDUCTION_FACTOR = 0.8

  static calculate(
    avgRequested: number,
    avgWaste: number
  ): number {
    const adjusted = avgRequested - avgWaste * this.WASTE_REDUCTION_FACTOR
    // Nunca sugerir menos de 1 unidad
    return Math.max(1, Math.round(adjusted * 10) / 10)
  }

  static buildReasoning(
    productName: string,
    avgRequested: number,
    avgWaste: number,
    suggestion: number
  ): string {
    if (avgWaste === 0) {
      return `Sin historial de desperdicio para ${productName}. Se mantiene el promedio pedido: ${avgRequested}.`
    }
    return (
      `${productName}: promedio pedido ${avgRequested} ${''}, ` +
      `desperdicio promedio ${avgWaste}. ` +
      `Sugerencia ajustada: ${suggestion} (reducción del ${Math.round((1 - suggestion / avgRequested) * 100)}%).`
    )
  }
}

// ── Errores de dominio ────────────────────────

export class StockRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Solicitud de stock no encontrada: ${id}`)
    this.name = 'StockRequestNotFoundError'
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: StockRequestStatus, to: StockRequestStatus) {
    super(`No se puede cambiar el estado de ${from} a ${to}.`)
    this.name = 'InvalidStatusTransitionError'
  }
}

export class EmptyStockRequestError extends Error {
  constructor() {
    super('La solicitud debe tener al menos un producto.')
    this.name = 'EmptyStockRequestError'
  }
}

// Transiciones de estado válidas
export const VALID_TRANSITIONS: Record<StockRequestStatus, StockRequestStatus[]> = {
  DRAFT:      ['SUBMITTED', 'CANCELLED'],
  SUBMITTED:  ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: [],   // estado final
  CANCELLED:  [],   // estado final
}

export function assertValidTransition(
  from: StockRequestStatus,
  to: StockRequestStatus
): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new InvalidStatusTransitionError(from, to)
  }
}
