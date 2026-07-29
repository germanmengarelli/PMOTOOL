// components/horas/QuadrantChart.tsx
// Scatter de % tiempo transcurrido vs. % horas consumidas, dividido en 4
// cuadrantes (líneas en 50/50) más una diagonal de referencia (ritmo ideal).
'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { AnalyzableProject } from '@/lib/contractMetrics'

const Y_MAX = 150

interface QuadrantPoint {
  id: number
  name: string
  x: number // pctTimeElapsed
  y: number // pctConsumed, clamped a Y_MAX para poder graficarlo
  realY: number // pctConsumed real, sin clampear (para el tooltip)
  daysRemaining: number
}

const QUADRANT_COLOR = {
  sobreconsumo: 'var(--danger)', // tiempo alto, consumo alto
  vigilar: 'var(--warn)', // tiempo bajo, consumo alto
  critico: '#7c3aed', // tiempo alto, consumo bajo — se vence y sobran horas
  saludable: 'var(--ok)', // tiempo bajo, consumo bajo
} as const

function quadrantOf(x: number, y: number): keyof typeof QUADRANT_COLOR {
  if (x >= 50 && y >= 50) return 'sobreconsumo'
  if (x < 50 && y >= 50) return 'vigilar'
  if (x >= 50 && y < 50) return 'critico'
  return 'saludable'
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: QuadrantPoint }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-[12px] shadow-card-hover">
      <p className="mb-1 font-semibold text-foreground">{p.name}</p>
      <p className="text-muted-foreground">
        Tiempo transcurrido: <span className="mono text-foreground">{p.x.toFixed(0)}%</span>
      </p>
      <p className="text-muted-foreground">
        Horas consumidas: <span className="mono text-foreground">{p.realY.toFixed(0)}%</span>
      </p>
      <p className="text-muted-foreground">
        Días restantes: <span className="mono text-foreground">{p.daysRemaining}</span>
      </p>
    </div>
  )
}

export function QuadrantChart({ projects }: { projects: AnalyzableProject[] }) {
  const points: QuadrantPoint[] = projects
    .filter((p): p is AnalyzableProject & { pctConsumed: number } => p.pctConsumed !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      x: p.pctTimeElapsed,
      y: Math.min(p.pctConsumed, Y_MAX),
      realY: p.pctConsumed,
      daysRemaining: p.daysRemaining,
    }))

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[12px] bg-white text-[12.5px] text-muted-foreground shadow-card">
        Sin datos suficientes (horas vendidas) para graficar.
      </div>
    )
  }

  return (
    <div className="rounded-[12px] bg-white p-4 shadow-card">
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-foreground">
        Cuadrantes: tiempo transcurrido vs. horas consumidas
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <ReferenceArea x1={50} x2={100} y1={50} y2={Y_MAX} fill={QUADRANT_COLOR.sobreconsumo} fillOpacity={0.06} />
          <ReferenceArea x1={0} x2={50} y1={50} y2={Y_MAX} fill={QUADRANT_COLOR.vigilar} fillOpacity={0.06} />
          <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill={QUADRANT_COLOR.critico} fillOpacity={0.07} />
          <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill={QUADRANT_COLOR.saludable} fillOpacity={0.06} />

          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ]}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
          />
          <ReferenceLine x={50} stroke="var(--border)" />
          <ReferenceLine y={50} stroke="var(--border)" />

          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            label={{ value: '% tiempo transcurrido', position: 'insideBottom', offset: -10, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, Y_MAX]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            width={70}
            label={{ value: '% horas consumidas', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

          <Scatter data={points}>
            {points.map((p) => (
              <Cell key={p.id} fill={QUADRANT_COLOR[quadrantOf(p.x, p.realY)]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: QUADRANT_COLOR.saludable }} />
          Ritmo saludable
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: QUADRANT_COLOR.vigilar }} />
          Adelantado, vigilar
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: QUADRANT_COLOR.sobreconsumo }} />
          Riesgo de sobreconsumo
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: QUADRANT_COLOR.critico }} />
          Crítico: vence y sobran horas
        </span>
      </div>
    </div>
  )
}
