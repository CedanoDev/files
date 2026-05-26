// ─────────────────────────────────────────────
// DOMAIN REPOSITORY INTERFACE — IChecklistRepository
// ─────────────────────────────────────────────

import { Shift } from '../entities/FoodTemperature'
import {
  TaskTemplate,
  ChecklistSession,
  ChecklistItem,
  ChecklistSessionDetail,
  ChecklistMoment,
} from '../entities/Checklist'

// ── DTOs de escritura ─────────────────────────

export interface CreateSessionDTO {
  buildingId: string
  supervisorId: string
  sessionDate: Date
  shift: Shift
  moment: ChecklistMoment
}

export interface CreateSessionItemDTO {
  sessionId: string
  templateId: string
  templateTitle: string
}

export interface CompleteItemDTO {
  itemId: string
  completedById: string
  observation?: string
}

// ── Contrato del repositorio ──────────────────

export interface IChecklistRepository {
  // Templates
  findTemplatesForBuilding(
    buildingId: string,
    moment: ChecklistMoment
  ): Promise<TaskTemplate[]>

  // Sessions
  findSession(
    buildingId: string,
    sessionDate: Date,
    shift: Shift,
    moment: ChecklistMoment
  ): Promise<ChecklistSession | null>

  findSessionById(sessionId: string): Promise<ChecklistSession | null>

  findSessionDetail(sessionId: string): Promise<ChecklistSessionDetail | null>

  createSession(data: CreateSessionDTO): Promise<ChecklistSession>

  signSession(sessionId: string, signedAt: Date): Promise<ChecklistSession>

  // Items
  createSessionItems(items: CreateSessionItemDTO[]): Promise<void>

  findItemById(itemId: string): Promise<ChecklistItem | null>

  completeItem(data: CompleteItemDTO): Promise<ChecklistItem>

  findItemsBySession(sessionId: string): Promise<ChecklistItem[]>
}
