// ─────────────────────────────────────────────
// INFRASTRUCTURE — PrismaTemperatureRepository
//
// Implementación concreta del ITemperatureRepository.
// Aquí sí usamos Prisma. El dominio nunca lo ve.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { FoodTemperature } from '../../domain/entities/FoodTemperature'
import {
  ITemperatureRepository,
  CreateFoodTemperatureDTO,
  FoodTemperatureFilters,
} from '../../domain/repositories/ITemperatureRepository'

export class PrismaTemperatureRepository implements ITemperatureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createFoodTemperature(data: CreateFoodTemperatureDTO): Promise<FoodTemperature> {
    const record = await this.prisma.foodTemperature.create({
      data: {
        buildingId: data.buildingId,
        recordedById: data.recordedById,
        foodItem: data.foodItem,
        temperatureC: data.temperatureC,
        minSafeTemp: data.minSafeTemp,
        maxSafeTemp: data.maxSafeTemp,
        isInRange: data.isInRange,
        shift: data.shift,
        notes: data.notes,
      },
    })

    return this.mapToDomain(record)
  }

  async findFoodTemperatures(filters: FoodTemperatureFilters): Promise<FoodTemperature[]> {
    const records = await this.prisma.foodTemperature.findMany({
      where: {
        ...(filters.buildingId && { buildingId: filters.buildingId }),
        ...(filters.shift && { shift: filters.shift }),
        ...(filters.onlyOutOfRange && { isInRange: false }),
        ...(filters.fromDate || filters.toDate
          ? {
              recordedAt: {
                ...(filters.fromDate && { gte: filters.fromDate }),
                ...(filters.toDate && { lte: filters.toDate }),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
    })

    return records.map(this.mapToDomain)
  }

  async findOutOfRangeToday(buildingId: string): Promise<FoodTemperature[]> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const records = await this.prisma.foodTemperature.findMany({
      where: {
        buildingId,
        isInRange: false,
        recordedAt: { gte: startOfDay },
      },
      orderBy: { recordedAt: 'desc' },
    })

    return records.map(this.mapToDomain)
  }

  // Mapeo de Prisma → entidad de dominio
  private mapToDomain(record: any): FoodTemperature {
    return {
      id: record.id,
      buildingId: record.buildingId,
      recordedById: record.recordedById,
      foodItem: record.foodItem,
      temperatureC: record.temperatureC,
      minSafeTemp: record.minSafeTemp,
      maxSafeTemp: record.maxSafeTemp,
      isInRange: record.isInRange,
      shift: record.shift,
      notes: record.notes ?? undefined,
      recordedAt: record.recordedAt,
    }
  }
}
