// ─────────────────────────────────────────────
// USE CASE — OpenChecklistSession
//
// Responsabilidades:
//   1. Verificar que no exista ya una sesión para ese
//      edificio + fecha + turno + momento
//   2. Obtener todas las plantillas de tareas aplicables
//      (globales + específicas del edificio)
//   3. Crear la sesión con sus ítems pre-poblados
//   4. Devolver la sesión lista para que el empleado
//      empiece a marcar tareas
// ─────────────────────────────────────────────

import { Shift } from '../../domain/entities/FoodTemperature'
import {
  ChecklistMoment,
  ChecklistSessionDetail,
  SessionAlreadyExistsError,
} from '../../domain/entities/Checklist'
import { IChecklistRepository } from '../../domain/repositories/IChecklistRepository'
import { IBuildingRepository } from './RecordFoodTemperature'
import { BuildingNotFoundError } from './RecordFoodTemperature'

// ── Input / Output ────────────────────────────

export interface OpenChecklistSessionInput {
  buildingId: string
  supervisorId: string
  shift: Shift
  moment: ChecklistMoment
  sessionDate?: Date // por defecto: hoy
}

export interface OpenChecklistSessionOutput {
  session: ChecklistSessionDetail
  isNew: boolean    // false si la sesión ya existía (se devuelve la existente)
  message: string
}

// ── Use Case ─────────────────────────────────

export class OpenChecklistSession {
  constructor(
    private readonly checklistRepo: IChecklistRepository,
    private readonly buildingRepo: IBuildingRepository
  ) {}

  async execute(input: OpenChecklistSessionInput): Promise<OpenChecklistSessionOutput> {
    const sessionDate = input.sessionDate ?? new Date()
    // Normalizar la fecha a medianoche para evitar duplicados por hora
    const dateOnly = new Date(sessionDate)
    dateOnly.setHours(0, 0, 0, 0)

    // 1. Verificar que el edificio existe
    const building = await this.buildingRepo.findById(input.buildingId)
    if (!building) throw new BuildingNotFoundError(input.buildingId)

    // 2. Verificar si ya existe una sesión para este momento
    const existingSession = await this.checklistRepo.findSession(
      input.buildingId,
      dateOnly,
      input.shift,
      input.moment
    )

    if (existingSession) {
      // Si ya existe, devolvemos la sesión existente con sus ítems
      const detail = await this.checklistRepo.findSessionDetail(existingSession.id)
      return {
        session: detail!,
        isNew: false,
        message: `Sesión de ${input.moment} ya abierta. Puedes continuar marcando tareas.`,
      }
    }

    // 3. Obtener plantillas aplicables:
    //    - Las globales (buildingId null) + las específicas de este edificio
    const templates = await this.checklistRepo.findTemplatesForBuilding(
      input.buildingId,
      input.moment
    )

    if (templates.length === 0) {
      throw new Error(
        `No hay tareas configuradas para el momento ${input.moment}. Contacta al administrador.`
      )
    }

    // 4. Crear la sesión
    const session = await this.checklistRepo.createSession({
      buildingId: input.buildingId,
      supervisorId: input.supervisorId,
      sessionDate: dateOnly,
      shift: input.shift,
      moment: input.moment,
    })

    // 5. Crear los ítems a partir de las plantillas (pre-poblados, sin completar)
    await this.checklistRepo.createSessionItems(
      templates.map((t) => ({
        sessionId: session.id,
        templateId: t.id,
        templateTitle: t.title,
      }))
    )

    // 6. Devolver la sesión con todos sus ítems
    const detail = await this.checklistRepo.findSessionDetail(session.id)

    return {
      session: detail!,
      isNew: true,
      message: `Sesión de ${input.moment} abierta con ${templates.length} tareas.`,
    }
  }
}
