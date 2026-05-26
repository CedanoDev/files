// ─────────────────────────────────────────────
// USE CASE — CompleteChecklistItem
//
// Responsabilidades:
//   1. Verificar que la sesión existe y no está firmada
//   2. Verificar que el ítem pertenece a esa sesión
//   3. Marcar el ítem como completado con timestamp y usuario
//   4. Devolver el ítem actualizado y el progreso de la sesión
// ─────────────────────────────────────────────

import {
  ChecklistItem,
  ChecklistCompletionRate,
  SessionNotFoundError,
  SessionAlreadySignedError,
  ItemNotFoundError,
  ItemBelongsToDifferentSessionError,
} from '../../domain/entities/Checklist'
import { IChecklistRepository } from '../../domain/repositories/IChecklistRepository'

// ── Input / Output ────────────────────────────

export interface CompleteChecklistItemInput {
  sessionId: string
  itemId: string
  completedById: string
  observation?: string
}

export interface CompleteChecklistItemOutput {
  item: ChecklistItem
  completionRate: number   // 0-100 — progreso total de la sesión
  allCompleted: boolean    // true si todas las tareas están listas → listo para firmar
  message: string
}

// ── Use Case ─────────────────────────────────

export class CompleteChecklistItem {
  constructor(private readonly checklistRepo: IChecklistRepository) {}

  async execute(input: CompleteChecklistItemInput): Promise<CompleteChecklistItemOutput> {
    // 1. Verificar que la sesión existe
    const session = await this.checklistRepo.findSessionById(input.sessionId)
    if (!session) throw new SessionNotFoundError(input.sessionId)

    // 2. Verificar que la sesión no está firmada (inmutable tras firma)
    if (session.isSigned) throw new SessionAlreadySignedError()

    // 3. Verificar que el ítem existe
    const item = await this.checklistRepo.findItemById(input.itemId)
    if (!item) throw new ItemNotFoundError(input.itemId)

    // 4. Verificar que el ítem pertenece a esta sesión
    if (item.sessionId !== input.sessionId) {
      throw new ItemBelongsToDifferentSessionError()
    }

    // 5. Marcar como completado
    const updatedItem = await this.checklistRepo.completeItem({
      itemId: input.itemId,
      completedById: input.completedById,
      observation: input.observation,
    })

    // 6. Calcular progreso actualizado de la sesión
    const allItems = await this.checklistRepo.findItemsBySession(input.sessionId)
    const completionRate = ChecklistCompletionRate.calculate(allItems)
    const allCompleted = completionRate === 100

    const message = allCompleted
      ? '¡Todas las tareas completadas! La sesión está lista para firmar.'
      : `Tarea completada. Progreso: ${completionRate}% (${allItems.filter((i) => i.isCompleted).length}/${allItems.length} tareas).`

    return {
      item: updatedItem,
      completionRate,
      allCompleted,
      message,
    }
  }
}
