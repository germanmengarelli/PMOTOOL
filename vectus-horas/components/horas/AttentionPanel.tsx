// components/horas/AttentionPanel.tsx
// Panel "Atención requerida": combina sobreconsumo real, vencimientos
// próximos con bajo consumo relativo, y contratos vencidos con saldo sin
// usar — ordenado por urgencia. Ver lib/contractMetrics.ts.
'use client'

import { AlertCircle, AlertTriangle, TrendingDown } from 'lucide-react'
import type { AttentionItem, AttentionReason } from '@/lib/contractMetrics'

const REASON_CONFIG: Record<
  AttentionReason,
  { icon: typeof AlertCircle; color: string; bg: string; label: string }
> = {
  sobreconsumo: {
    icon: AlertCircle,
    color: 'text-danger',
    bg: 'bg-danger-soft',
    label: 'Sobreconsumo',
  },
  'vence-pronto-bajo-consumo': {
    icon: AlertTriangle,
    color: 'text-warn',
    bg: 'bg-warn-soft',
    label: 'Vence pronto',
  },
  'vencido-con-saldo': {
    icon: TrendingDown,
    color: 'text-danger',
    bg: 'bg-danger-soft',
    label: 'Saldo sin usar',
  },
}

const MAX_VISIBLE = 8

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const visible = items.slice(0, MAX_VISIBLE)

  return (
    <div className="rounded-[12px] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-dashed border-border px-5 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">Atención requerida</h2>
        <span className="mono text-[11px] text-muted-foreground">{items.length}</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
          Sin casos que requieran atención en este momento.
        </p>
      ) : (
        <ul className="divide-y divide-dashed divide-border">
          {visible.map((item) => {
            const cfg = REASON_CONFIG[item.reason]
            const Icon = cfg.icon
            return (
              <li key={`${item.projectId}-${item.reason}`} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}
                  title={cfg.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{item.projectName}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{item.message}</p>
                </div>
                <span
                  className={`mono inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-medium ${cfg.bg} ${cfg.color}`}
                >
                  {item.metricLabel}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > MAX_VISIBLE && (
        <p className="border-t border-dashed border-border px-5 py-2 text-[11.5px] text-muted-foreground">
          +{items.length - MAX_VISIBLE} caso{items.length - MAX_VISIBLE === 1 ? '' : 's'} más — filtrá o revisá el listado completo abajo.
        </p>
      )}
    </div>
  )
}
