// ─────────────────────────────────────────────
// USE CASE — GetWasteTrends
//
// Responsabilidades:
//   1. Obtener tendencia diaria de desperdicio (para gráfica)
//   2. Obtener resumen por producto (para tabla top 5)
//   3. Calcular KPIs clave:
//      - Total kg desperdiciado
//      - Costo total estimado
//      - Día con más desperdicio
//      - Producto más desperdiciado
//      - Razón más frecuente
//   4. Comparar con el período anterior para mostrar
//      si el desperdicio está mejorando o empeorando
// ─────────────────────────────────────────────

import {
  WasteSummaryByProduct,
  WasteTrendPoint,
  DiscardReason,
  DISCARD_REASON_LABELS,
} from '../../domain/entities/Waste'
import { IWasteRepository } from '../../domain/repositories/IWasteRepository'
import { IBuildingRepository, BuildingNotFoundError } from '../temperatures/RecordFoodTemperature'

// ── Input / Output ────────────────────────────

export interface GetWasteTrendsInput {
  buildingId: string
  fromDate: Date
  toDate: Date
}

export interface WasteKPIs {
  totalKg: number
  totalCostUsd: number
  avgKgPerDay: number
  topProduct: string | null
  topReason: string | null
  worstDay: string | null         // fecha con más desperdicio
  periodDays: number
}

export interface WasteTrendComparison {
  currentPeriodCost: number
  previousPeriodCost: number
  changePercent: number           // negativo = mejoró, positivo = empeoró
  isImproving: boolean
}

export interface GetWasteTrendsOutput {
  kpis: WasteKPIs
  trend: WasteTrendPoint[]
  topProducts: WasteSummaryByProduct[]  // top 5 por kg
  comparison: WasteTrendComparison
  message: string
}

// ── Use Case ─────────────────────────────────

export class GetWasteTrends {
  constructor(
    private readonly wasteRepo: IWasteRepository,
    private readonly buildingRepo: IBuildingRepository
  ) {}

  async execute(input: GetWasteTrendsInput): Promise<GetWasteTrendsOutput> {
    // 1. Verificar edificio
    const building = await this.buildingRepo.findById(input.buildingId)
    if (!building) throw new BuildingNotFoundError(input.buildingId)

    const periodDays = Math.ceil(
      (input.toDate.getTime() - input.fromDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // 2. Período anterior (mismo número de días, inmediatamente antes)
    const prevFromDate = new Date(input.fromDate)
    prevFromDate.setDate(prevFromDate.getDate() - periodDays)
    const prevToDate = new Date(input.fromDate)

    // 3. Obtener datos en paralelo
    const [trend, topProducts, currentCost, previousCost] = await Promise.all([
      this.wasteRepo.getDailyTrend(input.buildingId, input.fromDate, input.toDate),
      this.wasteRepo.getSummaryByProduct(input.buildingId, input.fromDate, input.toDate),
      this.wasteRepo.getTotalCost(input.buildingId, input.fromDate, input.toDate),
      this.wasteRepo.getTotalCost(input.buildingId, prevFromDate, prevToDate),
    ])

    // 4. Calcular KPIs
    const totalKg = topProducts.reduce((sum, p) => sum + p.totalKg, 0)
    const avgKgPerDay = periodDays > 0 ? Math.round((totalKg / periodDays) * 100) / 100 : 0

    const topProduct = topProducts.length > 0 ? topProducts[0].productName : null

    // Razón más frecuente (moda)
    const reasonCounts: Partial<Record<DiscardReason, number>> = {}
    topProducts.forEach((p) => {
      reasonCounts[p.topReason] = (reasonCounts[p.topReason] ?? 0) + p.recordCount
    })
    const topReasonKey = (Object.entries(reasonCounts).sort(([, a], [, b]) => b - a)[0]?.[0]) as DiscardReason | undefined
    const topReason = topReasonKey ? DISCARD_REASON_LABELS[topReasonKey] : null

    // Día con más desperdicio
    const worstDay = trend.length > 0
      ? trend.reduce((max, p) => (p.totalKg > max.totalKg ? p : max), trend[0]).date
      : null

    // 5. Comparación de períodos
    const changePercent = previousCost > 0
      ? Math.round(((currentCost - previousCost) / previousCost) * 100)
      : 0
    const isImproving = changePercent < 0

    // 6. Mensaje resumen
    const trendEmoji = isImproving ? '📉' : changePercent === 0 ? '➡️' : '📈'
    const message = topProduct
      ? `${trendEmoji} ${periodDays} días analizados. Desperdicio total: ${Math.round(totalKg * 10) / 10}kg (~$${Math.round(currentCost)}). Producto más desperdiciado: ${topProduct}.`
      : `Sin registros de desperdicio para el período seleccionado.`

    return {
      kpis: {
        totalKg: Math.round(totalKg * 100) / 100,
        totalCostUsd: Math.round(currentCost * 100) / 100,
        avgKgPerDay,
        topProduct,
        topReason,
        worstDay,
        periodDays,
      },
      trend,
      topProducts: topProducts.slice(0, 5), // top 5
      comparison: {
        currentPeriodCost: Math.round(currentCost * 100) / 100,
        previousPeriodCost: Math.round(previousCost * 100) / 100,
        changePercent,
        isImproving,
      },
      message,
    }
  }
}
