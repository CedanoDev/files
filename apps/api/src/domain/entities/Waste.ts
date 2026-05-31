// ─────────────────────────────────────────────
// DOMAIN ENTITIES — Waste (Desperdicios)
// ─────────────────────────────────────────────

import { Shift } from './FoodTemperature'

export type DiscardReason =
  | 'EXPIRED'         // producto vencido
  | 'TEMP_VIOLATION'  // estuvo fuera de rango de temperatura
  | 'OVERPRODUCTION'  // se produjo más de lo que se vendió
  | 'DAMAGED'         // daño físico
  | 'OTHER'

export const DISCARD_REASON_LABELS: Record<DiscardReason, string> = {
  EXPIRED:        'Producto vencido',
  TEMP_VIOLATION: 'Violación de temperatura',
  OVERPRODUCTION: 'Sobreproducción',
  DAMAGED:        'Daño físico',
  OTHER:          'Otro',
}

export interface WasteLog {
  id: string
  buildingId: string
  recordedById: string
  productName: string
  quantityKg: number | null
  quantityUnits: number | null
  estimatedCostUsd: number | null
  discardReason: DiscardReason
  shift: Shift
  notes: string | null
  recordedAt: Date
}

// Agregado por producto para el dashboard
export interface WasteSummaryByProduct {
  productName: string
  totalKg: number
  totalUnits: number
  totalCostUsd: number
  recordCount: number
  topReason: DiscardReason
}

// Tendencia diaria para el gráfico
export interface WasteTrendPoint {
  date: string          // 'YYYY-MM-DD'
  totalKg: number
  totalCostUsd: number
  recordCount: number
}

// ── Value Objects ─────────────────────────────

export class WasteCostEstimator {
  // Costos aproximados por kg (en producción vendría de un catálogo)
  private static readonly COST_PER_KG: Record<string, number> = {
    default: 4.5,
  }

  static estimate(productName: string, quantityKg: number): number {
    const key = productName.toLowerCase()
    const rate = this.COST_PER_KG[key] ?? this.COST_PER_KG['default']
    return Math.round(quantityKg * rate * 100) / 100
  }
}

// ── Errores de dominio ────────────────────────

export class WasteLogNotFoundError extends Error {
  constructor(id: string) {
    super(`Registro de desperdicio no encontrado: ${id}`)
    this.name = 'WasteLogNotFoundError'
  }
}

export class InvalidWasteQuantityError extends Error {
  constructor() {
    super('Debes indicar la cantidad en kg o en unidades.')
    this.name = 'InvalidWasteQuantityError'
  }
}
