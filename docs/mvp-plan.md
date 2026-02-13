# Vectus Projects — Plan MVP por etapas

## Confirmaciones requeridas antes de gates específicos
Antes de codificar reglas detalladas de gates, se debe validar con Operaciones:

1. Campos obligatorios exactos por fase.
2. Evidencias obligatorias por gate (tipos/nombres).
3. Baseline para alertas de desvío (>15%): horas, costos o ambos.

## Etapas propuestas

### Etapa 1 (actual): Base técnica y contratos iniciales
- Inicializar app con Next.js + TypeScript estricto + Tailwind.
- Configurar calidad: ESLint, Prettier, Vitest, Playwright.
- Crear modelo de datos inicial en Prisma (usuarios, proyectos, fases, evidencias, tareas, costos, auditoría).
- Dejar auth O365/Entra ID en configuración base (sin flujo completo en UI todavía).
- Entregar README con setup y comandos.

### Etapa 2: Dominio de proyectos + permisos + avance de fase (sin reglas cerradas)
- CRUD básico de proyectos con vertical obligatoria.
- Mapeo de usuario autenticado a rol interno (ADMIN/USER) + área.
- Restricción backend: solo Operaciones puede ejecutar transición de fase.
- Auditoría de cambios de fase.

### Etapa 3: Gates backend por fase + evidencias SharePoint
- Implementar motor de reglas de gates en backend.
- Bloquear transición si faltan campos/evidencias.
- Modelo y UI de EvidenceLink por gate/fase.

### Etapa 4: Ejecución y control
- Módulo To Do (lista por proyecto + “Mis tareas”).
- Costos opcionales: horas, materiales, subcontratos.
- Hitos/facturación/cobranza básicos.

### Etapa 5: Alertas + cierre + postventa
- Alertas de desvío >15% (según baseline confirmado).
- Alertas de cobranza vencida y señales de imputación incompleta.
- Soporte de F5/F6 (cierre admin, lecciones, postventa 30-60 días, NPS/CSAT).

## Estructura de carpetas propuesta

- `src/app/` rutas y pantallas (App Router).
- `src/server/auth/` configuración de autenticación/autorización.
- `src/server/db/` cliente Prisma.
- `src/server/gates/` reglas de transición por fase.
- `src/types/` tipos compartidos de dominio.
- `prisma/` schema, migraciones, seed.
- `tests/unit/` pruebas de reglas de negocio.
- `tests/e2e/` flujo principal end-to-end.
- `docs/` diseño funcional y plan de iteraciones.

## Diseño funcional inicial

### Entidades principales
- `User`: identidad interna, rol (ADMIN/USER), área funcional.
- `Project`: código, nombre, vertical, fase principal F0..F6, owner.
- `EvidenceLink`: evidencia por fase/gate con URL de SharePoint.
- `Todo`: tareas de ejecución/control con responsable, vencimiento, prioridad y estado.
- `CostRecord`: costos opcionales por tipo (horas/materiales/subcontratos).
- `AuditEvent`: trazabilidad de cambios (actor, acción, fecha, payload).

### Pantallas MVP (mapa)
1. Login (O365).
2. Dashboard de proyectos.
3. Detalle de proyecto:
   - Resumen
   - Fase actual + panel de gates
   - Evidencias (links SharePoint)
   - To Do
   - Costos
   - Auditoría
4. “Mis tareas”.
5. Administración básica de usuarios (solo ADMIN).

### Permisos
- Auth:
  - `ADMIN`: administración de usuarios y configuración.
  - `USER`: operación de datos del proyecto según área.
- Regla crítica:
  - Solo área `OPERATIONS` puede avanzar fase.
- Auditoría en todas las mutaciones críticas.

### Gates por fase (versión preliminar, pendiente confirmación)
- F0→F1: handoff comercial mínimo completo.
- F1→F2: kickoff interno + planificación validada.
- F2→F3: acta kickoff cliente (EvidenceLink obligatorio).
- F3→F4: ejecución/control con checklist de cierre técnico.
- F4→F5: acta aceptación final (EvidenceLink obligatorio).
- F5→F6: cierre administrativo + lecciones aprendidas.