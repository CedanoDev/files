// ─────────────────────────────────────────────
// DOMAIN REPOSITORY INTERFACE — IStockRepository
// ─────────────────────────────────────────────

import { StockRequest, StockRequestItem, StockRequestStatus } from '../entities/Stock'

export interface CreateStockRequestDTO {
  buildingId: string
  createdById: string
  requestDate: Date
  notes?: string
  items: {
    productName: string
    unit: string
    quantityRequested: number
    quantitySuggested?: number
  }[]
}

export interface WasteHistoryEntry {
  productName: string
  totalWasteKg: number
  totalWasteUnits: number
  recordCount: number   // cuántos días tiene historia
}

export interface IStockRepository {
  createRequest(data: CreateStockRequestDTO): Promise<StockRequest>
  findRequestById(id: string): Promise<StockRequest | null>
  findRequestsByBuilding(buildingId: string, limit?: number): Promise<StockRequest[]>
  updateStatus(id: string, status: StockRequestStatus, timestamp: Date): Promise<StockRequest>

  // Para GetStockSuggestion: historial de lo pedido por producto
  getAverageRequestedByProduct(
    buildingId: string,
    productName: string,
    lastNDays: number
  ): Promise<number>

  // Para GetStockSuggestion: historial de desperdicio por producto
  getWasteHistoryByBuilding(
    buildingId: string,
    lastNDays: number
  ): Promise<WasteHistoryEntry[]>
}
