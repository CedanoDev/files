// ─────────────────────────────────────────────
// USE CASE — CreateStockRequest
//
// Responsabilidades:
//   1. Validar que el edificio existe
//   2. Enriquecer cada ítem con la sugerencia del sistema
//      (si existe historial para ese producto)
//   3. Crear la solicitud en estado DRAFT
//   4. Devolver la solicitud con sugerencias visibles
//      para que el supervisor pueda ajustar antes de enviar
// ─────────────────────────────────────────────

import {
  StockRequest,
  EmptyStockRequestError,
  StockSuggestionCalculator,
} from '../../domain/entities/Stock'
import { IStockRepository } from '../../domain/repositories/IStockRepository'
import { IBuildingRepository, BuildingNotFoundError } from '../temperatures/RecordFoodTemperature'

// ── Input / Output ────────────────────────────

export interface StockRequestItemInput {
  productName: string
  unit: string
  quantityRequested: number
}

export interface CreateStockRequestInput {
  buildingId: string
  createdById: string
  notes?: string
  items: StockRequestItemInput[]
  requestDate?: Date  // por defecto: hoy
}

export interface CreateStockRequestOutput {
  request: StockRequest
  itemsWithSuggestions: {
    productName: string
    unit: string
    quantityRequested: number
    quantitySuggested: number | null
    diffFromSuggestion: number | null   // positivo = pidió más de lo sugerido
    hasSuggestion: boolean
  }[]
  message: string
}

// ── Use Case ─────────────────────────────────

export class CreateStockRequest {
  private static readonly LOOKBACK_DAYS = 14

  constructor(
    private readonly stockRepo: IStockRepository,
    private readonly buildingRepo: IBuildingRepository
  ) {}

  async execute(input: CreateStockRequestInput): Promise<CreateStockRequestOutput> {
    // 1. Validar que hay al menos un producto
    if (!input.items || input.items.length === 0) {
      throw new EmptyStockRequestError()
    }

    // 2. Validar que el edificio existe
    const building = await this.buildingRepo.findById(input.buildingId)
    if (!building) throw new BuildingNotFoundError(input.buildingId)

    const requestDate = input.requestDate ?? new Date()

    // 3. Para cada ítem, buscar si hay sugerencia del sistema
    const itemsWithSuggestions = await Promise.all(
      input.items.map(async (item) => {
        // Buscar historial de desperdicio de este producto
        const wasteHistory = await this.stockRepo.getWasteHistoryByBuilding(
          input.buildingId,
          CreateStockRequest.LOOKBACK_DAYS
        )

        const productWaste = wasteHistory.find(
          (w) => w.productName.toLowerCase() === item.productName.toLowerCase()
        )

        let quantitySuggested: number | null = null

        if (productWaste && productWaste.recordCount >= 3) {
          const avgWaste =
            (productWaste.totalWasteKg ?? productWaste.totalWasteUnits) /
            productWaste.recordCount

          const avgRequested = await this.stockRepo.getAverageRequestedByProduct(
            input.buildingId,
            item.productName,
            CreateStockRequest.LOOKBACK_DAYS
          )

          const base = avgRequested > 0 ? avgRequested : avgWaste * 1.2
          quantitySuggested = StockSuggestionCalculator.calculate(base, avgWaste)
        }

        return {
          productName: item.productName,
          unit: item.unit,
          quantityRequested: item.quantityRequested,
          quantitySuggested,
          diffFromSuggestion:
            quantitySuggested !== null
              ? Math.round((item.quantityRequested - quantitySuggested) * 10) / 10
              : null,
          hasSuggestion: quantitySuggested !== null,
        }
      })
    )

    // 4. Crear la solicitud en DRAFT con sugerencias guardadas
    const request = await this.stockRepo.createRequest({
      buildingId: input.buildingId,
      createdById: input.createdById,
      requestDate,
      notes: input.notes,
      items: itemsWithSuggestions.map((i) => ({
        productName: i.productName,
        unit: i.unit,
        quantityRequested: i.quantityRequested,
        quantitySuggested: i.quantitySuggested ?? undefined,
      })),
    })

    // 5. Resumen para el supervisor
    const overRequestedCount = itemsWithSuggestions.filter(
      (i) => i.diffFromSuggestion !== null && i.diffFromSuggestion > 0
    ).length

    const message =
      overRequestedCount > 0
        ? `Solicitud creada en borrador. ${overRequestedCount} producto(s) están por encima de la cantidad sugerida. Revisa antes de enviar al warehouse.`
        : `Solicitud creada en borrador con ${request.items.length} productos. Lista para enviar.`

    return { request, itemsWithSuggestions, message }
  }
}
