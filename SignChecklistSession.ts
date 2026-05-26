// ─────────────────────────────────────────────
// USE CASE — SignChecklistSession
//
// Responsabilidades:
//   1. Verificar que la sesión existe
//   2. Verificar que no está ya firmada
//   3. Verificar que quien firma es el supervisor asignado
//      o un admin
//   4. Verificar que TODAS las tareas estén completadas
//      (no se puede firmar una sesión incompleta)
//   5. Firmar con timestamp
//   6. Devolver la sesión firmada completa
// ─────────────────────────────────────────────

import {
  ChecklistSessionDetail,
  ChecklistCompletionRate,
  SessionNotFoundError,
  SessionAlreadySignedError,
  SessionIncompleteError,
} from '../../domain/entities/Checklist'
import { IChecklistRepository } from '../../domain/repositories/IChecklistRepository'

// ── Input / Output ────────────────────────────

export interface SignChecklistSessionInput {
  sessionId: string
  signedById: string
  signedByRole: 'ADMIN' | 'SUPERVISOR' | 'EMPLOYEE'
}

export interface SignChecklistSessionOutput {
  session: ChecklistSessionDetail
  message: string
}

// ── Errores específicos ───────────────────────

export class UnauthorizedSignatureError extends Error {
  constructor() {
    super('Solo el supervisor asignado o un administrador puede firmar esta sesión.')
    this.name = 'UnauthorizedSignatureError'
  }
}

// ── Use Case ─────────────────────────────────

export class SignChecklistSession {
  constructor(private readonly checklistRepo: IChecklistRepository) {}

  async execute(input: SignChecklistSessionInput): Promise<SignChecklistSessionOutput> {
    // 1. Verificar que la sesión existe con todos sus ítems
    const sessionDetail = await this.checklistRepo.findSessionDetail(input.sessionId)
    if (!sessionDetail) throw new SessionNotFoundError(input.sessionId)

    // 2. Verificar que no está ya firmada
    if (sessionDetail.isSigned) throw new SessionAlreadySignedError()

    // 3. Verificar autorización:
    //    Solo el supervisor asignado o un admin puede firmar
    const isAuthorized =
      input.signedByRole === 'ADMIN' ||
      sessionDetail.supervisorId === input.signedById

    if (!isAuthorized) throw new UnauthorizedSignatureError()

    // 4. Verificar que todas las tareas estén completadas
    const completionRate = ChecklistCompletionRate.calculate(sessionDetail.items)
    if (completionRate < 100) throw new SessionIncompleteError(completionRate)

    // 5. Firmar la sesión con timestamp actual
    const signedAt = new Date()
    await this.checklistRepo.signSession(input.sessionId, signedAt)

    // 6. Devolver la sesión firmada y actualizada
    const signedSession = await this.checklistRepo.findSessionDetail(input.sessionId)

    return {
      session: signedSession!,
      message: `Sesión firmada correctamente a las ${signedAt.toLocaleTimeString('es-DO')}. Todas las tareas verificadas.`,
    }
  }
}
