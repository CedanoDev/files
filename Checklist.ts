// ─────────────────────────────────────────────
// DOMAIN ENTITIES — Checklist
// Verdad del negocio. Sin dependencias externas.
// ─────────────────────────────────────────────

import { Shift } from './FoodTemperature'

export type ChecklistMoment = 'OPENING' | 'DURING' | 'CLOSING'

// Plantilla de tarea definida por el admin
export interface TaskTemplate {
  id: string
  title: string
  moment: ChecklistMoment
  sortOrder: number
  isActive: boolean
  buildingId: string | null // null = global para todos los edificios
}

// Sesión diaria del checklist (una por momento/turno/edificio)
export interface ChecklistSession {
  id: string
  buildingId: string
  supervisorId: string
  sessionDate: Date
  shift: Shift
  moment: ChecklistMoment
  isSigned: boolean
  signedAt: Date | null
  createdAt: Date
}

// Cada ítem dentro de una sesión
export interface ChecklistItem {
  id: string
  sessionId: string
  templateId: string
  templateTitle: string   // desnormalizado para mostrar en UI sin joins
  isCompleted: boolean
  observation: string | null
  completedAt: Date | null
  completedById: string | null
}

// Sesión con sus ítems (lo que se devuelve al cliente)
export interface ChecklistSessionDetail extends ChecklistSession {
  items: ChecklistItem[]
  completionRate: number  // 0-100
}

// ── Value Objects ─────────────────────────────

export const MOMENT_LABELS: Record<ChecklistMoment, string> = {
  OPENING: 'Apertura',
  DURING: 'Durante operación',
  CLOSING: 'Cierre',
}

export class ChecklistCompletionRate {
  static calculate(items: ChecklistItem[]): number {
    if (items.length === 0) return 0
    const completed = items.filter((i) => i.isCompleted).length
    return Math.round((completed / items.length) * 100)
  }
}

// ── Errores de dominio ────────────────────────

export class SessionAlreadyExistsError extends Error {
  constructor(buildingId: string, moment: ChecklistMoment, shift: Shift) {
    super(
      `Ya existe una sesión de ${MOMENT_LABELS[moment]} para este edificio en el turno ${shift}.`
    )
    this.name = 'SessionAlreadyExistsError'
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Sesión de checklist no encontrada: ${sessionId}`)
    this.name = 'SessionNotFoundError'
  }
}

export class SessionAlreadySignedError extends Error {
  constructor() {
    super('Esta sesión ya fue firmada y no puede modificarse.')
    this.name = 'SessionAlreadySignedError'
  }
}

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Ítem de checklist no encontrado: ${itemId}`)
    this.name = 'ItemNotFoundError'
  }
}

export class ItemBelongsToDifferentSessionError extends Error {
  constructor() {
    super('El ítem no pertenece a la sesión indicada.')
    this.name = 'ItemBelongsToDifferentSessionError'
  }
}

export class SessionIncompleteError extends Error {
  constructor(completionRate: number) {
    super(
      `No puedes firmar una sesión incompleta. Progreso actual: ${completionRate}%. Debes completar todas las tareas.`
    )
    this.name = 'SessionIncompleteError'
  }
}
