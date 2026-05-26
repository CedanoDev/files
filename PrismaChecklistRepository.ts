// ─────────────────────────────────────────────
// INFRASTRUCTURE — PrismaChecklistRepository
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { Shift } from '../../domain/entities/FoodTemperature'
import {
  TaskTemplate,
  ChecklistSession,
  ChecklistItem,
  ChecklistSessionDetail,
  ChecklistMoment,
  ChecklistCompletionRate,
} from '../../domain/entities/Checklist'
import {
  IChecklistRepository,
  CreateSessionDTO,
  CreateSessionItemDTO,
  CompleteItemDTO,
} from '../../domain/repositories/IChecklistRepository'

export class PrismaChecklistRepository implements IChecklistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Templates ─────────────────────────────

  async findTemplatesForBuilding(
    buildingId: string,
    moment: ChecklistMoment
  ): Promise<TaskTemplate[]> {
    const templates = await this.prisma.taskTemplate.findMany({
      where: {
        moment,
        isActive: true,
        OR: [
          { buildingId: null },       // globales
          { buildingId: buildingId }, // específicas de este edificio
        ],
      },
      orderBy: { sortOrder: 'asc' },
    })
    return templates.map(this.mapTemplate)
  }

  // ── Sessions ──────────────────────────────

  async findSession(
    buildingId: string,
    sessionDate: Date,
    shift: Shift,
    moment: ChecklistMoment
  ): Promise<ChecklistSession | null> {
    const record = await this.prisma.checklistSession.findUnique({
      where: {
        buildingId_sessionDate_shift_moment: {
          buildingId,
          sessionDate,
          shift,
          moment,
        },
      },
    })
    return record ? this.mapSession(record) : null
  }

  async findSessionById(sessionId: string): Promise<ChecklistSession | null> {
    const record = await this.prisma.checklistSession.findUnique({
      where: { id: sessionId },
    })
    return record ? this.mapSession(record) : null
  }

  async findSessionDetail(sessionId: string): Promise<ChecklistSessionDetail | null> {
    const record = await this.prisma.checklistSession.findUnique({
      where: { id: sessionId },
      include: {
        items: {
          include: { template: true },
          orderBy: { template: { sortOrder: 'asc' } },
        },
      },
    })

    if (!record) return null

    const items = record.items.map(this.mapItem)
    const completionRate = ChecklistCompletionRate.calculate(items)

    return {
      ...this.mapSession(record),
      items,
      completionRate,
    }
  }

  async createSession(data: CreateSessionDTO): Promise<ChecklistSession> {
    const record = await this.prisma.checklistSession.create({
      data: {
        buildingId: data.buildingId,
        supervisorId: data.supervisorId,
        sessionDate: data.sessionDate,
        shift: data.shift,
        moment: data.moment,
      },
    })
    return this.mapSession(record)
  }

  async signSession(sessionId: string, signedAt: Date): Promise<ChecklistSession> {
    const record = await this.prisma.checklistSession.update({
      where: { id: sessionId },
      data: { isSigned: true, signedAt },
    })
    return this.mapSession(record)
  }

  // ── Items ─────────────────────────────────

  async createSessionItems(items: CreateSessionItemDTO[]): Promise<void> {
    await this.prisma.checklistItem.createMany({
      data: items.map((i) => ({
        sessionId: i.sessionId,
        templateId: i.templateId,
        // templateTitle se guarda desnormalizado para evitar joins en lecturas
      })),
    })
  }

  async findItemById(itemId: string): Promise<ChecklistItem | null> {
    const record = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { template: true },
    })
    return record ? this.mapItem(record) : null
  }

  async completeItem(data: CompleteItemDTO): Promise<ChecklistItem> {
    const record = await this.prisma.checklistItem.update({
      where: { id: data.itemId },
      data: {
        isCompleted: true,
        observation: data.observation,
        completedAt: new Date(),
        completedById: data.completedById,
      },
      include: { template: true },
    })
    return this.mapItem(record)
  }

  async findItemsBySession(sessionId: string): Promise<ChecklistItem[]> {
    const records = await this.prisma.checklistItem.findMany({
      where: { sessionId },
      include: { template: true },
    })
    return records.map(this.mapItem)
  }

  // ── Mappers ───────────────────────────────

  private mapTemplate(r: any): TaskTemplate {
    return {
      id: r.id,
      title: r.title,
      moment: r.moment,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      buildingId: r.buildingId ?? null,
    }
  }

  private mapSession(r: any): ChecklistSession {
    return {
      id: r.id,
      buildingId: r.buildingId,
      supervisorId: r.supervisorId,
      sessionDate: r.sessionDate,
      shift: r.shift,
      moment: r.moment,
      isSigned: r.isSigned,
      signedAt: r.signedAt ?? null,
      createdAt: r.createdAt,
    }
  }

  private mapItem(r: any): ChecklistItem {
    return {
      id: r.id,
      sessionId: r.sessionId,
      templateId: r.templateId,
      templateTitle: r.template?.title ?? '',
      isCompleted: r.isCompleted,
      observation: r.observation ?? null,
      completedAt: r.completedAt ?? null,
      completedById: r.completedById ?? null,
    }
  }
}
