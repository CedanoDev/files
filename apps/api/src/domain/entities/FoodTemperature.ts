// ─────────────────────────────────────────────
// DOMAIN ENTITY — FoodTemperature
// No depende de Prisma, Express, ni nada externo.
// Es la verdad del negocio.
// ─────────────────────────────────────────────

export type Shift = 'MORNING' | 'AFTERNOON' | 'CLOSING'

export interface FoodTemperature {
  id: string
  buildingId: string
  recordedById: string
  foodItem: string
  temperatureC: number
  minSafeTemp: number
  maxSafeTemp: number
  isInRange: boolean
  shift: Shift
  notes?: string
  recordedAt: Date
}

// Value Object: lógica de rango seguro FDA
export class TemperatureRange {
  static readonly HOT_FOOD_MIN_C = 60.0   // comidas calientes: mínimo 60°C
  static readonly COLD_FOOD_MAX_C = 4.0   // comidas frías: máximo 4°C

  static isHotFoodSafe(tempC: number): boolean {
    return tempC >= this.HOT_FOOD_MIN_C
  }

  static isColdFoodSafe(tempC: number): boolean {
    return tempC <= this.COLD_FOOD_MAX_C
  }

  // Determina si está en rango según el tipo de comida
  // Si minSafeTemp > 0 asumimos comida caliente, si no fría
  static isInRange(tempC: number, minSafe: number, maxSafe: number): boolean {
    if (minSafe >= 60) {
      // comida caliente: debe estar POR ENCIMA del mínimo
      return tempC >= minSafe
    }
    // comida fría: debe estar POR DEBAJO del máximo
    return tempC <= maxSafe
  }
}
