'use client'

import { useState } from 'react'

type Shift = 'MORNING' | 'AFTERNOON' | 'CLOSING'
type DiscardReason = 'EXPIRED' | 'TEMP_VIOLATION' | 'OVERPRODUCTION' | 'DAMAGED' | 'OTHER'
type MeasureType = 'kg' | 'units'

interface WasteEntry {
  id: string
  productName: string
  quantity: number
  measureType: MeasureType
  estimatedCostUsd: number
  discardReason: DiscardReason
  shift: Shift
  recordedAt: Date
}

const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', CLOSING: 'Cierre',
}

const REASON_LABELS: Record<DiscardReason, { label: string; emoji: string; color: string }> = {
  EXPIRED:        { label: 'Vencido',               emoji: '⏰', color: '#dc2626' },
  TEMP_VIOLATION: { label: 'Violación de temp.',     emoji: '🌡️', color: '#d97706' },
  OVERPRODUCTION: { label: 'Sobreproducción',        emoji: '📦', color: '#7c3aed' },
  DAMAGED:        { label: 'Daño físico',            emoji: '💔', color: '#0891b2' },
  OTHER:          { label: 'Otro',                   emoji: '📝', color: '#6b7280' },
}

const COST_PER_KG = 4.5

export default function WastePage() {
  const [shift, setShift] = useState<Shift>('CLOSING')
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [measureType, setMeasureType] = useState<MeasureType>('kg')
  const [discardReason, setDiscardReason] = useState<DiscardReason>('OVERPRODUCTION')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<WasteEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const qty = parseFloat(quantity)
  const qtyValid = !isNaN(qty) && qty > 0
  const estimatedCost = measureType === 'kg' && qtyValid
    ? Math.round(qty * COST_PER_KG * 100) / 100
    : 0

  function showFlash(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 3000)
  }

  async function handleSubmit() {
    if (!productName.trim() || !qtyValid) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 500))

    const entry: WasteEntry = {
      id: crypto.randomUUID(),
      productName: productName.trim(),
      quantity: qty,
      measureType,
      estimatedCostUsd: estimatedCost,
      discardReason,
      shift,
      recordedAt: new Date(),
    }

    setEntries((prev) => [entry, ...prev])
    setProductName('')
    setQuantity('')
    setNotes('')
    setSubmitting(false)
    showFlash(`✓ ${entry.productName} registrado.`)
  }

  const totalCost = entries.reduce((sum, e) => sum + e.estimatedCostUsd, 0)
  const totalKg   = entries.filter((e) => e.measureType === 'kg').reduce((sum, e) => sum + e.quantity, 0)

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.headerLabel}>Story Land · Food Safety</div>
            <h1 style={S.headerTitle}>Registro de Desperdicios</h1>
          </div>
          <div style={S.headerMeta}>
            <div style={S.metaDate}>
              {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={S.metaBadge}>Cierre del día</div>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {flash && <div style={S.flash}>{flash}</div>}

        <div style={S.grid}>
          {/* ── Formulario ── */}
          <section style={S.card}>
            <h2 style={S.cardTitle}>Nuevo desperdicio</h2>

            {/* Turno */}
            <div style={S.field}>
              <label style={S.label}>Turno</label>
              <div style={S.segmented}>
                {(['MORNING', 'AFTERNOON', 'CLOSING'] as Shift[]).map((s) => (
                  <button key={s}
                    style={{ ...S.seg, ...(shift === s ? S.segActive : {}) }}
                    onClick={() => setShift(s)}>
                    {SHIFT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Producto */}
            <div style={S.field}>
              <label style={S.label}>Producto</label>
              <input style={S.input}
                placeholder="ej: Hot Dogs, French Fries..."
                value={productName}
                onChange={(e) => setProductName(e.target.value)} />
            </div>

            {/* Cantidad */}
            <div style={S.field}>
              <label style={S.label}>Cantidad</label>
              <div style={S.qtyRow}>
                <input style={{ ...S.input, maxWidth: 130 }}
                  type="number" min="0.1" step="0.1"
                  placeholder="0.0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)} />
                <div style={S.segmented}>
                  {(['kg', 'units'] as MeasureType[]).map((m) => (
                    <button key={m}
                      style={{ ...S.seg, ...(measureType === m ? S.segActive : {}) }}
                      onClick={() => setMeasureType(m)}>
                      {m === 'kg' ? 'Kilogramos' : 'Unidades'}
                    </button>
                  ))}
                </div>
              </div>
              {measureType === 'kg' && qtyValid && (
                <div style={S.costHint}>
                  Costo estimado: <strong>${estimatedCost} USD</strong>
                </div>
              )}
            </div>

            {/* Razón */}
            <div style={S.field}>
              <label style={S.label}>Razón del descarte</label>
              <div style={S.reasonGrid}>
                {(Object.keys(REASON_LABELS) as DiscardReason[]).map((r) => {
                  const { label, emoji, color } = REASON_LABELS[r]
                  const active = discardReason === r
                  return (
                    <button key={r}
                      style={{
                        ...S.reasonBtn,
                        ...(active ? { borderColor: color, background: color + '15', color } : {}),
                      }}
                      onClick={() => setDiscardReason(r)}>
                      <span style={{ fontSize: 20 }}>{emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notas */}
            <div style={S.field}>
              <label style={S.label}>Observaciones</label>
              <textarea style={S.textarea} rows={2}
                placeholder="Detalles adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button
              style={{ ...S.submitBtn, ...(!productName.trim() || !qtyValid || submitting ? S.submitDisabled : {}) }}
              onClick={handleSubmit}
              disabled={!productName.trim() || !qtyValid || submitting}>
              {submitting ? 'Guardando...' : '+ Registrar desperdicio'}
            </button>
          </section>

          {/* ── Lista del día ── */}
          <section style={S.card}>
            {/* Totales */}
            <div style={S.totalsRow}>
              <div style={S.totalCard}>
                <div style={S.totalValue}>{Math.round(totalKg * 10) / 10} kg</div>
                <div style={S.totalLabel}>Total desperdiciado</div>
              </div>
              <div style={{ ...S.totalCard, ...S.totalCost }}>
                <div style={{ ...S.totalValue, color: '#dc2626' }}>${Math.round(totalCost * 100) / 100}</div>
                <div style={S.totalLabel}>Costo estimado USD</div>
              </div>
              <div style={S.totalCard}>
                <div style={S.totalValue}>{entries.length}</div>
                <div style={S.totalLabel}>Registros</div>
              </div>
            </div>

            <h2 style={{ ...S.cardTitle, marginTop: 16 }}>Registros de hoy</h2>

            {entries.length === 0 ? (
              <div style={S.empty}>
                <div style={S.emptyIcon}>🗑️</div>
                <div style={S.emptyText}>Sin desperdicios registrados</div>
                <div style={S.emptySubtext}>Usa el formulario para agregar el primero.</div>
              </div>
            ) : (
              <div style={S.entryList}>
                {entries.map((e) => {
                  const { emoji, color } = REASON_LABELS[e.discardReason]
                  return (
                    <div key={e.id} style={S.entryCard}>
                      <div style={{ ...S.reasonDot, background: color + '20', color }}>
                        {emoji}
                      </div>
                      <div style={S.entryInfo}>
                        <div style={S.entryName}>{e.productName}</div>
                        <div style={S.entrySub}>
                          {REASON_LABELS[e.discardReason].label} · {SHIFT_LABELS[e.shift]} ·{' '}
                          {e.recordedAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={S.entryRight}>
                        <div style={S.entryQty}>
                          {e.quantity} {e.measureType === 'kg' ? 'kg' : 'u.'}
                        </div>
                        {e.estimatedCostUsd > 0 && (
                          <div style={S.entryCost}>${e.estimatedCostUsd}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {entries.length > 0 && (
              <button style={S.closeBtn}>
                Cerrar registros del día →
              </button>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

const C = {
  bg: '#f8f7f4', surface: '#fff', border: '#e5e3dd',
  text: '#1a1a18', muted: '#6b6a65',
  accent: '#1a5c3a',
  danger: '#dc2626',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: C.bg, fontFamily: "'Georgia', serif" },
  header: { background: '#7c2d12', color: '#fff' },
  headerInner: { maxWidth: 1100, margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
  headerMeta: { textAlign: 'right' as const },
  metaDate: { fontSize: 13, opacity: 0.8, textTransform: 'capitalize' as const },
  metaBadge: { fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, marginTop: 4, display: 'inline-block' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
  flash: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 10, padding: '12px 18px', marginBottom: 18, fontWeight: 600, fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  card: { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '24px' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 18px 0' },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 },
  segmented: { display: 'flex', gap: 6 },
  seg: { flex: 1, padding: '10px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#f8f7f4', color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  segActive: { background: C.accent, color: '#fff', border: `1px solid ${C.accent}` },
  input: { width: '100%', padding: '11px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, color: C.text, background: '#fff', boxSizing: 'border-box' as const, fontFamily: 'inherit', outline: 'none' },
  qtyRow: { display: 'flex', gap: 10, alignItems: 'center' },
  costHint: { marginTop: 8, fontSize: 13, color: C.muted },
  reasonGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  reasonBtn: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4, padding: '12px 8px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: C.muted, transition: 'all 0.15s' },
  textarea: { width: '100%', padding: '11px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  submitBtn: { width: '100%', padding: '14px', borderRadius: 10, background: '#7c2d12', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' },
  submitDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  totalsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  totalCard: { background: '#f9fafb', borderRadius: 10, padding: '14px', textAlign: 'center' as const, border: `1px solid ${C.border}` },
  totalCost: { background: '#fff5f5', border: '1px solid #fecaca' },
  totalValue: { fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'monospace' },
  totalLabel: { fontSize: 11, color: C.muted, marginTop: 4 },
  empty: { textAlign: 'center' as const, padding: '40px 20px', color: C.muted },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  emptySubtext: { fontSize: 13 },
  entryList: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  entryCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: `1px solid ${C.border}` },
  reasonDot: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: 700, color: C.text },
  entrySub: { fontSize: 11, color: C.muted, marginTop: 2 },
  entryRight: { textAlign: 'right' as const },
  entryQty: { fontSize: 16, fontWeight: 800, color: C.text, fontFamily: 'monospace' },
  entryCost: { fontSize: 12, color: C.danger, fontWeight: 600, marginTop: 2 },
  closeBtn: { width: '100%', marginTop: 16, padding: '12px', borderRadius: 10, background: 'none', border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
