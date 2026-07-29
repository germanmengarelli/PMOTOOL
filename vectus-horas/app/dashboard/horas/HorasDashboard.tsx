// app/dashboard/horas/HorasDashboard.tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useScheduledRefresh } from '@/hooks/useScheduledRefresh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { AttentionPanel } from '@/components/horas/AttentionPanel'
import { QuadrantChart } from '@/components/horas/QuadrantChart'
import {
  splitProjects,
  computeAttentionItems,
  type ProjectDTO,
  type AnalyzableProject,
  type ExcludedProject,
  type VigenciaStatus,
  type ConsumoStatus,
  type MissingReason,
} from '@/lib/contractMetrics'
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ProjectHoursDTO {
  projectId: number
  projectName: string
  totalHours: number
}

interface HoursResponse {
  byProject: ProjectHoursDTO[]
  byUser: unknown[]
  totalEntries: number
}

// ============================================================
// Utilities
// ============================================================

function formatHours(h: number): string {
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  const base = mm === 0 ? `${hh}h` : `${hh}h ${mm}m`
  return h < 0 ? `-${base}` : base
}

function formatDeviation(h: number): string {
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  const base = mm === 0 ? `${hh}h` : `${hh}h ${mm}m`
  if (Math.abs(h) < 0.5) return '0h'
  return h > 0 ? `+${base}` : `-${base}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  } catch {
    return iso
  }
}

const MISSING_REASON_LABEL: Record<MissingReason, string> = {
  'sin-fecha-inicio': 'Falta fecha de inicio',
  'sin-fecha-fin': 'Falta fecha de fin',
  'sin-ambas-fechas': 'Sin fechas de contrato',
  'fechas-invalidas': 'Fechas de contrato inválidas',
}

// ============================================================
// Vigencia / Consumo badges — dos fuentes independientes
// ============================================================

const VIGENCIA_LABEL: Record<VigenciaStatus, string> = {
  vigente: 'Vigente',
  'vence-pronto': 'Vence pronto',
  vencido: 'Vencido',
}

const VIGENCIA_STYLE: Record<VigenciaStatus, string> = {
  vigente: 'bg-muted text-muted-foreground',
  'vence-pronto': 'bg-warn-soft text-warn',
  vencido: 'bg-danger-soft text-danger',
}

const VIGENCIA_ICON: Record<VigenciaStatus, React.ReactNode> = {
  vigente: <CheckCircle2 className="h-[11px] w-[11px]" />,
  'vence-pronto': <AlertTriangle className="h-[11px] w-[11px]" />,
  vencido: <Calendar className="h-[11px] w-[11px]" />,
}

function VigenciaBadge({ status }: { status: VigenciaStatus }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium ${VIGENCIA_STYLE[status]}`}
    >
      {VIGENCIA_ICON[status]}
      {VIGENCIA_LABEL[status]}
    </span>
  )
}

const CONSUMO_LABEL: Record<ConsumoStatus, string> = {
  normal: 'Consumo normal',
  alto: 'Consumo alto',
  critico: 'Consumo crítico',
  'sin-datos': 'Sin horas vendidas',
}

const CONSUMO_STYLE: Record<ConsumoStatus, string> = {
  normal: 'bg-ok-soft text-ok',
  alto: 'bg-warn-soft text-warn',
  critico: 'bg-danger-soft text-danger',
  'sin-datos': 'bg-muted text-muted-foreground',
}

const CONSUMO_ICON: Record<ConsumoStatus, React.ReactNode> = {
  normal: <CheckCircle2 className="h-[11px] w-[11px]" />,
  alto: <AlertTriangle className="h-[11px] w-[11px]" />,
  critico: <AlertCircle className="h-[11px] w-[11px]" />,
  'sin-datos': <Minus className="h-[11px] w-[11px]" />,
}

function ConsumoBadge({ status }: { status: ConsumoStatus }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium ${CONSUMO_STYLE[status]}`}
    >
      {CONSUMO_ICON[status]}
      {CONSUMO_LABEL[status]}
    </span>
  )
}

function DaysRemainingPill({ vigenciaStatus, days }: { vigenciaStatus: VigenciaStatus; days: number }) {
  const base = 'mono inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-medium'
  if (vigenciaStatus === 'vencido')
    return <span className={`${base} bg-danger-soft text-danger`}>Vencido {Math.abs(days)}d</span>
  if (days === 0) return <span className={`${base} bg-danger-soft text-danger`}>Vence hoy</span>
  if (vigenciaStatus === 'vence-pronto')
    return <span className={`${base} bg-warn-soft text-warn`}>{days}d restantes</span>
  return <span className={`${base} bg-muted text-muted-foreground`}>{days}d restantes</span>
}

// ============================================================
// Doble barra: % tiempo transcurrido / % horas consumidas
// ============================================================

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function DualProgressBar({
  pctTimeElapsed,
  pctConsumed,
  consumoStatus,
}: {
  pctTimeElapsed: number
  pctConsumed: number | null
  consumoStatus: ConsumoStatus
}) {
  const MAX_SCALE = 115
  const timeFillPct = clamp(pctTimeElapsed, 0, 100)
  const consumedFillPct = pctConsumed === null ? 0 : (clamp(pctConsumed, 0, MAX_SCALE) / MAX_SCALE) * 100

  const consumedColor: Record<ConsumoStatus, string> = {
    normal: 'var(--ok)',
    alto: 'var(--warn)',
    critico: 'var(--danger)',
    'sin-datos': 'var(--muted-foreground)',
  }

  return (
    <div className="space-y-1.5">
      <div>
        <div className="mb-0.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Tiempo transcurrido</span>
          <span className="mono">{pctTimeElapsed.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${timeFillPct}%`, backgroundColor: 'var(--primary)' }}
          />
        </div>
      </div>
      <div>
        <div className="mb-0.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Horas consumidas</span>
          <span className="mono">{pctConsumed === null ? '—' : `${pctConsumed.toFixed(0)}%`}</span>
        </div>
        {pctConsumed === null ? (
          <div className="h-1.5 w-full rounded-full border border-dashed border-border" />
        ) : (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${consumedFillPct}%`, backgroundColor: consumedColor[consumoStatus] }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DeviationRow({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null
  const abs = Math.abs(value)
  const isNeutral = abs < 0.5
  const isOver = value > 0
  const colorClass = isNeutral ? 'text-muted-foreground' : isOver ? 'text-danger' : 'text-ok'
  const Icon = isNeutral ? Minus : isOver ? TrendingUp : TrendingDown

  return (
    <div className={`flex items-center gap-1.5 text-[12.5px] ${colorClass}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="font-medium">{label}:</span>
      <span className="mono">{formatDeviation(value)}</span>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-[12px] bg-white shadow-card">
      <div className="flex flex-col gap-3 py-[18px] px-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-[22px] w-20 rounded-full" />
        </div>
        <Skeleton className="h-[42px] w-4/5" />
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-[22px] w-14 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[22px] w-20 rounded-full" />
        </div>
        <div className="border-t border-dashed border-border pt-3 space-y-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
    </div>
  )
}

function ProjectCardComponent({ card }: { card: AnalyzableProject }) {
  const hasContractedHours = card.contractedHoursTotal != null && card.contractedHoursTotal > 0

  return (
    <div className="flex flex-col rounded-[12px] bg-white overflow-hidden shadow-card transition-shadow hover:shadow-card-hover">
      {card.vigenciaStatus === 'vence-pronto' && <div className="h-0.5 w-full shrink-0 bg-warn" />}
      {(card.vigenciaStatus === 'vencido' || card.consumoStatus === 'critico') && (
        <div className="h-0.5 w-full shrink-0 bg-danger" />
      )}

      <div className="flex flex-1 flex-col gap-3 py-[18px] px-5">
        {/* Contract ID */}
        <div className="flex items-center justify-between gap-2">
          <span className="mono text-[11px] text-muted-foreground truncate">
            {card.contractId ?? `#${card.identifier}`}
          </span>
        </div>

        {/* Badges: vigencia + consumo (independientes) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <VigenciaBadge status={card.vigenciaStatus} />
          <ConsumoBadge status={card.consumoStatus} />
        </div>

        {/* Project name */}
        <h3
          className="text-[15.5px] font-semibold leading-[1.35] text-foreground line-clamp-2"
          style={{ minHeight: '42px' }}
          title={card.name}
        >
          {card.name}
        </h3>

        {/* Hours row */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className="mono font-semibold text-foreground"
              style={{ fontSize: '28px', letterSpacing: '-0.02em' }}
            >
              {formatHours(card.loadedHours)}
            </span>
            {hasContractedHours && (
              <span className="text-[12.5px] text-muted-foreground">
                / {card.contractedHoursTotal!.toLocaleString('es-AR')}h
              </span>
            )}
          </div>
        </div>

        {/* Dual progress bar */}
        <DualProgressBar
          pctTimeElapsed={card.pctTimeElapsed}
          pctConsumed={card.pctConsumed}
          consumoStatus={card.consumoStatus}
        />

        {/* Date / days remaining */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Vence {formatDate(card.contractEndDate)}</span>
          </div>
          <DaysRemainingPill vigenciaStatus={card.vigenciaStatus} days={card.daysRemaining} />
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-dashed border-border pt-3 space-y-1.5">
          {card.totalDeviation === null ? (
            <p className="text-[11px] italic text-muted-foreground">
              Completá las horas contratadas en OpenProject
            </p>
          ) : (
            <DeviationRow value={card.totalDeviation} label="Desvío total" />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tabla de proyectos excluidos (sin fechas cargadas)
// ============================================================

function ExcludedProjectsTable({ projects }: { projects: ExcludedProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border py-16 text-muted-foreground">
        <p className="font-medium">Todos los proyectos tienen ambas fechas de contrato cargadas.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[12px] bg-white shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proyecto</TableHead>
            <TableHead>Vertical</TableHead>
            <TableHead>Horas cargadas</TableHead>
            <TableHead>Motivo de exclusión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="font-medium text-foreground">{p.name}</div>
                <div className="mono text-[11px] text-muted-foreground">{p.identifier}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.vertical ?? '—'}</TableCell>
              <TableCell className="mono">{formatHours(p.loadedHours)}</TableCell>
              <TableCell>
                <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
                  {MISSING_REASON_LABEL[p.missingReason]}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================
// KPI Card
// ============================================================

function KpiCard({
  label,
  value,
  sub,
  accentVariant = 'default',
}: {
  label: string
  value: string | number
  sub?: string
  accentVariant?: 'default' | 'warn' | 'danger' | 'ok'
}) {
  const accentBar: Record<string, string> = {
    default: 'bg-border',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
  }

  return (
    <div className="flex items-stretch rounded-[12px] bg-white overflow-hidden shadow-card">
      <div className={`w-[3px] shrink-0 ${accentBar[accentVariant]}`} />
      <div className="flex flex-col gap-1 py-[18px] px-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.03em] text-muted-foreground">{label}</p>
        <p
          className="mono font-semibold leading-none text-foreground"
          style={{ fontSize: '34px', letterSpacing: '-0.02em' }}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ============================================================
// Filter Chip
// ============================================================

function FilterChip({
  label,
  count,
  active,
  activeClassName,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  activeClassName: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
        active ? activeClassName : 'border border-border bg-white text-foreground hover:bg-muted'
      }`}
    >
      {label}
      <span className={`mono text-[11px] ${active ? 'opacity-75' : 'text-muted-foreground'}`}>{count}</span>
    </button>
  )
}

// ============================================================
// Logo with fallback to brand mark
// ============================================================

function LogoWithFallback() {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-hidden="true"
      >
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
          <path
            d="M2 2L9 14L16 2"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/vectus-logo.png"
      alt="Vectus"
      className="h-8 w-auto object-contain"
      onError={() => setImgError(true)}
    />
  )
}

// ============================================================
// Current month label
// ============================================================

const _now = new Date()
const _month = _now.toLocaleDateString('es-AR', { month: 'long' })
const CURRENT_MONTH_YEAR = `${_month.charAt(0).toUpperCase() + _month.slice(1)} ${_now.getFullYear()}`

// ============================================================
// Main Dashboard
// ============================================================

type VigenciaFilter = 'all' | VigenciaStatus
type ConsumoFilter = 'all' | ConsumoStatus

export default function HorasDashboard() {
  const [projects, setProjects] = useState<ProjectDTO[]>([])
  const [hours, setHours] = useState<HoursResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)

  const [search, setSearch] = useState('')
  const [vigenciaFilter, setVigenciaFilter] = useState<VigenciaFilter>('all')
  const [consumoFilter, setConsumoFilter] = useState<ConsumoFilter>('all')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('pct-desc')
  const [activeTab, setActiveTab] = useState<'analizables' | 'sin-fechas'>('analizables')

  // ── Fetch ──────────────────────────────────────────────────
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setSyncing(true)
    else setLoading(true)
    setError(null)

    try {
      const [projRes, hoursRes] = await Promise.all([
        fetch('/api/openproject/projects', { cache: 'no-store' }),
        fetch('/api/openproject/hours', { cache: 'no-store' }),
      ])

      const projData = await projRes.json()
      const hoursData = await hoursRes.json()

      const errors: string[] = []
      if (!projRes.ok) errors.push(`Proyectos: ${projData.error ?? projRes.status}`)
      if (!hoursRes.ok) errors.push(`Horas: ${hoursData.error ?? hoursRes.status}`)

      if (errors.length === 2) {
        setError(errors.join(' · '))
        return
      }

      if (projRes.ok) setProjects(Array.isArray(projData) ? projData : [])
      if (hoursRes.ok) setHours(hoursData)
      if (errors.length > 0) setError(`Parcial: ${errors.join(', ')}`)

      setLastSync(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  // Carga inicial
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh a las 9:00 AM, lunes a viernes
  useScheduledRefresh(fetchData)

  // ── Regla de alcance: separar analizables (ambas fechas) de excluidos ──
  const { analyzable, excluded } = useMemo(() => {
    if (!hours) return { analyzable: [] as AnalyzableProject[], excluded: [] as ExcludedProject[] }
    const hoursMap = new Map<number, number>()
    for (const ph of hours.byProject ?? []) {
      hoursMap.set(ph.projectId, ph.totalHours)
    }
    return splitProjects(projects, hoursMap)
  }, [projects, hours])

  // ── Lista de verticales únicas (para el selector) — solo analizables ──
  const verticals = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const c of analyzable) {
      if (c.vertical) set.add(c.vertical)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [analyzable])

  // ── Filter + sort (solo dentro de analizables) ─────────────
  const filteredCards = useMemo<AnalyzableProject[]>(() => {
    let result = [...analyzable]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.contractId ?? '').toLowerCase().includes(q)
      )
    }

    if (vigenciaFilter !== 'all') {
      result = result.filter((c) => c.vigenciaStatus === vigenciaFilter)
    }

    if (consumoFilter !== 'all') {
      result = result.filter((c) => c.consumoStatus === consumoFilter)
    }

    if (verticalFilter !== 'all') {
      result = result.filter((c) => c.vertical === verticalFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'pct-desc':
          return (b.pctConsumed ?? -1) - (a.pctConsumed ?? -1)
        case 'pct-asc':
          return (a.pctConsumed ?? 9999) - (b.pctConsumed ?? 9999)
        case 'name':
          return a.name.localeCompare(b.name, 'es')
        case 'days':
          return a.daysRemaining - b.daysRemaining
        case 'deviation':
          return (b.totalDeviation ?? 0) - (a.totalDeviation ?? 0)
        default:
          return 0
      }
    })

    return result
  }, [analyzable, search, vigenciaFilter, consumoFilter, verticalFilter, sortBy])

  // ── Excluidos filtrados por búsqueda + vertical (misma barra) ──
  const filteredExcluded = useMemo<ExcludedProject[]>(() => {
    let result = [...excluded]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q))
    }
    if (verticalFilter !== 'all') {
      result = result.filter((c) => c.vertical === verticalFilter)
    }
    return result
  }, [excluded, search, verticalFilter])

  // ── KPIs (solo analizables) ─────────────────────────────────
  const kpis = useMemo(() => {
    const totalHours = analyzable.reduce((s, c) => s + c.loadedHours, 0)
    const totalContracted = analyzable.reduce((s, c) => s + (c.contractedHoursTotal ?? 0), 0)
    const totalOver = analyzable
      .filter((c) => (c.totalDeviation ?? 0) > 0)
      .reduce((s, c) => s + (c.totalDeviation ?? 0), 0)
    const vencePronto = analyzable.filter((c) => c.vigenciaStatus === 'vence-pronto').length
    const critico = analyzable.filter((c) => c.consumoStatus === 'critico').length
    return { totalHours, totalContracted, totalOver, vencePronto, critico }
  }, [analyzable])

  // ── Panel de atención (solo analizables) ────────────────────
  const attentionItems = useMemo(() => computeAttentionItems(analyzable), [analyzable])

  // ── Counts para chips ────────────────────────────────────────
  const vigenciaCounts = useMemo(
    () => ({
      all: analyzable.length,
      vigente: analyzable.filter((c) => c.vigenciaStatus === 'vigente').length,
      'vence-pronto': analyzable.filter((c) => c.vigenciaStatus === 'vence-pronto').length,
      vencido: analyzable.filter((c) => c.vigenciaStatus === 'vencido').length,
    }),
    [analyzable]
  )

  const consumoCounts = useMemo(
    () => ({
      all: analyzable.length,
      normal: analyzable.filter((c) => c.consumoStatus === 'normal').length,
      alto: analyzable.filter((c) => c.consumoStatus === 'alto').length,
      critico: analyzable.filter((c) => c.consumoStatus === 'critico').length,
      'sin-datos': analyzable.filter((c) => c.consumoStatus === 'sin-datos').length,
    }),
    [analyzable]
  )

  // ── Sync label ──────────────────────────────────────────────
  function syncLabel() {
    if (!lastSync) return 'No sincronizado'
    const diff = Math.round((Date.now() - lastSync.getTime()) / 60000)
    if (diff < 1) return 'Sincronizado · hace menos de 1 min'
    if (diff === 1) return 'Sincronizado · hace 1 min'
    return `Sincronizado · hace ${diff} min`
  }

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <Skeleton className="h-14 w-full rounded-[12px]" />
          <div className="grid grid-cols-2 gap-[14px] min-[820px]:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-[12px]" />
            ))}
          </div>
          <Skeleton className="h-[220px] w-full rounded-[12px]" />
          <Skeleton className="h-[90px] w-full rounded-[12px]" />
          <div className="grid gap-[14px] grid-cols-1 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Topbar ── */}
      <div className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <LogoWithFallback />
            <div className="h-8 w-px bg-border" aria-hidden="true" />
            <div>
              <h1 className="text-[13px] font-semibold leading-tight text-foreground">
                Control de <span style={{ color: 'var(--primary)' }}>Horas</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Contratos y consumo · {CURRENT_MONTH_YEAR}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-1.5 sm:flex">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: lastSync ? 'var(--ok)' : 'var(--muted-foreground)' }}
              />
              <span className="text-[12.5px] text-muted-foreground">{syncLabel()}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={syncing} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="border-b bg-danger-soft px-6 py-2"
          style={{ borderColor: 'color-mix(in oklch, var(--danger) 20%, transparent)' }}
        >
          <p className="mx-auto max-w-7xl text-[12.5px] text-danger">⚠ {error}</p>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-5 p-6">
        {/* ── KPI strip (solo proyectos analizables) ── */}
        <div className="grid grid-cols-2 gap-[14px] min-[820px]:grid-cols-4">
          <KpiCard label="Proyectos analizables" value={analyzable.length} sub={`${excluded.length} sin fechas cargadas`} />
          <KpiCard
            label="Horas cargadas"
            value={formatHours(kpis.totalHours)}
            sub={kpis.totalContracted > 0 ? `de ${kpis.totalContracted.toLocaleString('es-AR')}h vendidas` : undefined}
          />
          <KpiCard
            label="Vencen pronto"
            value={kpis.vencePronto}
            sub={`≤ 15 días restantes`}
            accentVariant={kpis.vencePronto > 0 ? 'warn' : 'default'}
          />
          <KpiCard
            label="Consumo crítico"
            value={kpis.critico}
            sub={kpis.totalOver > 0 ? `+${formatHours(kpis.totalOver)} sobreconsumo` : 'sin sobreconsumo'}
            accentVariant={kpis.critico > 0 ? 'danger' : 'default'}
          />
        </div>

        {/* ── Panel de atención requerida ── */}
        <AttentionPanel items={attentionItems} />

        {/* ── Gráfico de cuadrantes ── */}
        <QuadrantChart projects={analyzable} />

        {/* ── Toolbar ── */}
        <div className="rounded-[12px] bg-white py-3 px-[14px] shadow-card space-y-3">
          {/* Row 1: search + vertical + sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o ID de contrato…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-[38px] pl-9"
              />
            </div>

            {verticals.length > 0 && (
              <Select value={verticalFilter} onValueChange={setVerticalFilter}>
                <SelectTrigger className="h-[38px] w-52">
                  <SelectValue placeholder="Vertical de negocio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las verticales</SelectItem>
                  {verticals.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeTab === 'analizables' && (
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-[38px] w-48">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct-desc">Mayor % consumido</SelectItem>
                  <SelectItem value="pct-asc">Menor % consumido</SelectItem>
                  <SelectItem value="name">Nombre A → Z</SelectItem>
                  <SelectItem value="days">Días restantes</SelectItem>
                  <SelectItem value="deviation">Mayor desvío</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Row 2: vigencia + consumo chips (solo pestaña analizables) */}
          {activeTab === 'analizables' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.03em] text-muted-foreground">
                  Vigencia
                </span>
                <FilterChip
                  label="Todos"
                  count={vigenciaCounts.all}
                  active={vigenciaFilter === 'all'}
                  activeClassName="bg-foreground text-white"
                  onClick={() => setVigenciaFilter('all')}
                />
                <FilterChip
                  label="Vigente"
                  count={vigenciaCounts.vigente}
                  active={vigenciaFilter === 'vigente'}
                  activeClassName="bg-muted-foreground text-white"
                  onClick={() => setVigenciaFilter('vigente')}
                />
                <FilterChip
                  label="Vence pronto"
                  count={vigenciaCounts['vence-pronto']}
                  active={vigenciaFilter === 'vence-pronto'}
                  activeClassName="bg-warn text-white"
                  onClick={() => setVigenciaFilter('vence-pronto')}
                />
                <FilterChip
                  label="Vencido"
                  count={vigenciaCounts.vencido}
                  active={vigenciaFilter === 'vencido'}
                  activeClassName="bg-danger text-white"
                  onClick={() => setVigenciaFilter('vencido')}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.03em] text-muted-foreground">
                  Consumo
                </span>
                <FilterChip
                  label="Todos"
                  count={consumoCounts.all}
                  active={consumoFilter === 'all'}
                  activeClassName="bg-foreground text-white"
                  onClick={() => setConsumoFilter('all')}
                />
                <FilterChip
                  label="Normal"
                  count={consumoCounts.normal}
                  active={consumoFilter === 'normal'}
                  activeClassName="bg-ok text-white"
                  onClick={() => setConsumoFilter('normal')}
                />
                <FilterChip
                  label="Alto"
                  count={consumoCounts.alto}
                  active={consumoFilter === 'alto'}
                  activeClassName="bg-warn text-white"
                  onClick={() => setConsumoFilter('alto')}
                />
                <FilterChip
                  label="Crítico"
                  count={consumoCounts.critico}
                  active={consumoFilter === 'critico'}
                  activeClassName="bg-danger text-white"
                  onClick={() => setConsumoFilter('critico')}
                />
                <span className="ml-auto text-[12.5px] text-muted-foreground">
                  {filteredCards.length} de {analyzable.length} proyectos
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Tabs: analizables / sin fechas cargadas ── */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="analizables">Analizables ({analyzable.length})</TabsTrigger>
            <TabsTrigger value="sin-fechas">Sin fechas cargadas ({excluded.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="analizables">
            {filteredCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border py-20 text-muted-foreground">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mb-3 opacity-40"
                  aria-hidden="true"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p className="font-medium">Sin resultados para este filtro.</p>
                <p className="mt-1 text-[12.5px]">Cambiá el estado o limpiá la búsqueda</p>
              </div>
            ) : (
              <div className="grid gap-[14px] grid-cols-1 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3">
                {filteredCards.map((card) => (
                  <ProjectCardComponent key={card.id} card={card} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sin-fechas">
            <ExcludedProjectsTable projects={filteredExcluded} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
