// ─────────────────────────────────────────────
// INFRASTRUCTURE — PrismaStockRepository
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { StockRequest, StockRequestItem, StockRequestStatus } from '../../domain/entities/Stock'
import {
  IStockRepository,
  CreateStockRequestDTO,
  WasteHistoryEntry,
} from '../../domain/repositories/IStockRepository'

export class PrismaStockRepository implements IStockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRequest(data: CreateStockRequestDTO): Promise<StockRequest> {
    const record = await this.prisma.stockRequest.create({
      data: {
        buildingId: data.buildingId,
        createdById: data.createdById,
        requestDate: data.requestDate,
        notes: data.notes,
        items: {
          create: data.items.map((i) => ({
            productName: i.productName,
            unit: i.unit,
            quantityRequested: i.quantityRequested,
            quantitySuggested: i.quantitySuggested ?? null,
          })),
        },
      },
      include: { items: true },
    })
    return this.mapRequest(record)
  }

  async findRequestById(id: string): Promise<StockRequest | null> {
    const record = await this.prisma.stockRequest.findUnique({
      where: { id },
      include: { items: true },
    })
    return record ? this.mapRequest(record) : null
  }

  async findRequestsByBuilding(buildingId: string, limit = 20): Promise<StockRequest[]> {
    const records = await this.prisma.stockRequest.findMany({
      where: { buildingId },
      include: { items: true },
      orderBy: { requestDate: 'desc' },
      take: limit,
    })
    return records.map(this.mapRequest)
  }

  async updateStatus(
    id: string,
    status: StockRequestStatus,
    timestamp: Date
  ): Promise<StockRequest> {
    const data: any = { status }
    if (status === 'SUBMITTED') data.submittedAt = timestamp
    if (status === 'DISPATCHED') data.dispatchedAt = timestamp

    const record = await this.prisma.stockRequest.update({
      where: { id },
      data,
      include: { items: true },
    })
    return this.mapRequest(record)
  }

  // Promedio de unidades pedidas por producto en los últimos N días
  async getAverageRequestedByProduct(
    buildingId: string,
    productName: string,
    lastNDays: number
  ): Promise<number> {
    const since = new Date()
    since.setDate(since.getDate() - lastNDays)

    const result = await this.prisma.stockRequestItem.aggregate({
      where: {
        request: {
          buildingId,
          requestDate: { gte: since },
          status: { in: ['SUBMITTED', 'DISPATCHED'] }, // solo pedidos enviados
        },
        productName: { equals: productName, mode: 'insensitive' },
      },
      _avg: { quantityRequested: true },
      _count: true,
    })

    return result._avg.quantityRequested ?? 0
  }

  // Historial de desperdicio agrupado por producto (últimos N días)
  async getWasteHistoryByBuilding(
    buildingId: string,
    lastNDays: number
  ): Promise<WasteHistoryEntry[]> {
    const since = new Date()
    since.setDate(since.getDate() - lastNDays)

    // Usamos groupBy de Prisma para agregar por productName
    const grouped = await this.prisma.wasteLog.groupBy({
      by: ['productName'],
      where: {
        buildingId,
        recordedAt: { gte: since },
      },
      _sum: {
        quantityKg: true,
        quantityUnits: true,
      },
      _count: { id: true },
    })

    return grouped.map((g) => ({
      productName: g.productName,
      totalWasteKg: g._sum.quantityKg ?? 0,
      totalWasteUnits: g._sum.quantityUnits ?? 0,
      recordCount: g._count.id,
    }))
  }

  // ── Mappers ───────────────────────────────

  private mapRequest(r: any): StockRequest {
    return {
      id: r.id,
      buildingId: r.buildingId,
      createdById: r.createdById,
      requestDate: r.requestDate,
      status: r.status,
      notes: r.notes ?? null,
      submittedAt: r.submittedAt ?? null,
      dispatchedAt: r.dispatchedAt ?? null,
      createdAt: r.createdAt,
      items: (r.items ?? []).map(this.mapItem),
    }
  }

  private mapItem(i: any): StockRequestItem {
    return {
      id: i.id,
      requestId: i.requestId,
      productName: i.productName,
      unit: i.unit,
      quantityRequested: i.quantityRequested,
      quantitySuggested: i.quantitySuggested ?? null,
      quantityDispatched: i.quantityDispatched ?? null,
    }
  }
}
