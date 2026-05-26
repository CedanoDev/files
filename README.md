# Story Land Food Safety System

Sistema de gestión de seguridad alimentaria para Story Land (NH), construido con Clean Architecture, Node.js, Next.js y PostgreSQL.

## Módulos

| Módulo              | Descripción                                              |
|---------------------|----------------------------------------------------------|
| Temperaturas        | Registro de temperatura de comidas y freezers con alertas FDA |
| Checklist           | Tareas de apertura, operación y cierre por edificio      |
| Stock List          | Pedidos al warehouse con sugerencias anti-desperdicio    |
| Desperdicios        | Registro de food waste con análisis de causas            |
| Dashboard           | KPIs, tendencias y reportes exportables a PDF/Excel      |

## Stack

- **Frontend:** Next.js 14 · React · Tailwind · Recharts · PWA offline-first
- **Backend:** Node.js · Express · Clean Architecture
- **Base de datos:** PostgreSQL · Prisma ORM
- **Cache:** Redis
- **Deploy:** Vercel (frontend) · Railway (backend + DB)
- **CI/CD:** GitHub Actions

## Arquitectura

```
storyland-food-safety/
├── apps/
│   ├── api/          ← Node.js + Express (Clean Architecture)
│   │   ├── src/
│   │   │   ├── domain/           ← Entidades + interfaces (sin dependencias)
│   │   │   ├── use-cases/        ← Lógica de negocio pura
│   │   │   ├── infrastructure/   ← Prisma, Email, Redis
│   │   │   └── interface/        ← Controllers, rutas, middlewares
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── web/          ← Next.js PWA
│       └── src/app/
│           ├── (auth)/login/
│           ├── (tablet)/temperatures/
│           ├── (tablet)/checklist/
│           ├── (tablet)/stock/
│           ├── (tablet)/waste/
│           ├── (tablet)/freezers/
│           └── (dashboard)/
├── packages/
│   └── shared-types/ ← Tipos TypeScript compartidos
├── .github/workflows/deploy.yml
├── package.json      ← npm workspaces root
└── turbo.json
```

## Setup local

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/storyland-food-safety.git
cd storyland-food-safety
npm install
```

### 2. Variables de entorno

```bash
cp apps/api/.env.example  apps/api/.env
cp apps/web/.env.example  apps/web/.env.local
```

Edita `apps/api/.env` con tus credenciales de PostgreSQL y SMTP.

### 3. Base de datos

```bash
# Levantar PostgreSQL local con Docker (opcional)
docker run --name storyland-db \
  -e POSTGRES_PASSWORD=localpassword \
  -e POSTGRES_DB=storyland_dev \
  -p 5432:5432 -d postgres:16

# Aplicar schema y seed
npm run db:push
npm run db:seed
```

### 4. Levantar el proyecto

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Prisma Studio: `npm run db:studio`

### 5. Credenciales demo

| Rol        | Email                        | Password  | Acceso           |
|------------|------------------------------|-----------|------------------|
| Admin      | admin@storyland.com          | demo123   | /dashboard       |
| Supervisor | supervisor@storyland.com     | demo123   | /checklist       |
| Empleado   | employee@storyland.com       | demo123   | /temperatures    |

## Deploy en producción

### Variables de entorno en GitHub Secrets

Configura estos secrets en tu repositorio de GitHub (`Settings → Secrets`):

| Secret                  | Descripción                           |
|-------------------------|---------------------------------------|
| `VERCEL_TOKEN`          | Token de API de Vercel                |
| `VERCEL_ORG_ID`         | ID de tu organización en Vercel       |
| `VERCEL_PROJECT_ID_WEB` | ID del proyecto web en Vercel         |
| `RAILWAY_TOKEN`         | Token de deploy de Railway            |
| `DATABASE_URL_PROD`     | URL de PostgreSQL en Railway          |

### Flujo de deploy

1. Push a cualquier rama → CI (lint + typecheck + tests)
2. Merge a `main` → Deploy automático a Vercel + Railway + migraciones

## Patrones aplicados

- **Clean Architecture:** domain → use-cases → infrastructure → interface
- **Repository Pattern:** interfaces en domain, implementaciones en infrastructure
- **PWA Offline-first:** IndexedDB + Service Worker + Background Sync
- **Error handling:** Errores de dominio tipados, nunca strings genéricos
- **Validación:** Zod en la capa interface, nunca en use cases
- **Autenticación:** JWT + bcrypt + middleware de roles

---

Desarrollado por [Tu nombre] · [tu-email@gmail.com]
