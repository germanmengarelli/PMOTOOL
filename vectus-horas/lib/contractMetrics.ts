// lib/contractMetrics.ts
// Única fuente de verdad para: qué proyectos entran al análisis (fecha de
// inicio + fecha de fin de contrato ambas cargadas), y el cálculo de
// vigencia / consumo / atención requerida a partir de esos proyectos.
//
// Los proyectos sin ambas fechas quedan excluidos de todo cálculo agregado
// (KPIs, panel de atención, gráfico de cuadrantes) — ver splitProjects().

export interface ProjectDTO {
  id: number
  name: string
  identifier: string
  status: string
  vertical: string | null
  contractId: string | null
  contractStartDate: string | null
  contractEndDate: string | null
  contractedHoursTotal: number | null
  contractedHoursMonthly: number | null
  contractMonths: number | null
}

export type VigenciaStatus = 'vigente' | 'vence-pronto' | 'vencido'
export type ConsumoStatus = 'normal' | 'alto' | 'critico' | 'sin-datos'

export interface AnalyzableProject extends ProjectDTO {
  loadedHours: number
  pctTimeElapsed: number // 0-100, clamp((hoy - inicio) / (fin - inicio))
  pctConsumed: number | null // null si no hay horas contratadas cargadas
  totalDeviation: number | null // loadedHours - contractedHoursTotal
  daysRemaining: number // negativo si ya venció
  vigenciaStatus: VigenciaStatus
  consumoStatus: ConsumoStatus
}

export type MissingReason =
  | 'sin-fecha-inicio'
  | 'sin-fecha-fin'
  | 'sin-ambas-fechas'
  | 'fechas-invalidas'

export interface ExcludedProject extends ProjectDTO {
  loadedHours: number
  missingReason: MissingReason
}

// ---------------------------------------------------------------------------
// Umbrales
// ---------------------------------------------------------------------------

export const VENCE_PRONTO_DAYS = 15
export const CONSUMO_ALTO_PCT = 70
export const CONSUMO_CRITICO_PCT = 100

// Brecha (en puntos porcentuales) entre % tiempo transcurrido y % consumido
// a partir de la cual un proyecto entra al panel de atención por ritmo bajo.
const ATTENTION_GAP_PP = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function hasValidContractDates(p: ProjectDTO): boolean {
  if (!p.contractStartDate || !p.contractEndDate) return false
  const start = new Date(p.contractStartDate)
  const end = new Date(p.contractEndDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
  return end.getTime() > start.getTime()
}

function missingReasonFor(p: ProjectDTO): MissingReason {
  if (!p.contractStartDate && !p.contractEndDate) return 'sin-ambas-fechas'
  if (!p.contractStartDate) return 'sin-fecha-inicio'
  if (!p.contractEndDate) return 'sin-fecha-fin'
  return 'fechas-invalidas'
}

// ---------------------------------------------------------------------------
// Cálculo por proyecto analizable
// ---------------------------------------------------------------------------

export function computeAnalyzable(p: ProjectDTO, loadedHours: number): AnalyzableProject {
  const start = new Date(p.contractStartDate as string)
  const end = new Date(p.contractEndDate as string)
  end.setHours(23, 59, 59, 999)
  const now = new Date()

  const totalMs = end.getTime() - start.getTime()
  const elapsedMs = now.getTime() - start.getTime()
  const pctTimeElapsed = totalMs > 0 ? clamp((elapsedMs / totalMs) * 100, 0, 100) : 100
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let pctConsumed: number | null = null
  let totalDeviation: number | null = null
  if (p.contractedHoursTotal && p.contractedHoursTotal > 0) {
    pctConsumed = (loadedHours / p.contractedHoursTotal) * 100
    totalDeviation = loadedHours - p.contractedHoursTotal
  }

  const vigenciaStatus: VigenciaStatus =
    daysRemaining < 0 ? 'vencido' : daysRemaining <= VENCE_PRONTO_DAYS ? 'vence-pronto' : 'vigente'

  const consumoStatus: ConsumoStatus =
    pctConsumed === null
      ? 'sin-datos'
      : pctConsumed > CONSUMO_CRITICO_PCT
        ? 'critico'
        : pctConsumed >= CONSUMO_ALTO_PCT
          ? 'alto'
          : 'normal'

  return {
    ...p,
    loadedHours,
    pctTimeElapsed,
    pctConsumed,
    totalDeviation,
    daysRemaining,
    vigenciaStatus,
    consumoStatus,
  }
}

// ---------------------------------------------------------------------------
// Split: analizables vs. excluidos (regla de alcance)
// ---------------------------------------------------------------------------

export function splitProjects(
  projects: ProjectDTO[],
  hoursMap: Map<number, number>
): { analyzable: AnalyzableProject[]; excluded: ExcludedProject[] } {
  const analyzable: AnalyzableProject[] = []
  const excluded: ExcludedProject[] = []

  for (const p of projects) {
    const loadedHours = hoursMap.get(p.id) ?? 0
    if (hasValidContractDates(p)) {
      analyzable.push(computeAnalyzable(p, loadedHours))
    } else {
      excluded.push({ ...p, loadedHours, missingReason: missingReasonFor(p) })
    }
  }

  return { analyzable, excluded }
}

// ---------------------------------------------------------------------------
// Panel "Atención requerida"
// ---------------------------------------------------------------------------

export type AttentionReason = 'sobreconsumo' | 'vence-pronto-bajo-consumo' | 'vencido-con-saldo'

export interface AttentionItem {
  projectId: number
  projectName: string
  reason: AttentionReason
  message: string
  metricLabel: string
  urgency: number
}

function formatHoursShort(h: number): string {
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  const base = mm === 0 ? `${hh}h` : `${hh}h ${mm}m`
  return h < 0 ? `-${base}` : `+${base}`
}

export function computeAttentionItems(projects: AnalyzableProject[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const p of projects) {
    // Sobreconsumo real: horas consumidas > horas vendidas.
    if (p.pctConsumed !== null && p.totalDeviation !== null && p.totalDeviation > 0) {
      items.push({
        projectId: p.id,
        projectName: p.name,
        reason: 'sobreconsumo',
        message: `${p.pctConsumed.toFixed(0)}% consumido — ${formatHoursShort(p.totalDeviation)} sobre lo vendido`,
        metricLabel: `${p.pctConsumed.toFixed(0)}%`,
        urgency: 300 + p.pctConsumed,
      })
      continue
    }

    if (p.pctConsumed === null) continue

    // Vence pronto con bajo consumo relativo.
    if (p.vigenciaStatus === 'vence-pronto') {
      const gap = p.pctTimeElapsed - p.pctConsumed
      if (gap >= ATTENTION_GAP_PP) {
        items.push({
          projectId: p.id,
          projectName: p.name,
          reason: 'vence-pronto-bajo-consumo',
          message: `Vence en ${p.daysRemaining}d, ${p.pctConsumed.toFixed(0)}% consumido (tiempo transcurrido ${p.pctTimeElapsed.toFixed(0)}%)`,
          metricLabel: `${p.daysRemaining}d`,
          urgency: 200 + (VENCE_PRONTO_DAYS - p.daysRemaining) + gap,
        })
      }
      continue
    }

    // Vencido con saldo importante sin usar.
    if (p.vigenciaStatus === 'vencido') {
      const gap = 100 - p.pctConsumed
      if (gap >= ATTENTION_GAP_PP) {
        items.push({
          projectId: p.id,
          projectName: p.name,
          reason: 'vencido-con-saldo',
          message: `Vencido hace ${Math.abs(p.daysRemaining)}d, ${p.pctConsumed.toFixed(0)}% consumido — saldo sin usar`,
          metricLabel: `${gap.toFixed(0)}% sin usar`,
          urgency: 100 + gap,
        })
      }
    }
  }

  return items.sort((a, b) => b.urgency - a.urgency)
}
