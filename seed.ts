// ─────────────────────────────────────────────
// prisma/seed.ts
// Datos iniciales para desarrollo y demos
// Ejecutar: npm run db:seed
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── 1. Edificios ──────────────────────────
  const buildings = await Promise.all([
    prisma.building.upsert({
      where: { id: 'building-1' },
      update: {},
      create: { id: 'building-1', name: 'Ice Cream Village',  location: 'Zona norte del parque' },
    }),
    prisma.building.upsert({
      where: { id: 'building-2' },
      update: {},
      create: { id: 'building-2', name: 'Pizza Palace',        location: 'Centro del parque' },
    }),
    prisma.building.upsert({
      where: { id: 'building-3' },
      update: {},
      create: { id: 'building-3', name: 'Burger Barn',         location: 'Zona sur del parque' },
    }),
    prisma.building.upsert({
      where: { id: 'building-4' },
      update: {},
      create: { id: 'building-4', name: 'Snack Shack',         location: 'Entrada del parque' },
    }),
  ])
  console.log(`✅ ${buildings.length} edificios creados`)

  // ── 2. Usuarios ───────────────────────────
  const passwordHash = await bcrypt.hash('demo123', 10)

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@storyland.com' },
      update: {},
      create: {
        id: 'user-admin',
        name: 'Park Manager',
        email: 'admin@storyland.com',
        passwordHash,
        role: 'ADMIN',
        buildingId: null,
      },
    }),
    prisma.user.upsert({
      where: { email: 'supervisor@storyland.com' },
      update: {},
      create: {
        id: 'user-supervisor',
        name: 'Maria González',
        email: 'supervisor@storyland.com',
        passwordHash,
        role: 'SUPERVISOR',
        buildingId: 'building-1',
      },
    }),
    prisma.user.upsert({
      where: { email: 'employee@storyland.com' },
      update: {},
      create: {
        id: 'user-employee',
        name: 'Carlos Martínez',
        email: 'employee@storyland.com',
        passwordHash,
        role: 'EMPLOYEE',
        buildingId: 'building-1',
      },
    }),
  ])
  console.log(`✅ ${users.length} usuarios creados`)

  // ── 3. Freezer units ─────────────────────
  await prisma.freezerUnit.createMany({
    skipDuplicates: true,
    data: [
      { id: 'frz-1', buildingId: 'building-1', unitCode: 'FRZ-01', description: 'Freezer principal — helados',       minTempC: -20, maxTempC: -15 },
      { id: 'frz-2', buildingId: 'building-1', unitCode: 'FRZ-02', description: 'Freezer secundario — ingredientes',  minTempC: -18, maxTempC: -15 },
      { id: 'ref-1', buildingId: 'building-1', unitCode: 'REF-01', description: 'Refrigerador — toppings y salsas',   minTempC: 1,   maxTempC: 4   },
      { id: 'ref-2', buildingId: 'building-2', unitCode: 'FRZ-01', description: 'Freezer pizzas',                     minTempC: -18, maxTempC: -15 },
    ],
  })
  console.log('✅ Freezer units creados')

  // ── 4. Task templates ────────────────────
  const globalOpeningTasks = [
    'Verificar temperatura de todos los freezers',
    'Inspeccionar fechas de vencimiento del inventario',
    'Limpiar y sanitizar superficies de preparación',
    'Verificar niveles de stock vs pedido del día anterior',
  ]
  const globalDuringTasks = [
    'Verificar temperatura de comidas calientes cada 2 horas',
    'Verificar temperatura de freezers cada 2 horas',
    'Reemplazar comida si estuvo más de 4h fuera de rango',
  ]
  const globalClosingTasks = [
    'Registrar todo el desperdicio del día',
    'Limpiar y sanitizar todas las superficies',
    'Completar el stock list para mañana',
    'Verificar temperatura final de freezers',
    'Firmar el checklist de cierre',
  ]

  const taskData = [
    ...globalOpeningTasks.map((title, i) => ({ title, moment: 'OPENING' as const, buildingId: null, sortOrder: i + 1, isActive: true })),
    ...globalDuringTasks.map((title, i)  => ({ title, moment: 'DURING'  as const, buildingId: null, sortOrder: i + 1, isActive: true })),
    ...globalClosingTasks.map((title, i) => ({ title, moment: 'CLOSING' as const, buildingId: null, sortOrder: i + 1, isActive: true })),
    // Tareas específicas de Ice Cream Village
    { title: 'Verificar máquinas de helado soft serve', moment: 'OPENING' as const, buildingId: 'building-1', sortOrder: 10, isActive: true },
    { title: 'Registrar temperatura inicial de mezcla de helado', moment: 'OPENING' as const, buildingId: 'building-1', sortOrder: 11, isActive: true },
    { title: 'Limpiar y sanitizar dispensadoras de helado', moment: 'CLOSING' as const, buildingId: 'building-1', sortOrder: 10, isActive: true },
  ]

  await prisma.taskTemplate.createMany({ skipDuplicates: true, data: taskData })
  console.log(`✅ ${taskData.length} task templates creados`)

  console.log('\n🎉 Seed completado exitosamente.')
  console.log('📋 Credenciales de acceso:')
  console.log('   Admin:      admin@storyland.com      / demo123')
  console.log('   Supervisor: supervisor@storyland.com  / demo123')
  console.log('   Empleado:   employee@storyland.com    / demo123')
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
