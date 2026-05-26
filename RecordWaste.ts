// ─────────────────────────────────────────────
// USE CASE — RecordWaste
//
// Responsabilidades:
//   1. Validar que hay al menos kg o unidades
//   2. Estimar el costo si no se provee
//   3. Detectar si el motivo es TEMP_VIOLATION y
//      cruzar con temperaturas fuera de rango del día
//      para enriquecer el contexto del registro
//   4. Persistir el log de desperdicio
// ─────────────────────────────────────────────

import {
  WasteLog,
  DiscardReason,
  WasteCostEstimator,
  InvalidWasteQuantityError,
} from '../../domain/entities/Waste'
import { Shift } from '../../domain/entities/FoodTemperature'
import { IWasteRepository } from '../../domain/repositories/IWasteRepository'
import { ITemperatureRepository } from '../../domain/repositories/ITemperatureRepository'
import { IBuildingRepository, BuildingNotFoundError } from '../temperatures/RecordFoodTemperature'

// ── Input / Output ────────────────────────────

export interface RecordWasteInput {
  buildingId: string
  recordedById: string
  productName: string
  quantityKg?: number
  quantityUnits?: number
  estimatedCostUsd?: number  // si no se pasa, el sistema lo estima
  discardReason: DiscardReason
  shift: Shift
  notes?: string
}

export interface RecordWasteOutput {
  log: WasteLog
  estimatedCost: number
  wasTempRelated: boolean   // true si hay temp. fuera de rango del mismo producto hoy
  message: string
}

// ── Use Case ─────────────────────────────────

export class RecordWaste {
  constructor(
    private readonly wasteRepo: IWasteRepository,
    private readonly temperatureRepo: ITemperatureRepository,
    private readonly buildingRepo: IBuildingRepository
  ) {}

  async execute(input: RecordWasteInput): Promise<RecordWasteOutput> {
    // 1. Validar que tiene al menos una cantidad
    if (!input.quantityKg && !input.quantityUnits) {
      throw new InvalidWasteQuantityError()
    }

    // 2. Verificar edificio
    const building = await this.buildingRepo.findById(input.buildingId)
    if (!building) throw new BuildingNotFoundError(input.buildingId)

    // 3. Estimar costo si no se proveyó
    const estimatedCost =
      input.estimatedCostUsd ??
      (input.quantityKg
        ? WasteCostEstimator.estimate(input.productName, input.quantityKg)
        : 0)

    // 4. Si el motivo es TEMP_VIOLATION, cruzar con temperaturas del día
    //    para confirmar si realmente hubo violación de temperatura hoy
    let wasTempRelated = input.discardReason === 'TEMP_VIOLATION'
    if (input.discardReason === 'TEMP_VIOLATION') {
      const outOfRangeToday = await this.temperatureRepo.findOutOfRangeToday(
        input.buildingId
      )
      // Buscar si el producto específico tuvo temperatura fuera de rango
      wasTempRelated = outOfRangeToday.some(
        (t) => t.foodItem.toLowerCase().includes(input.productName.toLowerCase())
      )
    }

    // 5. Persistir
    const log = await this.wasteRepo.createWasteLog({
      buildingId: input.buildingId,
      recordedById: input.recordedById,
      productName: input.productName,
      quantityKg: input.quantityKg,
      quantityUnits: input.quantityUnits,
      estimatedCostUsd: estimatedCost,
      discardReason: input.discardReason,
      shift: input.shift,
      notes: input.notes,
    })

    // 6. Construir mensaje contextual
    const qtyStr = input.quantityKg
      ? `${input.quantityKg}kg`
      : `${input.quantityUnits} unidades`

    const costStr = estimatedCost > 0 ? ` (~$${estimatedCost} USD)` : ''

    const tempMsg =
      input.discardReason === 'TEMP_VIOLATION' && wasTempRelated
        ? ' Se encontraron registros de temperatura fuera de rango para este producto hoy.'
        : ''

    return {
      log,
      estimatedCost,
      wasTempRelated,
      message: `Desperdicio registrado: ${qtyStr} de ${input.productName}${costStr}.${tempMsg}`,
    }
  }
}
