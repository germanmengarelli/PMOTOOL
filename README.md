# Vectus Projects (MVP)

Base técnica inicial del MVP de seguimiento de proyectos para Vectus.

## Prerrequisitos

- Node.js 20+
- PostgreSQL 15+

## Variables de entorno

Copiar `.env.example` a `.env` y completar credenciales O365/Entra ID y base de datos.

## Comandos

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- `npm run start`
- `npm run prisma:migrate`
- `npm run prisma:seed`

## Estado iteración 1

- Estructura base Next.js + TypeScript estricto.
- Prisma schema inicial para usuarios, proyectos, fases, evidencia, tareas, costos y auditoría.
- Config inicial de NextAuth para Azure AD.
- Setup inicial de Vitest + Playwright con tests smoke.

## Próximos pasos

1. Confirmar campos/evidencias exactas de gates por fase con Operaciones.
2. Implementar reglas backend de avance de fase y permisos.
3. Construir pantallas de proyectos y flujo F0→F1.


## Changelog corto

- Iteración 1: base técnica, modelos principales, scaffolding auth/tests.
- Iteración 2: API inicial de proyectos, transición secuencial de fases, restricción de avance solo para Operaciones y auditoría de cambio de fase. 