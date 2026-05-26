'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface StockItem {
  id: string
  productName: string
  unit: string
  quantityRequested: number
  quantitySuggested: number | null
}

interface Suggestion {
  productName: string
  unit: string
  suggestedQuantity: number
  averageWastePerDay: number
  reasoning: string
}

// Mock de sugerencias (en producción: GET /api/stock/suggestions)
const MOCK_SUGGESTIONS: Suggestion[] = [
  { productName: 'Hot Dogs', unit: 'kg', suggestedQuantity: 12, averageWastePerDay: 3.2, reasoning: 'Hot Dogs: promedio pedido 18kg, desperdicio 3.2kg/día. Sugerencia ajustada: 12kg (reducción del 33%).' },
  { productName: 'Chicken Tenders', unit: 'kg', suggestedQuantity: 8, averageWastePerDay: 1.8, reasoning: 'Chicken Tenders: promedio pedido 11kg, desperdicio 1.8kg/día. Sugerencia ajustada: 8kg (reducción del 27%).' },
  { productName: 'Ice Cream Cones', unit: 'unidades', suggestedQuantity: 90, averageWastePerDay: 22, reasoning: 'Ice Cream Cones: promedio pedido 120 unidades, desperdicio 22/día. Sugerencia ajustada: 90 (reducción del 25%).' },
]

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [productName, setProductName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)

  function addItem() {
    const q = parseFloat(qty)
    if (!productName.trim() || isNaN(q) || q <= 0) return

    const suggestion = MOCK_SUGGESTIONS.find(
      (s) => s.productName.toLowerCase() === productName.toLowerCase()
    )

    const item: StockItem = {
      id: crypto.randomUUID(),
      productName: productName.trim(),
      unit,
      quantityRequested: q,
      quantitySuggested: suggestion?.suggestedQuantity ?? null,
    }

    setItems((prev) => [...prev, item])
    setProductName('')
    setQty('')
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function applySuggestion(s: Suggestion) {
    const exists = items.find((i) => i.productName.toLowerCase() === s.productName.toLowerCase())
    if (exists) return
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productName: s.productName,
        unit: s.unit,
        quantityRequested: s.suggestedQuantity,
        quantitySuggested: s.suggestedQuantity,
      },
    ])
  }

  async function submitRequest() {
    if (items.length === 0) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    setSubmitted(true)
  }

  const overRequestedItems = items.filter(
    (i) => i.quantitySuggested !== null && i.quantityRequested > i.quantitySuggested
  )

  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={styles.successScreen}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Solicitud enviada al warehouse</h2>
          <p style={styles.successText}>
            {items.length} productos enviados. El warehouse procesará el pedido para mañana.
          </p>
          <button style={styles.resetBtn} onClick={() => { setSubmitted(false); setItems([]) }}>
            Nueva solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.headerLabel}>Story Land · Food Safety</div>
            <h1 style={styles.headerTitle}>Stock List</h1>
          </div>
          <div style={styles.headerMeta}>
            <div style={styles.metaDate}>{new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div style={styles.metaBadge}>Pedido para mañana</div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.grid}>

          {/* ── Panel izquierdo: sugerencias + formulario ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Sugerencias del sistema */}
            <section style={styles.card}>
              <div style={styles.suggHeaderRow}>
                <div>
                  <h2 style={styles.cardTitle}>Sugerencias del sistema</h2>
                  <div style={styles.suggSubtitle}>Basado en 14 días de historial de desperdicio</div>
                </div>
                <button style={styles.toggleBtn} onClick={() => setShowSuggestions(!showSuggestions)}>
                  {showSuggestions ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {showSuggestions && (
                <div style={styles.suggList}>
                  {MOCK_SUGGESTIONS.map((s) => {
                    const alreadyAdded = items.some(
                      (i) => i.productName.toLowerCase() === s.productName.toLowerCase()
                    )
                    return (
                      <div key={s.productName} style={styles.suggCard}>
                        <div style={styles.suggLeft}>
                          <div style={styles.suggProduct}>{s.productName}</div>
                          <div style={styles.suggReasoning}>{s.reasoning}</div>
                          <div style={styles.suggWaste}>
                            Desperdicio promedio: <strong>{s.averageWastePerDay} {s.unit}/día</strong>
                          </div>
                        </div>
                        <div style={styles.suggRight}>
                          <div style={styles.suggQty}>{s.suggestedQuantity}</div>
                          <div style={styles.suggUnit}>{s.unit}</div>
                          <button
                            style={{ ...styles.applyBtn, ...(alreadyAdded ? styles.applyDisabled : {}) }}
                            onClick={() => applySuggestion(s)}
                            disabled={alreadyAdded}
                          >
                            {alreadyAdded ? 'Agregado ✓' : 'Aplicar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Formulario manual */}
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Agregar producto</h2>

              <div style={styles.formRow}>
                <div style={{ flex: 3 }}>
                  <label style={styles.label}>Producto</label>
                  <input
                    style={styles.input}
                    placeholder="ej: French Fries"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Cantidad</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0.1"
                    step="0.5"
                    placeholder="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Unidad</label>
                  <select style={styles.input} value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option>kg</option>
                    <option>unidades</option>
                    <option>cajas</option>
                    <option>litros</option>
                  </select>
                </div>
              </div>

              <button
                style={{ ...styles.addBtn, ...(!productName.trim() || !qty ? styles.addDisabled : {}) }}
                onClick={addItem}
                disabled={!productName.trim() || !qty}
              >
                + Agregar al pedido
              </button>
            </section>
          </div>

          {/* ── Panel derecho: resumen del pedido ── */}
          <section style={styles.card}>
            <div style={styles.listHeader}>
              <h2 style={styles.cardTitle}>Pedido actual</h2>
              <div style={styles.itemCount}>{items.length} productos</div>
            </div>

            {/* Alerta si hay over-requested */}
            {overRequestedItems.length > 0 && (
              <div style={styles.overAlert}>
                ⚠️ <strong>{overRequestedItems.length} producto(s)</strong> superan la cantidad sugerida.
                Considera reducir para evitar desperdicio.
              </div>
            )}

            {items.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>📦</div>
                <div style={styles.emptyText}>Pedido vacío</div>
                <div style={styles.emptySubtext}>Aplica sugerencias o agrega productos manualmente.</div>
              </div>
            ) : (
              <>
                <div style={styles.itemList}>
                  {items.map((item) => {
                    const isOver = item.quantitySuggested !== null && item.quantityRequested > item.quantitySuggested
                    return (
                      <div key={item.id} style={{ ...styles.itemCard, ...(isOver ? styles.itemCardWarn : {}) }}>
                        <div style={styles.itemInfo}>
                          <div style={styles.itemName}>{item.productName}</div>
                          {item.quantitySuggested !== null && (
                            <div style={{ fontSize: 11, color: isOver ? '#d97706' : '#6b7280', marginTop: 2 }}>
                              {isOver
                                ? `Sugerido: ${item.quantitySuggested} ${item.unit} (estás pidiendo ${item.quantityRequested - item.quantitySuggested} de más)`
                                : `✓ En línea con sugerencia (${item.quantitySuggested} ${item.unit})`
                              }
                            </div>
                          )}
                        </div>
                        <div style={styles.itemQtyRow}>
                          <span style={styles.itemQty}>{item.quantityRequested}</span>
                          <span style={styles.itemUnit}>{item.unit}</span>
                          <button style={styles.removeBtn} onClick={() => removeItem(item.id)}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Notas */}
                <div style={{ marginTop: 16 }}>
                  <label style={styles.label}>Notas para el warehouse</label>
                  <textarea
                    style={styles.textarea}
                    placeholder="Instrucciones especiales..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Enviar */}
                <button
                  style={{ ...styles.submitBtn, ...(submitting ? styles.submitDisabled : {}) }}
                  onClick={submitRequest}
                  disabled={submitting}
                >
                  {submitting ? 'Enviando...' : `Enviar pedido al warehouse (${items.length} productos)`}
                </button>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────

const C = {
  bg: '#f8f7f4', surface: '#fff', border: '#e5e3dd',
  text: '#1a1a18', muted: '#6b6a65',
  accent: '#1a5c3a', accentLight: '#e8f5ee',
  warn: '#d97706', warnLight: '#fffbeb', warnBorder: '#fcd34d',
  danger: '#dc2626', dangerLight: '#fef2f2',
  ok: '#16a34a', okLight: '#f0fdf4',
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: C.bg, fontFamily: "'Georgia', serif" },
  header: { background: C.accent, color: '#fff' },
  headerInner: { maxWidth: 1100, margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
  headerMeta: { textAlign: 'right' as const },
  metaDate: { fontSize: 13, opacity: 0.8, textTransform: 'capitalize' as const },
  metaBadge: { fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, marginTop: 4, display: 'inline-block' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  card: { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '24px' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 4px 0' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box' as const, fontFamily: 'inherit', outline: 'none' },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  formRow: { display: 'flex', gap: 10, marginBottom: 14 },
  addBtn: { width: '100%', padding: '12px', borderRadius: 10, background: C.accentLight, color: C.accent, fontSize: 14, fontWeight: 700, border: `1px solid ${C.accent}`, cursor: 'pointer' },
  addDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  suggHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  suggSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  toggleBtn: { fontSize: 12, color: C.muted, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  suggList: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  suggCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` },
  suggLeft: { flex: 1 },
  suggProduct: { fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 },
  suggReasoning: { fontSize: 11, color: C.muted, marginBottom: 3 },
  suggWaste: { fontSize: 11, color: '#d97706' },
  suggRight: { textAlign: 'center' as const, minWidth: 80 },
  suggQty: { fontSize: 24, fontWeight: 800, color: C.accent, fontFamily: 'monospace' },
  suggUnit: { fontSize: 11, color: C.muted, marginBottom: 6 },
  applyBtn: { fontSize: 12, fontWeight: 600, background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' },
  applyDisabled: { background: '#d1fae5', color: C.ok, cursor: 'default' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  itemCount: { fontSize: 13, fontWeight: 600, color: C.muted },
  overAlert: { background: C.warnLight, border: `1px solid ${C.warnBorder}`, color: '#92400e', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  empty: { textAlign: 'center' as const, padding: '40px 20px', color: C.muted },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  emptySubtext: { fontSize: 13 },
  itemList: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 14 },
  itemCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: `1px solid ${C.border}` },
  itemCardWarn: { background: C.warnLight, border: `1px solid ${C.warnBorder}` },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: 700, color: C.text },
  itemQtyRow: { display: 'flex', alignItems: 'center', gap: 6 },
  itemQty: { fontSize: 18, fontWeight: 800, color: C.text, fontFamily: 'monospace' },
  itemUnit: { fontSize: 12, color: C.muted },
  removeBtn: { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4 },
  submitBtn: { width: '100%', padding: '14px', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 4 },
  submitDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  successScreen: { maxWidth: 480, margin: '100px auto', textAlign: 'center' as const, background: C.surface, borderRadius: 20, padding: '60px 40px', border: `1px solid ${C.border}` },
  successIcon: { width: 64, height: 64, background: C.okLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: C.ok, margin: '0 auto 20px', fontWeight: 700 },
  successTitle: { fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 12 },
  successText: { fontSize: 14, color: C.muted, marginBottom: 28 },
  resetBtn: { padding: '12px 28px', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' },
}
