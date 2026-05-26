// ─────────────────────────────────────────────
// INFRASTRUCTURE — PrismaWasteRepository
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import {
  WasteLog,
  WasteSummaryByProduct,
  WasteTrendPoint,
  DiscardReason,
} from '../../domain/entities/Waste'
import {
  IWasteRepository,
  CreateWasteLogDTO,
  WasteFilters,
} from '../../domain/repositories/IWasteRepository'

export class PrismaWasteRepository implements IWasteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createWasteLog(data: CreateWasteLogDTO): Promise<WasteLog> {
    const record = await this.prisma.wasteLog.create({
      data: {
        buildingId: data.buildingId,
        recordedById: data.recordedById,
        productName: data.productName,
        quantityKg: data.quantityKg ?? null,
        quantityUnits: data.quantityUnits ?? null,
        estimatedCostUsd: data.estimatedCostUsd ?? null,
        discardReason: data.discardReason,
        shift: data.shift,
        notes: data.notes ?? null,
      },
    })
    return this.mapLog(record)
  }

  async findWasteLogs(filters: WasteFilters): Promise<WasteLog[]> {
    const records = await this.prisma.wasteLog.findMany({
      where: {
        buildingId: filters.buildingId,
        ...(filters.shift && { shift: filters.shift }),
        ...(filters.discardReason && { discardReason: filters.discardReason }),
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
    return records.map(this.mapLog)
  }

  // Agrupado por producto con totales y razón más frecuente
  async getSummaryByProduct(
    buildingId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<WasteSummaryByProduct[]> {
    // Prisma groupBy no soporta moda directamente, usamos raw query
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        product_name                          AS "productName",
        COALESCE(SUM(quantity_kg), 0)         AS "totalKg",
        COALESCE(SUM(quantity_units), 0)      AS "totalUnits",
        COALESCE(SUM(estimated_cost_usd), 0)  AS "totalCostUsd",
        COUNT(*)::int                         AS "recordCount",
        MODE() WITHIN GROUP (ORDER BY discard_reason) AS "topReason"
      FROM waste_logs
      WHERE
        building_id   = ${buildingId}
        AND recorded_at >= ${fromDate}
        AND recorded_at <= ${toDate}
      GROUP BY product_name
      ORDER BY "totalKg" DESC
    `

    return rows.map((r) => ({
      productName: r.productName,
      totalKg: Number(r.totalKg),
      totalUnits: Number(r.totalUnits),
      totalCostUsd: Number(r.totalCostUsd),
      recordCount: Number(r.recordCount),
      topReason: r.topReason as DiscardReason,
    }))
  }

  // Tendencia diaria para la gráfica del dashboard
  async getDailyTrend(
    buildingId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<WasteTrendPoint[]> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        DATE(recorded_at)::text               AS "date",
        COALESCE(SUM(quantity_kg), 0)         AS "totalKg",
        COALESCE(SUM(estimated_cost_usd), 0)  AS "totalCostUsd",
        COUNT(*)::int                         AS "recordCount"
      FROM waste_logs
      WHERE
        building_id   = ${buildingId}
        AND recorded_at >= ${fromDate}
        AND recorded_at <= ${toDate}
      GROUP BY DATE(recorded_at)
      ORDER BY DATE(recorded_at) ASC
    `

    return rows.map((r) => ({
      date: r.date,
      totalKg: Number(r.totalKg),
      totalCostUsd: Number(r.totalCostUsd),
      recordCount: Number(r.recordCount),
    }))
  }

  async getTotalCost(buildingId: string, fromDate: Date, toDate: Date): Promise<number> {
    const result = await this.prisma.wasteLog.aggregate({
      where: {
        buildingId,
        recordedAt: { gte: fromDate, lte: toDate },
      },
      _sum: { estimatedCostUsd: true },
    })
    return result._sum.estimatedCostUsd ?? 0
  }

  private mapLog(r: any): WasteLog {
    return {
      id: r.id,
      buildingId: r.buildingId,
      recordedById: r.recordedById,
      productName: r.productName,
      quantityKg: r.quantityKg ?? null,
      quantityUnits: r.quantityUnits ?? null,
      estimatedCostUsd: r.estimatedCostUsd ?? null,
      discardReason: r.discardReason,
      shift: r.shift,
      notes: r.notes ?? null,
      recordedAt: r.recordedAt,
    }
  }
}
