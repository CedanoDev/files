'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type Shift = 'MORNING' | 'AFTERNOON' | 'CLOSING'

interface FreezerUnit {
  id: string
  unitCode: string
  description: string
  minTempC: number
  maxTempC: number
}

interface FreezerReading {
  id: string
  freezerUnitId: string
  temperatureC: number
  isInRange: boolean
  recordedAt: Date
  recordedBy: string
}

const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', CLOSING: 'Cierre',
}

// Mock de unidades de freezer del edificio
const FREEZER_UNITS: FreezerUnit[] = [
  { id: 'f1', unitCode: 'FRZ-01', description: 'Freezer principal — helados',      minTempC: -20, maxTempC: -15 },
  { id: 'f2', unitCode: 'FRZ-02', description: 'Freezer secundario — ingredientes', minTempC: -18, maxTempC: -15 },
  { id: 'f3', unitCode: 'REF-01', description: 'Refrigerador — toppings y salsas',  minTempC: 1,   maxTempC: 4  },
  { id: 'f4', unitCode: 'REF-02', description: 'Refrigerador — productos lácteos',  minTempC: 1,   maxTempC: 4  },
]

function isInRange(temp: number, unit: FreezerUnit): boolean {
  return temp >= unit.minTempC && temp <= unit.maxTempC
}

function getTempStatus(temp: number, unit: FreezerUnit) {
  const inRange = isInRange(temp, unit)
  const diff = inRange
    ? 0
    : temp < unit.minTempC
      ? temp - unit.minTempC   // negativo = muy frío
      : temp - unit.maxTempC   // positivo = muy caliente

  return {
    inRange,
    diff,
    severity: Math.abs(diff) > 3 ? 'critical' : Math.abs(diff) > 1 ? 'warning' : 'ok',
  }
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function FreezersPage() {
  const [shift, setShift] = useState<Shift>('MORNING')
  const [readings, setReadings] = useState<Record<string, FreezerReading[]>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ unitId: string; type: 'ok' | 'warn' | 'critical'; msg: string } | null>(null)

  function showFlash(unitId: string, type: 'ok' | 'warn' | 'critical', msg: string) {
    setFlash({ unitId, type, msg })
    setTimeout(() => setFlash(null), 4000)
  }

  async function recordReading(unit: FreezerUnit) {
    const rawVal = inputs[unit.id]
    const temp = parseFloat(rawVal)
    if (isNaN(temp)) return

    setSaving(unit.id)
    await new Promise((r) => setTimeout(r, 500))

    const status = getTempStatus(temp, unit)
    const reading: FreezerReading = {
      id: crypto.randomUUID(),
      freezerUnitId: unit.id,
      temperatureC: temp,
      isInRange: status.inRange,
      recordedAt: new Date(),
      recordedBy: 'Carlos M.',
    }

    setReadings((prev) => ({
      ...prev,
      [unit.id]: [reading, ...(prev[unit.id] ?? [])],
    }))

    setInputs((prev) => ({ ...prev, [unit.id]: '' }))
    setSaving(null)

    if (!status.inRange) {
      const direction = status.diff > 0 ? 'alta' : 'baja'
      showFlash(
        unit.id,
        status.severity as 'warn' | 'critical',
        `${unit.unitCode}: temperatura ${direction} (${temp}°C). Rango: ${unit.minTempC}°C a ${unit.maxTempC}°C. Se notificó al supervisor.`
      )
    } else {
      showFlash(unit.id, 'ok', `${unit.unitCode}: ${temp}°C — dentro del rango ✓`)
    }
  }

  const outOfRangeCount = Object.values(readings)
    .flat()
    .filter((r) => {
      const unit = FREEZER_UNITS.find((u) => u.id === r.freezerUnitId)!
      const latestByUnit = readings[r.freezerUnitId]?.[0]
      return latestByUnit?.id === r.id && !r.isInRange
    }).length

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.headerLabel}>Story Land · Food Safety</div>
            <h1 style={S.headerTitle}>Monitoreo de Freezers</h1>
          </div>
          <div style={S.headerRight}>
            {outOfRangeCount > 0 && (
              <div style={S.alertBanner}>
                ⚠️ {outOfRangeCount} unidad(es) fuera de rango
              </div>
            )}
            <div style={S.headerMeta}>
              <div style={S.metaDate}>
                {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div style={S.metaBuilding}>Ice Cream Village</div>
            </div>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {/* Turno */}
        <div style={S.shiftRow}>
          <span style={S.shiftLabel}>Turno:</span>
          {(['MORNING', 'AFTERNOON', 'CLOSING'] as Shift[]).map((s) => (
            <button key={s}
              style={{ ...S.shiftBtn, ...(shift === s ? S.shiftActive : {}) }}
              onClick={() => setShift(s)}>
              {SHIFT_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Referencia de rangos */}
        <div style={S.refCard}>
          <span style={S.refIcon}>📋</span>
          <span style={S.refText}>
            <strong>Rangos seguros FDA:</strong> Freezers: -20°C a -15°C · Refrigeradores: 1°C a 4°C
          </span>
        </div>

        {/* Grid de freezers */}
        <div style={S.freezerGrid}>
          {FREEZER_UNITS.map((unit) => {
            const unitReadings = readings[unit.id] ?? []
            const latest = unitReadings[0] ?? null
            const latestStatus = latest ? getTempStatus(latest.temperatureC, unit) : null
            const inputVal = inputs[unit.id] ?? ''
            const inputTemp = parseFloat(inputVal)
            const inputValid = !isNaN(inputTemp)
            const previewStatus = inputValid ? getTempStatus(inputTemp, unit) : null
            const unitFlash = flash?.unitId === unit.id ? flash : null

            const cardBg = latestStatus
              ? latestStatus.inRange
                ? '#f0fdf4'
                : latestStatus.severity === 'critical' ? '#fef2f2' : '#fffbeb'
              : '#fff'

            const cardBorder = latestStatus
              ? latestStatus.inRange ? '#bbf7d0'
              : latestStatus.severity === 'critical' ? '#fecaca' : '#fcd34d'
              : '#e5e3dd'

            return (
              <div key={unit.id} style={{ ...S.freezerCard, background: cardBg, borderColor: cardBorder }}>
                {/* Cabecera de unidad */}
                <div style={S.unitHeader}>
                  <div>
                    <div style={S.unitCode}>{unit.unitCode}</div>
                    <div style={S.unitDesc}>{unit.description}</div>
                  </div>
                  <div style={S.unitRange}>
                    {unit.minTempC}°C a {unit.maxTempC}°C
                  </div>
                </div>

                {/* Última lectura */}
                {latest && (
                  <div style={{ ...S.latestReading, color: latestStatus?.inRange ? '#15803d' : '#dc2626' }}>
                    <span style={S.latestTemp}>{latest.temperatureC}°C</span>
                    <span style={S.latestInfo}>
                      {latestStatus?.inRange ? '✓ En rango' : `✗ ${latestStatus?.diff! > 0 ? 'Muy alta' : 'Muy baja'}`}
                      {' · '}{latest.recordedAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                {!latest && (
                  <div style={S.noReading}>Sin lectura en este turno</div>
                )}

                {/* Flash de esta unidad */}
                {unitFlash && (
                  <div style={{
                    ...S.unitFlash,
                    background: unitFlash.type === 'ok' ? '#f0fdf4' : unitFlash.type === 'critical' ? '#fef2f2' : '#fffbeb',
                    color: unitFlash.type === 'ok' ? '#15803d' : unitFlash.type === 'critical' ? '#dc2626' : '#92400e',
                    border: `1px solid ${unitFlash.type === 'ok' ? '#bbf7d0' : unitFlash.type === 'critical' ? '#fecaca' : '#fcd34d'}`,
                  }}>
                    {unitFlash.msg}
                  </div>
                )}

                {/* Input de nueva lectura */}
                <div style={S.inputRow}>
                  <input
                    style={{
                      ...S.tempInput,
                      ...(inputValid && previewStatus && !previewStatus.inRange ? S.inputDanger : {}),
                      ...(inputValid && previewStatus?.inRange ? S.inputOk : {}),
                    }}
                    type="number"
                    step="0.1"
                    placeholder={`ej: ${unit.minTempC + 2}°C`}
                    value={inputVal}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && inputValid && recordReading(unit)}
                  />
                  <button
                    style={{ ...S.recordBtn, ...((!inputValid || saving === unit.id) ? S.recordDisabled : {}) }}
                    onClick={() => recordReading(unit)}
                    disabled={!inputValid || saving === unit.id}>
                    {saving === unit.id ? '...' : 'Registrar'}
                  </button>
                </div>

                {/* Historial compacto */}
                {unitReadings.length > 1 && (
                  <div style={S.historyRow}>
                    {unitReadings.slice(1, 4).map((r) => {
                      const s = getTempStatus(r.temperatureC, unit)
                      return (
                        <div key={r.id} style={{ ...S.historyDot, color: s.inRange ? '#6b7280' : '#dc2626' }}>
                          {r.temperatureC}°C
                          <span style={{ fontSize: 10 }}>
                            {' '}{r.recordedAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Resumen de lecturas del turno */}
        {Object.values(readings).flat().length > 0 && (
          <div style={S.summaryCard}>
            <h3 style={S.summaryTitle}>Resumen del turno — {SHIFT_LABELS[shift]}</h3>
            <div style={S.summaryGrid}>
              <div style={S.summaryItem}>
                <div style={S.summaryVal}>{Object.values(readings).flat().length}</div>
                <div style={S.summaryLabel}>Lecturas registradas</div>
              </div>
              <div style={{ ...S.summaryItem, color: '#16a34a' }}>
                <div style={S.summaryVal}>
                  {FREEZER_UNITS.filter((u) => (readings[u.id]?.[0]?.isInRange ?? false)).length}
                </div>
                <div style={S.summaryLabel}>Unidades en rango</div>
              </div>
              <div style={{ ...S.summaryItem, color: '#dc2626' }}>
                <div style={S.summaryVal}>{outOfRangeCount}</div>
                <div style={S.summaryLabel}>Alertas activas</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────

const C = {
  bg: '#f8f7f4', surface: '#fff', border: '#e5e3dd',
  text: '#1a1a18', muted: '#6b6a65', accent: '#1a5c3a',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: C.bg, fontFamily: "'Georgia', serif" },
  header: { background: '#1e3a5f', color: '#fff' },
  headerInner: { maxWidth: 1000, margin: '0 auto', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
  headerRight: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 },
  alertBanner: { background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 },
  headerMeta: { textAlign: 'right' as const },
  metaDate: { fontSize: 13, opacity: 0.8, textTransform: 'capitalize' as const },
  metaBuilding: { fontSize: 14, fontWeight: 600 },
  main: { maxWidth: 1000, margin: '0 auto', padding: '24px' },
  shiftRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  shiftLabel: { fontSize: 13, fontWeight: 600, color: C.muted },
  shiftBtn: { padding: '8px 16px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  shiftActive: { background: '#1e3a5f', color: '#fff', border: '1px solid #1e3a5f' },
  refCard: { display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#1e40af' },
  refIcon: { fontSize: 18 },
  refText: {},
  freezerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  freezerCard: { borderRadius: 14, border: '1px solid', padding: '18px', transition: 'all 0.2s' },
  unitHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  unitCode: { fontSize: 15, fontWeight: 800, color: C.text, fontFamily: 'monospace' },
  unitDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  unitRange: { fontSize: 11, color: C.muted, background: '#f0ede8', padding: '3px 8px', borderRadius: 8 },
  latestReading: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  latestTemp: { fontSize: 32, fontWeight: 900, fontFamily: 'monospace' },
  latestInfo: { fontSize: 12, fontWeight: 600 },
  noReading: { fontSize: 13, color: C.muted, fontStyle: 'italic' as const, marginBottom: 12 },
  unitFlash: { borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500, marginBottom: 10 },
  inputRow: { display: 'flex', gap: 8, marginBottom: 10 },
  tempInput: { flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: 'monospace', fontWeight: 700, outline: 'none', background: '#fff' },
  inputDanger: { borderColor: '#dc2626', background: '#fff5f5' },
  inputOk: { borderColor: '#86efac', background: '#f0fdf4' },
  recordBtn: { padding: '10px 16px', borderRadius: 8, background: '#1e3a5f', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' },
  recordDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  historyRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  historyDot: { fontSize: 11, fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 10 },
  summaryCard: { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px' },
  summaryTitle: { fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 16px 0' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  summaryItem: { textAlign: 'center' as const },
  summaryVal: { fontSize: 28, fontWeight: 900, fontFamily: 'monospace', color: 'inherit' },
  summaryLabel: { fontSize: 12, color: C.muted, marginTop: 4 },
}
