// ─────────────────────────────────────────────
// src/tests/helpers/factories.ts
//
// Factories para crear objetos de dominio en tests.
// Evita repetir la misma data en cada test file.
// ─────────────────────────────────────────────

import { vi } from 'vitest'
import { FoodTemperature } from '../../domain/entities/FoodTemperature'
import { WasteLog } from '../../domain/entities/Waste'
import { ChecklistSession, ChecklistItem, TaskTemplate } from '../../domain/entities/Checklist'
import { StockRequest, StockRequestItem } from '../../domain/entities/Stock'

// ── ID helpers ────────────────────────────────

let counter = 0
export function fakeId(prefix = 'id'): string {
  return `${prefix}-${++counter}`
}

export function resetCounter() { counter = 0 }

// ── Factories de dominio ──────────────────────

export function makeBuilding(overrides = {}) {
  return {
    id:         fakeId('building'),
    name:       'Ice Cream Village',
    location:   'Zona norte',
    isActive:   true,
    ...overrides,
  }
}

export function makeUser(overrides = {}) {
  return {
    id:           fakeId('user'),
    name:         'Carlos M.',
    email:        'carlos@storyland.com',
    role:         'EMPLOYEE' as const,
    buildingId:   'building-1',
    isActive:     true,
    ...overrides,
  }
}

export function makeFoodTemperature(overrides: Partial<FoodTemperature> = {}): FoodTemperature {
  return {
    id:           fakeId('temp'),
    buildingId:   'building-1',
    recordedById: 'user-1',
    foodItem:     'Hot Dogs',
    temperatureC: 65,
    minSafeTemp:  60,
    maxSafeTemp:  999,
    isInRange:    true,
    shift:        'MORNING',
    notes:        undefined,
    recordedAt:   new Date('2025-07-04T10:00:00Z'),
    ...overrides,
  }
}

export function makeWasteLog(overrides: Partial<WasteLog> = {}): WasteLog {
  return {
    id:               fakeId('waste'),
    buildingId:       'building-1',
    recordedById:     'user-1',
    productName:      'Hot Dogs',
    quantityKg:       3.5,
    quantityUnits:    null,
    estimatedCostUsd: 15.75,
    discardReason:    'OVERPRODUCTION',
    shift:            'CLOSING',
    notes:            null,
    recordedAt:       new Date('2025-07-04T22:00:00Z'),
    ...overrides,
  }
}

export function makeTaskTemplate(overrides: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id:         fakeId('template'),
    title:      'Verificar temperatura de freezers',
    moment:     'OPENING',
    sortOrder:  1,
    isActive:   true,
    buildingId: null,   // global
    ...overrides,
  }
}

export function makeChecklistSession(overrides: Partial<ChecklistSession> = {}): ChecklistSession {
  return {
    id:           fakeId('session'),
    buildingId:   'building-1',
    supervisorId: 'user-super',
    sessionDate:  new Date('2025-07-04'),
    shift:        'MORNING',
    moment:       'OPENING',
    isSigned:     false,
    signedAt:     null,
    createdAt:    new Date('2025-07-04T08:00:00Z'),
    ...overrides,
  }
}

export function makeChecklistItem(
  sessionId: string,
  overrides: Partial<ChecklistItem> = {}
): ChecklistItem {
  return {
    id:             fakeId('item'),
    sessionId,
    templateId:     fakeId('template'),
    templateTitle:  'Verificar temperatura de freezers',
    isCompleted:    false,
    observation:    null,
    completedAt:    null,
    completedById:  null,
    ...overrides,
  }
}

export function makeStockRequest(overrides: Partial<StockRequest> = {}): StockRequest {
  return {
    id:           fakeId('stock'),
    buildingId:   'building-1',
    createdById:  'user-super',
    requestDate:  new Date('2025-07-04'),
    status:       'DRAFT',
    notes:        null,
    submittedAt:  null,
    dispatchedAt: null,
    createdAt:    new Date('2025-07-04T20:00:00Z'),
    items:        [],
    ...overrides,
  }
}

export function makeStockItem(
  requestId: string,
  overrides: Partial<StockRequestItem> = {}
): StockRequestItem {
  return {
    id:                fakeId('stock-item'),
    requestId,
    productName:       'Hot Dogs',
    unit:              'kg',
    quantityRequested: 18,
    quantitySuggested: 12,
    quantityDispatched: null,
    ...overrides,
  }
}

// ── Mock repositories ─────────────────────────
// Factories de repositorios falsos para inyectar en use cases

export function makeMockTemperatureRepo() {
  return {
    createFoodTemperature: vi.fn(),
    findFoodTemperatures:  vi.fn().mockResolvedValue([]),
    findOutOfRangeToday:   vi.fn().mockResolvedValue([]),
  }
}

export function makeMockChecklistRepo() {
  return {
    findTemplatesForBuilding: vi.fn().mockResolvedValue([]),
    findSession:              vi.fn().mockResolvedValue(null),
    findSessionById:          vi.fn().mockResolvedValue(null),
    findSessionDetail:        vi.fn().mockResolvedValue(null),
    createSession:            vi.fn(),
    signSession:              vi.fn(),
    createSessionItems:       vi.fn().mockResolvedValue(undefined),
    findItemById:             vi.fn().mockResolvedValue(null),
    completeItem:             vi.fn(),
    findItemsBySession:       vi.fn().mockResolvedValue([]),
  }
}

export function makeMockStockRepo() {
  return {
    createRequest:                  vi.fn(),
    findRequestById:                vi.fn().mockResolvedValue(null),
    findRequestsByBuilding:         vi.fn().mockResolvedValue([]),
    updateStatus:                   vi.fn(),
    getAverageRequestedByProduct:   vi.fn().mockResolvedValue(0),
    getWasteHistoryByBuilding:      vi.fn().mockResolvedValue([]),
  }
}

export function makeMockWasteRepo() {
  return {
    createWasteLog:         vi.fn(),
    findWasteLogs:          vi.fn().mockResolvedValue([]),
    getSummaryByProduct:    vi.fn().mockResolvedValue([]),
    getDailyTrend:          vi.fn().mockResolvedValue([]),
    getTotalCost:           vi.fn().mockResolvedValue(0),
  }
}

export function makeMockBuildingRepo(found = true) {
  return {
    findById: vi.fn().mockResolvedValue(found ? makeBuilding() : null),
  }
}

export function makeMockUserRepo(found = true) {
  return {
    findById: vi.fn().mockResolvedValue(found ? makeUser() : null),
  }
}

export function makeMockEmailService() {
  return {
    sendTemperatureAlert: vi.fn().mockResolvedValue(undefined),
  }
}
