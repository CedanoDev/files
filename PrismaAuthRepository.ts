// ─────────────────────────────────────────────
// INFRASTRUCTURE — PrismaAuthRepository
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { AuthUser, RefreshTokenRecord } from '../../domain/entities/Auth'
import { IAuthRepository } from '../../domain/repositories/IAuthRepository'

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string) {
    const record = await this.prisma.user.findUnique({
      where: { email },
    })
    if (!record) return null
    return {
      id:           record.id,
      name:         record.name,
      email:        record.email,
      role:         record.role as AuthUser['role'],
      buildingId:   record.buildingId ?? null,
      passwordHash: record.passwordHash,
      isActive:     record.isActive,
    }
  }

  async findUserById(id: string) {
    const record = await this.prisma.user.findUnique({ where: { id } })
    if (!record) return null
    return {
      id:         record.id,
      name:       record.name,
      email:      record.email,
      role:       record.role as AuthUser['role'],
      buildingId: record.buildingId ?? null,
      isActive:   record.isActive,
    }
  }

  async saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<RefreshTokenRecord> {
    const record = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    })
    return this.mapToken(record)
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    })
    return record ? this.mapToken(record) : null
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
  }

  private mapToken(r: any): RefreshTokenRecord {
    return {
      id:        r.id,
      userId:    r.userId,
      tokenHash: r.tokenHash,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt ?? null,
      createdAt: r.createdAt,
    }
  }
}
