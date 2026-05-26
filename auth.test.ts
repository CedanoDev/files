// ─────────────────────────────────────────────
// tests/use-cases/auth/auth.test.ts
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Login, RefreshToken, Logout } from '../../../use-cases/auth/auth.use-cases'
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserInactiveError,
} from '../../../domain/entities/Auth'

// ─────────────────────────────────────────────
// Factories y mocks
// ─────────────────────────────────────────────

function makeAuthRepo() {
  return {
    findUserByEmail:     vi.fn(),
    findUserById:        vi.fn(),
    saveRefreshToken:    vi.fn().mockResolvedValue({ id: 'rt-1', userId: 'u-1', tokenHash: 'hashed', expiresAt: new Date(), revokedAt: null, createdAt: new Date() }),
    findRefreshToken:    vi.fn(),
    revokeRefreshToken:  vi.fn().mockResolvedValue(undefined),
    revokeAllUserTokens: vi.fn().mockResolvedValue(undefined),
  }
}

function makeTokenService() {
  return {
    generateAccessToken:  vi.fn().mockReturnValue('access-token-xyz'),
    generateRefreshToken: vi.fn().mockReturnValue('refresh-token-abc'),
    verifyAccessToken:    vi.fn(),
    hashToken:            vi.fn((t: string) => `hashed:${t}`),
    comparePassword:      vi.fn(),
  }
}

function makeActiveUser(overrides = {}) {
  return {
    id:           'user-1',
    name:         'Carlos M.',
    email:        'carlos@storyland.com',
    role:         'EMPLOYEE' as const,
    buildingId:   'building-1',
    passwordHash: '$2a$10$hashedpassword',
    isActive:     true,
    ...overrides,
  }
}

function makeRefreshTokenRecord(overrides = {}) {
  return {
    id:        'rt-1',
    userId:    'user-1',
    tokenHash: 'hashed:refresh-token-abc',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días en el futuro
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ══════════════════════════════════════════════
// Login
// ══════════════════════════════════════════════

describe('Login', () => {
  function makeUseCase() {
    const authRepo     = makeAuthRepo()
    const tokenService = makeTokenService()
    const useCase      = new Login(authRepo, tokenService)
    return { useCase, authRepo, tokenService }
  }

  it('retorna usuario y tokens cuando las credenciales son correctas', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(makeActiveUser())
    tokenService.comparePassword.mockResolvedValue(true)

    const result = await useCase.execute({
      email:    'carlos@storyland.com',
      password: 'demo123',
    })

    expect(result.user.email).toBe('carlos@storyland.com')
    expect(result.user.role).toBe('EMPLOYEE')
    expect(result.tokens.accessToken).toBe('access-token-xyz')
    expect(result.tokens.refreshToken).toBe('refresh-token-abc')
  })

  it('guarda el refresh token hasheado en la BD (nunca el plano)', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(makeActiveUser())
    tokenService.comparePassword.mockResolvedValue(true)

    await useCase.execute({ email: 'carlos@storyland.com', password: 'demo123' })

    expect(authRepo.saveRefreshToken).toHaveBeenCalledWith(
      'user-1',
      'hashed:refresh-token-abc',  // hash, no el token plano
      expect.any(Date)
    )
  })

  it('normaliza el email a minúsculas antes de buscar', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(makeActiveUser())
    tokenService.comparePassword.mockResolvedValue(true)

    await useCase.execute({ email: '  CARLOS@STORYLAND.COM  ', password: 'demo123' })

    expect(authRepo.findUserByEmail).toHaveBeenCalledWith('carlos@storyland.com')
  })

  it('lanza InvalidCredentialsError si el usuario no existe', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(null)

    await expect(
      useCase.execute({ email: 'noexiste@x.com', password: '123' })
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('lanza InvalidCredentialsError si la contraseña es incorrecta', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(makeActiveUser())
    tokenService.comparePassword.mockResolvedValue(false)

    await expect(
      useCase.execute({ email: 'carlos@storyland.com', password: 'wrong' })
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('lanza UserInactiveError si la cuenta está desactivada', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(makeActiveUser({ isActive: false }))
    tokenService.comparePassword.mockResolvedValue(true)

    await expect(
      useCase.execute({ email: 'carlos@storyland.com', password: 'demo123' })
    ).rejects.toThrow(UserInactiveError)
  })

  it('no revela si el email existe o no (mismo error en ambos casos)', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()

    // Caso 1: email no existe
    authRepo.findUserByEmail.mockResolvedValue(null)
    const error1 = await useCase.execute({ email: 'no@existe.com', password: 'x' }).catch(e => e)

    // Caso 2: contraseña incorrecta
    authRepo.findUserByEmail.mockResolvedValue(makeActiveUser())
    tokenService.comparePassword.mockResolvedValue(false)
    const error2 = await useCase.execute({ email: 'carlos@storyland.com', password: 'wrong' }).catch(e => e)

    // Mismo tipo de error en ambos casos → no revela información
    expect(error1).toBeInstanceOf(InvalidCredentialsError)
    expect(error2).toBeInstanceOf(InvalidCredentialsError)
    expect(error1.message).toBe(error2.message)
  })

  it('no guarda el refresh token si las credenciales son inválidas', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findUserByEmail.mockResolvedValue(null)

    await expect(useCase.execute({ email: 'x@x.com', password: 'x' })).rejects.toThrow()
    expect(authRepo.saveRefreshToken).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════
// RefreshToken
// ══════════════════════════════════════════════

describe('RefreshToken', () => {
  function makeUseCase() {
    const authRepo     = makeAuthRepo()
    const tokenService = makeTokenService()
    const useCase      = new RefreshToken(authRepo, tokenService)
    return { useCase, authRepo, tokenService }
  }

  it('emite nuevos tokens cuando el refresh token es válido', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(makeRefreshTokenRecord())
    authRepo.findUserById.mockResolvedValue(makeActiveUser())

    const result = await useCase.execute({ refreshToken: 'refresh-token-abc' })

    expect(result.tokens.accessToken).toBe('access-token-xyz')
    expect(result.tokens.refreshToken).toBe('refresh-token-abc')
    expect(result.user.id).toBe('user-1')
  })

  it('revoca el token anterior (rotación de tokens)', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(makeRefreshTokenRecord())
    authRepo.findUserById.mockResolvedValue(makeActiveUser())

    await useCase.execute({ refreshToken: 'refresh-token-abc' })

    // El token anterior debe ser revocado
    expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith('hashed:refresh-token-abc')
    // Y uno nuevo debe ser guardado
    expect(authRepo.saveRefreshToken).toHaveBeenCalledOnce()
  })

  it('lanza InvalidRefreshTokenError si el token no existe en la BD', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(null)

    await expect(
      useCase.execute({ refreshToken: 'token-inexistente' })
    ).rejects.toThrow(InvalidRefreshTokenError)
  })

  it('lanza InvalidRefreshTokenError si el token fue revocado', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(
      makeRefreshTokenRecord({ revokedAt: new Date() })
    )

    await expect(
      useCase.execute({ refreshToken: 'refresh-token-abc' })
    ).rejects.toThrow(InvalidRefreshTokenError)
  })

  it('lanza InvalidRefreshTokenError si el token está expirado', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(
      makeRefreshTokenRecord({
        expiresAt: new Date(Date.now() - 1000),  // expiró hace 1 segundo
      })
    )

    await expect(
      useCase.execute({ refreshToken: 'refresh-token-abc' })
    ).rejects.toThrow(InvalidRefreshTokenError)
  })

  it('lanza InvalidRefreshTokenError si el usuario fue desactivado', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(makeRefreshTokenRecord())
    authRepo.findUserById.mockResolvedValue(makeActiveUser({ isActive: false }))

    await expect(
      useCase.execute({ refreshToken: 'refresh-token-abc' })
    ).rejects.toThrow(InvalidRefreshTokenError)
  })

  it('no emite tokens si el usuario ya no existe', async () => {
    const { useCase, authRepo } = makeUseCase()
    authRepo.findRefreshToken.mockResolvedValue(makeRefreshTokenRecord())
    authRepo.findUserById.mockResolvedValue(null)

    await expect(
      useCase.execute({ refreshToken: 'refresh-token-abc' })
    ).rejects.toThrow(InvalidRefreshTokenError)
  })
})

// ══════════════════════════════════════════════
// Logout
// ══════════════════════════════════════════════

describe('Logout', () => {
  function makeUseCase() {
    const authRepo     = makeAuthRepo()
    const tokenService = makeTokenService()
    const useCase      = new Logout(authRepo, tokenService)
    return { useCase, authRepo, tokenService }
  }

  it('revoca el refresh token actual', async () => {
    const { useCase, authRepo, tokenService } = makeUseCase()

    await useCase.execute({ refreshToken: 'refresh-token-abc' })

    expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith('hashed:refresh-token-abc')
    expect(authRepo.revokeAllUserTokens).not.toHaveBeenCalled()
  })

  it('revoca todos los tokens cuando logoutAll=true', async () => {
    const { useCase, authRepo } = makeUseCase()

    await useCase.execute({
      refreshToken: 'refresh-token-abc',
      logoutAll:    true,
      userId:       'user-1',
    })

    expect(authRepo.revokeAllUserTokens).toHaveBeenCalledWith('user-1')
    expect(authRepo.revokeRefreshToken).not.toHaveBeenCalled()
  })

  it('es idempotente — no falla si el token ya fue revocado', async () => {
    const { useCase, authRepo } = makeUseCase()
    // revokeRefreshToken no lanza error aunque el token no exista
    authRepo.revokeRefreshToken.mockResolvedValue(undefined)

    await expect(
      useCase.execute({ refreshToken: 'token-ya-revocado' })
    ).resolves.toBeUndefined()
  })

  it('no llama revokeAllUserTokens si logoutAll=true pero no hay userId', async () => {
    const { useCase, authRepo } = makeUseCase()

    await useCase.execute({
      refreshToken: 'refresh-token-abc',
      logoutAll:    true,
      // userId no provisto
    })

    // Sin userId no puede revocar todos → cae al flujo normal
    expect(authRepo.revokeRefreshToken).toHaveBeenCalledOnce()
    expect(authRepo.revokeAllUserTokens).not.toHaveBeenCalled()
  })
})
