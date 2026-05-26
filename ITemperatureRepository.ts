// ─────────────────────────────────────────────
// DOMAIN REPOSITORY INTERFACE — ITemperatureRepository
// El dominio define QUÉ necesita. La infra decide CÓMO.
// ─────────────────────────────────────────────

import { FoodTemperature, Shift } from '../entities/FoodTemperature'

export interface CreateFoodTemperatureDTO {
  buildingId: string
  recordedById: string
  foodItem: string
  temperatureC: number
  minSafeTemp: number
  maxSafeTemp: number
  isInRange: boolean
  shift: Shift
  notes?: string
}

export interface FoodTemperatureFilters {
  buildingId?: string
  fromDate?: Date
  toDate?: Date
  onlyOutOfRange?: boolean
  shift?: Shift
}

export interface ITemperatureRepository {
  createFoodTemperature(data: CreateFoodTemperatureDTO): Promise<FoodTemperature>
  findFoodTemperatures(filters: FoodTemperatureFilters): Promise<FoodTemperature[]>
  findOutOfRangeToday(buildingId: string): Promise<FoodTemperature[]>
}
