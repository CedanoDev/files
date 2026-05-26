// ─────────────────────────────────────────────
// tests/use-cases/checklist/checklist.test.ts
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { OpenChecklistSession }  from '../../../use-cases/checklist/OpenChecklistSession'
import { CompleteChecklistItem } from '../../../use-cases/checklist/CompleteChecklistItem'
import { SignChecklistSession, UnauthorizedSignatureError } from '../../../use-cases/checklist/SignChecklistSession'
import {
  SessionAlreadySignedError,
  SessionNotFoundError,
  ItemNotFoundError,
  ItemBelongsToDifferentSessionError,
  SessionIncompleteError,
  ChecklistCompletionRate,
} from '../../../domain/entities/Checklist'
import {
  makeMockChecklistRepo,
  makeMockBuildingRepo,
  makeChecklistSession,
  makeChecklistItem,
  makeTaskTemplate,
} from '../../helpers/factories'

// ══════════════════════════════════════════════
// OpenChecklistSession
// ══════════════════════════════════════════════

describe('OpenChecklistSession', () => {
  function makeUseCase(buildingExists = true) {
    const repo         = makeMockChecklistRepo()
    const buildingRepo = makeMockBuildingRepo(buildingExists)
    const useCase      = new OpenChecklistSession(repo, buildingRepo)
    return { useCase, repo, buildingRepo }
  }

  const BASE_INPUT = {
    buildingId:   'building-1',
    supervisorId: 'user-super',
    shift:        'MORNING' as const,
    moment:       'OPENING' as const,
  }

  it('crea una nueva sesión con los ítems de las plantillas', async () => {
    const { useCase, repo } = makeUseCase()
    const templates = [
      makeTaskTemplate({ id: 't1', title: 'Verificar freezers' }),
      makeTaskTemplate({ id: 't2', title: 'Limpiar superficies' }),
    ]
    const session = makeChecklistSession()
    const detail  = { ...session, items: [], completionRate: 0 }

    repo.findTemplatesForBuilding.mockResolvedValue(templates)
    repo.findSession.mockResolvedValue(null)       // no existe aún
    repo.createSession.mockResolvedValue(session)
    repo.findSessionDetail.mockResolvedValue(detail)

    const result = await useCase.execute(BASE_INPUT)

    expect(result.isNew).toBe(true)
    expect(repo.createSession).toHaveBeenCalledOnce()
    expect(repo.createSessionItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ templateId: 't1', templateTitle: 'Verificar freezers' }),
        expect.objectContaining({ templateId: 't2', templateTitle: 'Limpiar superficies' }),
      ])
    )
  })

  it('devuelve la sesión existente si ya fue creada (idempotente)', async () => {
    const { useCase, repo } = makeUseCase()
    const session = makeChecklistSession()
    const detail  = { ...session, items: [], completionRate: 0 }

    repo.findSession.mockResolvedValue(session)
    repo.findSessionDetail.mockResolvedValue(detail)

    const result = await useCase.execute(BASE_INPUT)

    expect(result.isNew).toBe(false)
    expect(repo.createSession).not.toHaveBeenCalled()       // no crea duplicado
    expect(repo.createSessionItems).not.toHaveBeenCalled()
  })

  it('lanza BuildingNotFoundError si el edificio no existe', async () => {
    const { useCase } = makeUseCase(false)
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow('Edificio no encontrado')
  })

  it('lanza Error si no hay plantillas configuradas', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSession.mockResolvedValue(null)
    repo.findTemplatesForBuilding.mockResolvedValue([])  // sin plantillas

    await expect(useCase.execute(BASE_INPUT))
      .rejects.toThrow('No hay tareas configuradas')
  })

  it('el mensaje indica cuántas tareas tiene la nueva sesión', async () => {
    const { useCase, repo } = makeUseCase()
    const templates = [makeTaskTemplate(), makeTaskTemplate(), makeTaskTemplate()]
    const session   = makeChecklistSession()

    repo.findSession.mockResolvedValue(null)
    repo.findTemplatesForBuilding.mockResolvedValue(templates)
    repo.createSession.mockResolvedValue(session)
    repo.findSessionDetail.mockResolvedValue({ ...session, items: [], completionRate: 0 })

    const result = await useCase.execute(BASE_INPUT)
    expect(result.message).toContain('3 tareas')
  })
})

// ══════════════════════════════════════════════
// CompleteChecklistItem
// ══════════════════════════════════════════════

describe('CompleteChecklistItem', () => {
  function makeUseCase() {
    const repo    = makeMockChecklistRepo()
    const useCase = new CompleteChecklistItem(repo)
    return { useCase, repo }
  }

  it('completa un ítem y devuelve el porcentaje actualizado', async () => {
    const { useCase, repo } = makeUseCase()
    const session  = makeChecklistSession({ id: 'session-1' })
    const item     = makeChecklistItem('session-1', { id: 'item-1' })
    const itemDone = { ...item, isCompleted: true, completedAt: new Date(), completedById: 'user-1' }
    const allItems = [
      itemDone,
      makeChecklistItem('session-1', { isCompleted: false }),
    ]

    repo.findSessionById.mockResolvedValue(session)
    repo.findItemById.mockResolvedValue(item)
    repo.completeItem.mockResolvedValue(itemDone)
    repo.findItemsBySession.mockResolvedValue(allItems)

    const result = await useCase.execute({
      sessionId:    'session-1',
      itemId:       'item-1',
      completedById:'user-1',
    })

    expect(result.item.isCompleted).toBe(true)
    expect(result.completionRate).toBe(50)     // 1 de 2
    expect(result.allCompleted).toBe(false)
  })

  it('indica allCompleted=true cuando todas las tareas están listas', async () => {
    const { useCase, repo } = makeUseCase()
    const session   = makeChecklistSession({ id: 'session-1' })
    const item      = makeChecklistItem('session-1', { id: 'item-1' })
    const itemDone  = { ...item, isCompleted: true }
    const allItems  = [
      itemDone,
      makeChecklistItem('session-1', { isCompleted: true }),
    ]

    repo.findSessionById.mockResolvedValue(session)
    repo.findItemById.mockResolvedValue(item)
    repo.completeItem.mockResolvedValue(itemDone)
    repo.findItemsBySession.mockResolvedValue(allItems)

    const result = await useCase.execute({
      sessionId: 'session-1', itemId: 'item-1', completedById: 'user-1',
    })

    expect(result.completionRate).toBe(100)
    expect(result.allCompleted).toBe(true)
    expect(result.message).toContain('lista para firmar')
  })

  it('lanza SessionNotFoundError si la sesión no existe', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionById.mockResolvedValue(null)

    await expect(useCase.execute({
      sessionId: 'no-existe', itemId: 'item-1', completedById: 'user-1',
    })).rejects.toThrow(SessionNotFoundError)
  })

  it('lanza SessionAlreadySignedError si la sesión ya fue firmada', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionById.mockResolvedValue(
      makeChecklistSession({ isSigned: true, signedAt: new Date() })
    )

    await expect(useCase.execute({
      sessionId: 'session-1', itemId: 'item-1', completedById: 'user-1',
    })).rejects.toThrow(SessionAlreadySignedError)
  })

  it('lanza ItemNotFoundError si el ítem no existe', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionById.mockResolvedValue(makeChecklistSession({ id: 'session-1' }))
    repo.findItemById.mockResolvedValue(null)

    await expect(useCase.execute({
      sessionId: 'session-1', itemId: 'no-existe', completedById: 'user-1',
    })).rejects.toThrow(ItemNotFoundError)
  })

  it('lanza ItemBelongsToDifferentSessionError si el ítem es de otra sesión', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionById.mockResolvedValue(makeChecklistSession({ id: 'session-1' }))
    repo.findItemById.mockResolvedValue(
      makeChecklistItem('session-OTRA', { id: 'item-1' })  // pertenece a otra sesión
    )

    await expect(useCase.execute({
      sessionId: 'session-1', itemId: 'item-1', completedById: 'user-1',
    })).rejects.toThrow(ItemBelongsToDifferentSessionError)
  })
})

// ══════════════════════════════════════════════
// SignChecklistSession
// ══════════════════════════════════════════════

describe('SignChecklistSession', () => {
  function makeUseCase() {
    const repo    = makeMockChecklistRepo()
    const useCase = new SignChecklistSession(repo)
    return { useCase, repo }
  }

  function makeFullSession(allCompleted: boolean, supervisorId = 'user-super') {
    const session = makeChecklistSession({ id: 'session-1', supervisorId })
    const items   = [
      makeChecklistItem('session-1', { isCompleted: true }),
      makeChecklistItem('session-1', { isCompleted: allCompleted }),
    ]
    return { ...session, items, completionRate: allCompleted ? 100 : 50 }
  }

  it('firma la sesión cuando todas las tareas están completadas', async () => {
    const { useCase, repo } = makeUseCase()
    const detail  = makeFullSession(true)
    const signed  = { ...detail, isSigned: true, signedAt: new Date() }

    repo.findSessionDetail.mockResolvedValueOnce(detail).mockResolvedValueOnce(signed)
    repo.signSession.mockResolvedValue(signed)

    const result = await useCase.execute({
      sessionId:    'session-1',
      signedById:   'user-super',
      signedByRole: 'SUPERVISOR',
    })

    expect(result.session.isSigned).toBe(true)
    expect(repo.signSession).toHaveBeenCalledWith('session-1', expect.any(Date))
  })

  it('un ADMIN puede firmar cualquier sesión', async () => {
    const { useCase, repo } = makeUseCase()
    const detail = makeFullSession(true, 'otro-supervisor')
    const signed = { ...detail, isSigned: true, signedAt: new Date() }

    repo.findSessionDetail.mockResolvedValueOnce(detail).mockResolvedValueOnce(signed)
    repo.signSession.mockResolvedValue(signed)

    await expect(useCase.execute({
      sessionId:    'session-1',
      signedById:   'user-admin',       // diferente al supervisorId
      signedByRole: 'ADMIN',
    })).resolves.toBeDefined()
  })

  it('lanza SessionIncompleteError si faltan tareas por completar', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionDetail.mockResolvedValue(makeFullSession(false))

    await expect(useCase.execute({
      sessionId: 'session-1', signedById: 'user-super', signedByRole: 'SUPERVISOR',
    })).rejects.toThrow(SessionIncompleteError)
  })

  it('lanza UnauthorizedSignatureError si no es el supervisor asignado', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionDetail.mockResolvedValue(makeFullSession(true, 'otro-supervisor'))

    await expect(useCase.execute({
      sessionId:    'session-1',
      signedById:   'user-diferente',
      signedByRole: 'SUPERVISOR',
    })).rejects.toThrow(UnauthorizedSignatureError)
  })

  it('lanza SessionAlreadySignedError si la sesión ya fue firmada', async () => {
    const { useCase, repo } = makeUseCase()
    const detail = { ...makeFullSession(true), isSigned: true, signedAt: new Date() }
    repo.findSessionDetail.mockResolvedValue(detail)

    await expect(useCase.execute({
      sessionId: 'session-1', signedById: 'user-super', signedByRole: 'SUPERVISOR',
    })).rejects.toThrow(SessionAlreadySignedError)
  })

  it('lanza SessionNotFoundError si la sesión no existe', async () => {
    const { useCase, repo } = makeUseCase()
    repo.findSessionDetail.mockResolvedValue(null)

    await expect(useCase.execute({
      sessionId: 'no-existe', signedById: 'user-super', signedByRole: 'SUPERVISOR',
    })).rejects.toThrow(SessionNotFoundError)
  })
})

// ══════════════════════════════════════════════
// ChecklistCompletionRate (Value Object)
// ══════════════════════════════════════════════

describe('ChecklistCompletionRate', () => {
  it('devuelve 0 si no hay ítems', () => {
    expect(ChecklistCompletionRate.calculate([])).toBe(0)
  })

  it('devuelve 100 si todos los ítems están completados', () => {
    const items = [
      makeChecklistItem('s1', { isCompleted: true }),
      makeChecklistItem('s1', { isCompleted: true }),
    ]
    expect(ChecklistCompletionRate.calculate(items)).toBe(100)
  })

  it('calcula correctamente con ítems parcialmente completados', () => {
    const items = [
      makeChecklistItem('s1', { isCompleted: true }),
      makeChecklistItem('s1', { isCompleted: true }),
      makeChecklistItem('s1', { isCompleted: false }),
      makeChecklistItem('s1', { isCompleted: false }),
    ]
    expect(ChecklistCompletionRate.calculate(items)).toBe(50)
  })

  it('redondea al entero más cercano', () => {
    const items = [
      makeChecklistItem('s1', { isCompleted: true }),
      makeChecklistItem('s1', { isCompleted: false }),
      makeChecklistItem('s1', { isCompleted: false }),
    ]
    expect(ChecklistCompletionRate.calculate(items)).toBe(33)
  })
})
