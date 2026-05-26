// ─────────────────────────────────────────────
// DOMAIN REPOSITORY INTERFACE — IWasteRepository
// ─────────────────────────────────────────────

import { Shift } from '../entities/FoodTemperature'
import {
  WasteLog,
  WasteSummaryByProduct,
  WasteTrendPoint,
  DiscardReason,
} from '../entities/Waste'

export interface CreateWasteLogDTO {
  buildingId: string
  recordedById: string
  productName: string
  quantityKg?: number
  quantityUnits?: number
  estimatedCostUsd?: number
  discardReason: DiscardReason
  shift: Shift
  notes?: string
}

export interface WasteFilters {
  buildingId: string
  fromDate?: Date
  toDate?: Date
  shift?: Shift
  discardReason?: DiscardReason
}

export interface IWasteRepository {
  createWasteLog(data: CreateWasteLogDTO): Promise<WasteLog>
  findWasteLogs(filters: WasteFilters): Promise<WasteLog[]>

  // Para el dashboard: agrupado por producto
  getSummaryByProduct(
    buildingId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<WasteSummaryByProduct[]>

  // Para el gráfico de tendencia diaria
  getDailyTrend(
    buildingId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<WasteTrendPoint[]>

  // Total de costo de desperdicio en un período
  getTotalCost(buildingId: string, fromDate: Date, toDate: Date): Promise<number>
}
