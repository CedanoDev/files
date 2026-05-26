// ─────────────────────────────────────────────
// USE CASE — RecordFoodTemperature
//
// Responsabilidades:
//   1. Validar que el edificio y el usuario existen
//   2. Calcular si la temperatura está en rango seguro
//   3. Persistir el registro
//   4. Disparar alerta por email si está fuera de rango
//
// NO sabe nada de HTTP, Prisma, Express ni base de datos.
// Recibe interfaces, no implementaciones concretas.
// ─────────────────────────────────────────────

import { FoodTemperature, TemperatureRange, Shift } from '../../domain/entities/FoodTemperature'
import { ITemperatureRepository } from '../../domain/repositories/ITemperatureRepository'

// ── Interfaces de dependencias externas ──────

export interface IEmailService {
  sendTemperatureAlert(params: {
    to: string
    buildingName: string
    foodItem: string
    temperatureC: number
    shift: Shift
  }): Promise<void>
}

export interface IBuildingRepository {
  findById(id: string): Promise<{ id: string; name: string } | null>
}

export interface IUserRepository {
  findById(id: string): Promise<{ id: string; name: string; email: string } | null>
}

// ── Input / Output del use case ──────────────

export interface RecordFoodTemperatureInput {
  buildingId: string
  recordedById: string
  foodItem: string
  temperatureC: number
  isHotFood: boolean   // true = comida caliente, false = fría
  shift: Shift
  notes?: string
}

export interface RecordFoodTemperatureOutput {
  record: FoodTemperature
  wasOutOfRange: boolean
  message: string
}

// ── Errores de dominio ────────────────────────

export class BuildingNotFoundError extends Error {
  constructor(buildingId: string) {
    super(`Edificio no encontrado: ${buildingId}`)
    this.name = 'BuildingNotFoundError'
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`Usuario no encontrado: ${userId}`)
    this.name = 'UserNotFoundError'
  }
}

// ── Use Case ─────────────────────────────────

export class RecordFoodTemperature {
  constructor(
    private readonly temperatureRepo: ITemperatureRepository,
    private readonly buildingRepo: IBuildingRepository,
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly adminEmail: string
  ) {}

  async execute(input: RecordFoodTemperatureInput): Promise<RecordFoodTemperatureOutput> {
    // 1. Validar que el edificio existe
    const building = await this.buildingRepo.findById(input.buildingId)
    if (!building) throw new BuildingNotFoundError(input.buildingId)

    // 2. Validar que el usuario existe
    const user = await this.userRepo.findById(input.recordedById)
    if (!user) throw new UserNotFoundError(input.recordedById)

    // 3. Calcular rango seguro según tipo de comida (FDA)
    const minSafeTemp = input.isHotFood ? TemperatureRange.HOT_FOOD_MIN_C : 0
    const maxSafeTemp = input.isHotFood ? 999 : TemperatureRange.COLD_FOOD_MAX_C

    const isInRange = TemperatureRange.isInRange(
      input.temperatureC,
      minSafeTemp,
      maxSafeTemp
    )

    // 4. Persistir el registro
    const record = await this.temperatureRepo.createFoodTemperature({
      buildingId: input.buildingId,
      recordedById: input.recordedById,
      foodItem: input.foodItem,
      temperatureC: input.temperatureC,
      minSafeTemp,
      maxSafeTemp,
      isInRange,
      shift: input.shift,
      notes: input.notes,
    })

    // 5. Si está fuera de rango → enviar alerta (sin bloquear la respuesta)
    if (!isInRange) {
      this.emailService
        .sendTemperatureAlert({
          to: this.adminEmail,
          buildingName: building.name,
          foodItem: input.foodItem,
          temperatureC: input.temperatureC,
          shift: input.shift,
        })
        .catch((err) => {
          // Log el error pero no fallar el registro principal
          console.error('[RecordFoodTemperature] Error enviando alerta:', err)
        })
    }

    const tempType = input.isHotFood ? 'caliente' : 'fría'
    const rangeMsg = isInRange
      ? `Temperatura dentro del rango seguro para comida ${tempType}.`
      : `ALERTA: temperatura FUERA del rango seguro para comida ${tempType}. Se notificó al supervisor.`

    return {
      record,
      wasOutOfRange: !isInRange,
      message: rangeMsg,
    }
  }
}
