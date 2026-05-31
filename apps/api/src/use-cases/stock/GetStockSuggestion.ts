// ─────────────────────────────────────────────
// USE CASE — GetStockSuggestion
//
// Este es el use case más importante del sistema.
// Es lo que transforma el sistema de un simple
// registro digital a una herramienta de decisión.
//
// Responsabilidades:
//   1. Obtener el historial de desperdicios del edificio
//      en los últimos N días
//   2. Para cada producto con historial, calcular:
//      - Promedio diario pedido
//      - Promedio diario desperdiciado
//      - Cantidad sugerida ajustada (anti-desperdicio)
//   3. Devolver sugerencias ordenadas por mayor
//      potencial de reducción de desperdicio
//
// Con 2-3 semanas de datos, este use case empieza
// a ser realmente útil para el supervisor.
// ─────────────────────────────────────────────

import {
  StockSuggestion,
  StockSuggestionCalculator,
} from '../../domain/entities/Stock'
import { IStockRepository } from '../../domain/repositories/IStockRepository'
import { BuildingNotFoundError } from '../temperatures/RecordFoodTemperature'
import { IBuildingRepository } from '../temperatures/RecordFoodTemperature'

// ── Input / Output ────────────────────────────

export interface GetStockSuggestionInput {
  buildingId: string
  lookbackDays?: number   // por defecto: últimos 14 días
}

export interface GetStockSuggestionOutput {
  suggestions: StockSuggestion[]
  basedOnDays: number
  hasEnoughData: boolean    // false si hay menos de 3 días de historia
  message: string
}

// ── Use Case ─────────────────────────────────

export class GetStockSuggestion {
  private static readonly DEFAULT_LOOKBACK_DAYS = 14
  private static readonly MIN_DAYS_FOR_RELIABLE_DATA = 3

  constructor(
    private readonly stockRepo: IStockRepository,
    private readonly buildingRepo: IBuildingRepository
  ) {}

  async execute(input: GetStockSuggestionInput): Promise<GetStockSuggestionOutput> {
    const lookbackDays = input.lookbackDays ?? GetStockSuggestion.DEFAULT_LOOKBACK_DAYS

    // 1. Verificar que el edificio existe
    const building = await this.buildingRepo.findById(input.buildingId)
    if (!building) throw new BuildingNotFoundError(input.buildingId)

    // 2. Obtener historial de desperdicios agrupado por producto
    const wasteHistory = await this.stockRepo.getWasteHistoryByBuilding(
      input.buildingId,
      lookbackDays
    )

    // Sin historial: no hay suficientes datos aún
    if (wasteHistory.length === 0) {
      return {
        suggestions: [],
        basedOnDays: lookbackDays,
        hasEnoughData: false,
        message: `No hay historial de desperdicios en los últimos ${lookbackDays} días. Las sugerencias estarán disponibles después de registrar datos por al menos ${GetStockSuggestion.MIN_DAYS_FOR_RELIABLE_DATA} días.`,
      }
    }

    // 3. Para cada producto con desperdicio, calcular sugerencia
    const suggestions: StockSuggestion[] = await Promise.all(
      wasteHistory.map(async (waste) => {
        // Promedio diario de desperdicio
        const avgWastePerDay =
          (waste.totalWasteKg ?? waste.totalWasteUnits) / Math.max(waste.recordCount, 1)

        // Promedio diario de lo que se ha pedido históricamente
        const avgRequestedPerDay = await this.stockRepo.getAverageRequestedByProduct(
          input.buildingId,
          waste.productName,
          lookbackDays
        )

        // Si nunca se ha pedido explícitamente, usamos el desperdicio como base mínima
        const baseQuantity = avgRequestedPerDay > 0 ? avgRequestedPerDay : avgWastePerDay * 1.2

        const suggestedQuantity = StockSuggestionCalculator.calculate(
          baseQuantity,
          avgWastePerDay
        )

        const reasoning = StockSuggestionCalculator.buildReasoning(
          waste.productName,
          Math.round(baseQuantity * 10) / 10,
          Math.round(avgWastePerDay * 10) / 10,
          suggestedQuantity
        )

        return {
          productName: waste.productName,
          unit: 'kg',   // en producción esto vendría de un catálogo de productos
          suggestedQuantity,
          averageWastePerDay: Math.round(avgWastePerDay * 100) / 100,
          averageRequestedPerDay: Math.round(baseQuantity * 100) / 100,
          reasoning,
        }
      })
    )

    // 4. Ordenar por mayor potencial de reducción (más desperdicio primero)
    suggestions.sort((a, b) => b.averageWastePerDay - a.averageWastePerDay)

    const hasEnoughData = wasteHistory.some(
      (w) => w.recordCount >= GetStockSuggestion.MIN_DAYS_FOR_RELIABLE_DATA
    )

    const totalWasteSavingPotential = suggestions.reduce(
      (acc, s) => acc + (s.averageRequestedPerDay - s.suggestedQuantity),
      0
    )

    return {
      suggestions,
      basedOnDays: lookbackDays,
      hasEnoughData,
      message: hasEnoughData
        ? `${suggestions.length} sugerencias basadas en ${lookbackDays} días de historial. Reducción estimada de desperdicio: ${Math.round(totalWasteSavingPotential * 10) / 10} unidades/día.`
        : `Datos insuficientes para sugerencias confiables. Se necesitan al menos ${GetStockSuggestion.MIN_DAYS_FOR_RELIABLE_DATA} días de registros.`,
    }
  }
}
