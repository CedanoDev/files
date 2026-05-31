'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type Shift = 'MORNING' | 'AFTERNOON' | 'CLOSING'
type Moment = 'OPENING' | 'DURING' | 'CLOSING'

interface ChecklistTask {
  id: string
  title: string
  isGlobal: boolean
  isCompleted: boolean
  completedAt: Date | null
  completedBy: string | null
  observation: string | null
}

interface ChecklistSession {
  id: string
  moment: Moment
  shift: Shift
  isSigned: boolean
  signedAt: Date | null
  tasks: ChecklistTask[]
}

const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', CLOSING: 'Cierre',
}

const MOMENT_CONFIG: Record<Moment, { label: string; emoji: string; desc: string; color: string }> = {
  OPENING: { label: 'Apertura',          emoji: '🌅', desc: 'Antes de abrir el edificio',  color: '#1d4ed8' },
  DURING:  { label: 'Durante operación', emoji: '⚙️', desc: 'Verificaciones en el turno',  color: '#d97706' },
  CLOSING: { label: 'Cierre',            emoji: '🌙', desc: 'Al cerrar el edificio',        color: '#7c3aed' },
}

// Mock de plantillas (en producción: GET /api/checklist/sessions)
const MOCK_TASKS: Record<Moment, { id: string; title: string; isGlobal: boolean }[]> = {
  OPENING: [
    { id: 't1',  title: 'Verificar temperatura de todos los freezers',             isGlobal: true  },
    { id: 't2',  title: 'Inspeccionar fechas de vencimiento del inventario',        isGlobal: true  },
    { id: 't3',  title: 'Limpiar y sanitizar superficies de preparación',          isGlobal: true  },
    { id: 't4',  title: 'Verificar niveles de stock vs pedido del día anterior',   isGlobal: true  },
    { id: 't5',  title: 'Encender equipos y verificar funcionamiento',             isGlobal: false },
    { id: 't6',  title: 'Registrar temperatura inicial de comidas preparadas',     isGlobal: false },
  ],
  DURING: [
    { id: 't7',  title: 'Verificar temperatura de comidas calientes cada 2 horas', isGlobal: true  },
    { id: 't8',  title: 'Verificar temperatura de freezers cada 2 horas',          isGlobal: true  },
    { id: 't9',  title: 'Reemplazar comida si estuvo más de 4h fuera de rango',    isGlobal: true  },
    { id: 't10', title: 'Sanitizar áreas de atención al cliente',                  isGlobal: false },
    { id: 't11', title: 'Registrar cualquier incidente de temperatura',            isGlobal: false },
  ],
  CLOSING: [
    { id: 't12', title: 'Registrar todo el desperdicio del día',                   isGlobal: true  },
    { id: 't13', title: 'Limpiar y sanitizar todas las superficies',              isGlobal: true  },
    { id: 't14', title: 'Completar el stock list para mañana',                    isGlobal: true  },
    { id: 't15', title: 'Verificar temperatura final de freezers',                 isGlobal: true  },
    { id: 't16', title: 'Apagar equipos no esenciales',                           isGlobal: false },
    { id: 't17', title: 'Asegurar el edificio',                                   isGlobal: false },
    { id: 't18', title: 'Firmar el checklist de cierre',                          isGlobal: true  },
  ],
}

function buildSession(moment: Moment, shift: Shift): ChecklistSession {
  return {
    id: crypto.randomUUID(),
    moment,
    shift,
    isSigned: false,
    signedAt: null,
    tasks: MOCK_TASKS[moment].map((t) => ({
      ...t,
      isCompleted: false,
      completedAt: null,
      completedBy: null,
      observation: null,
    })),
  }
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function ChecklistPage() {
  const [shift, setShift] = useState<Shift>('MORNING')
  const [activeMoment, setActiveMoment] = useState<Moment>('OPENING')
  const [sessions, setSessions] = useState<Partial<Record<Moment, ChecklistSession>>>({})
  const [obsModal, setObsModal] = useState<{ sessionMoment: Moment; taskId: string } | null>(null)
  const [obsText, setObsText] = useState('')
  const [signing, setSigning] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'warn'; msg: string } | null>(null)

  function showFlash(type: 'ok' | 'warn', msg: string) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 3000)
  }

  function getOrCreateSession(moment: Moment): ChecklistSession {
    if (sessions[moment]) return sessions[moment]!
    const s = buildSession(moment, shift)
    setSessions((prev) => ({ ...prev, [moment]: s }))
    return s
  }

  const currentSession = sessions[activeMoment] ?? null

  function toggleTask(taskId: string) {
    const session = getOrCreateSession(activeMoment)
    setSessions((prev) => ({
      ...prev,
      [activeMoment]: {
        ...session,
        tasks: session.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                isCompleted: !t.isCompleted,
                completedAt: !t.isCompleted ? new Date() : null,
                completedBy: !t.isCompleted ? 'Carlos M.' : null,
              }
            : t
        ),
      },
    }))
  }

  function saveObservation() {
    if (!obsModal) return
    const session = sessions[obsModal.sessionMoment]
    if (!session) return
    setSessions((prev) => ({
      ...prev,
      [obsModal.sessionMoment]: {
        ...session,
        tasks: session.tasks.map((t) =>
          t.id === obsModal.taskId ? { ...t, observation: obsText || null } : t
        ),
      },
    }))
    setObsModal(null)
    setObsText('')
  }

  async function signSession() {
    const session = sessions[activeMoment]
    if (!session) return
    const incomplete = session.tasks.filter((t) => !t.isCompleted)
    if (incomplete.length > 0) {
      showFlash('warn', `No puedes firmar. Faltan ${incomplete.length} tarea(s) por completar.`)
      return
    }
    setSigning(true)
    await new Promise((r) => setTimeout(r, 700))
    setSessions((prev) => ({
      ...prev,
      [activeMoment]: { ...session, isSigned: true, signedAt: new Date() },
    }))
    setSigning(false)
    showFlash('ok', `✓ Sesión de ${MOMENT_CONFIG[activeMoment].label} firmada correctamente.`)
  }

  const completionRate = currentSession
    ? Math.round((currentSession.tasks.filter((t) => t.isCompleted).length / currentSession.tasks.length) * 100)
    : 0

  const allDone = currentSession ? currentSession.tasks.every((t) => t.isCompleted) : false

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.headerLabel}>Story Land · Food Safety</div>
            <h1 style={S.headerTitle}>Checklist de Tareas</h1>
          </div>
          <div style={S.headerMeta}>
            <div style={S.metaDate}>
              {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={S.metaBuilding}>Ice Cream Village</div>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {flash && (
          <div style={{ ...S.flash, ...(flash.type === 'warn' ? S.flashWarn : S.flashOk) }}>
            {flash.msg}
          </div>
        )}

        {/* Turno selector */}
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

        {/* Tabs de momento */}
        <div style={S.momentTabs}>
          {(['OPENING', 'DURING', 'CLOSING'] as Moment[]).map((m) => {
            const cfg = MOMENT_CONFIG[m]
            const sess = sessions[m]
            const done = sess ? sess.tasks.filter((t) => t.isCompleted).length : 0
            const total = sess ? sess.tasks.length : MOCK_TASKS[m].length
            const pct = sess ? Math.round((done / total) * 100) : 0
            const signed = sess?.isSigned ?? false

            return (
              <button key={m}
                style={{ ...S.momentTab, ...(activeMoment === m ? { ...S.momentTabActive, borderColor: cfg.color } : {}) }}
                onClick={() => { setActiveMoment(m); getOrCreateSession(m) }}>
                <div style={S.momentTabTop}>
                  <span style={S.momentEmoji}>{cfg.emoji}</span>
                  <span style={{ ...S.momentTabLabel, color: activeMoment === m ? cfg.color : '#6b6a65' }}>
                    {cfg.label}
                  </span>
                  {signed && <span style={S.signedBadge}>✓ Firmado</span>}
                </div>
                <div style={S.momentProgress}>
                  <div style={S.progressTrack}>
                    <div style={{ ...S.progressFill, width: `${pct}%`, background: signed ? '#16a34a' : cfg.color }} />
                  </div>
                  <span style={S.progressText}>{done}/{total}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Contenido de la sesión activa */}
        <div style={S.sessionCard}>
          <div style={S.sessionHeader}>
            <div>
              <h2 style={S.sessionTitle}>
                {MOMENT_CONFIG[activeMoment].emoji} {MOMENT_CONFIG[activeMoment].label}
              </h2>
              <div style={S.sessionDesc}>{MOMENT_CONFIG[activeMoment].desc}</div>
            </div>
            <div style={S.sessionStats}>
              <div style={S.completionRing}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#f0ede8" strokeWidth="6" />
                  <circle cx="32" cy="32" r="26" fill="none"
                    stroke={allDone ? '#16a34a' : MOMENT_CONFIG[activeMoment].color}
                    strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - completionRate / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 32 32)"
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                  <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="800"
                    fill={allDone ? '#16a34a' : '#1a1a18'}>
                    {completionRate}%
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Lista de tareas */}
          <div style={S.taskList}>
            {(currentSession?.tasks ?? MOCK_TASKS[activeMoment].map((t) => ({ ...t, isCompleted: false, completedAt: null, completedBy: null, observation: null }))).map((task, i) => (
              <div key={task.id}
                style={{ ...S.taskCard, ...(task.isCompleted ? S.taskDone : {}) }}>
                <button style={{ ...S.checkbox, ...(task.isCompleted ? S.checkboxDone : {}) }}
                  onClick={() => toggleTask(task.id)}>
                  {task.isCompleted && <span style={S.checkmark}>✓</span>}
                </button>
                <div style={S.taskInfo}>
                  <div style={{ ...S.taskTitle, ...(task.isCompleted ? S.taskTitleDone : {}) }}>
                    {task.title}
                  </div>
                  <div style={S.taskMeta}>
                    {task.isGlobal
                      ? <span style={S.globalBadge}>Global</span>
                      : <span style={S.buildingBadge}>Este edificio</span>
                    }
                    {task.completedAt && (
                      <span style={S.completedInfo}>
                        · {task.completedBy} · {task.completedAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {task.observation && (
                      <span style={S.obsTag}>📝 {task.observation}</span>
                    )}
                  </div>
                </div>
                <button style={S.obsBtn}
                  onClick={() => { setObsModal({ sessionMoment: activeMoment, taskId: task.id }); setObsText(task.observation ?? '') }}>
                  {task.observation ? '📝' : '+'}
                </button>
              </div>
            ))}
          </div>

          {/* Footer de la sesión */}
          {currentSession && !currentSession.isSigned && (
            <div style={S.sessionFooter}>
              {allDone ? (
                <button style={S.signBtn} onClick={signSession} disabled={signing}>
                  {signing ? 'Firmando...' : `✍️ Firmar sesión de ${MOMENT_CONFIG[activeMoment].label}`}
                </button>
              ) : (
                <div style={S.pendingMsg}>
                  Faltan {currentSession.tasks.filter((t) => !t.isCompleted).length} tarea(s) para poder firmar.
                </div>
              )}
            </div>
          )}

          {currentSession?.isSigned && (
            <div style={S.signedInfo}>
              ✅ Firmado a las {currentSession.signedAt?.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de observación */}
      {obsModal && (
        <div style={S.modalOverlay} onClick={() => setObsModal(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>Agregar observación</h3>
            <textarea style={S.modalTextarea} rows={4}
              placeholder="Describe lo que observaste..."
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              autoFocus />
            <div style={S.modalBtns}>
              <button style={S.modalCancel} onClick={() => setObsModal(null)}>Cancelar</button>
              <button style={S.modalSave} onClick={saveObservation}>Guardar</button>
            </div>
          </div>
        </div>
      )}
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
  header: { background: C.accent, color: '#fff' },
  headerInner: { maxWidth: 900, margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
  headerMeta: { textAlign: 'right' as const },
  metaDate: { fontSize: 13, opacity: 0.8, textTransform: 'capitalize' as const },
  metaBuilding: { fontSize: 15, fontWeight: 600, marginTop: 2 },
  main: { maxWidth: 900, margin: '0 auto', padding: '24px' },
  flash: { borderRadius: 10, padding: '13px 18px', marginBottom: 16, fontWeight: 600, fontSize: 14 },
  flashOk: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' },
  flashWarn: { background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' },
  shiftRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  shiftLabel: { fontSize: 13, fontWeight: 600, color: C.muted },
  shiftBtn: { padding: '8px 16px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  shiftActive: { background: C.accent, color: '#fff', border: `1px solid ${C.accent}` },
  momentTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 },
  momentTab: { background: C.surface, border: `2px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' },
  momentTabActive: { background: '#fff', borderWidth: 2 },
  momentTabTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  momentEmoji: { fontSize: 20 },
  momentTabLabel: { fontSize: 14, fontWeight: 700, flex: 1 },
  signedBadge: { fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 10 },
  momentProgress: { display: 'flex', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 5, background: '#f0ede8', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s ease' },
  progressText: { fontSize: 11, color: C.muted, fontFamily: 'monospace', whiteSpace: 'nowrap' as const },
  sessionCard: { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '24px' },
  sessionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sessionTitle: { fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px 0' },
  sessionDesc: { fontSize: 13, color: C.muted },
  sessionStats: {},
  completionRing: {},
  taskList: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  taskCard: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fafaf8', transition: 'all 0.15s' },
  taskDone: { background: '#f0fdf4', border: '1px solid #bbf7d0' },
  checkbox: { width: 26, height: 26, borderRadius: 8, border: `2px solid ${C.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkboxDone: { background: '#16a34a', border: '2px solid #16a34a' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 800 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.4 },
  taskTitleDone: { textDecoration: 'line-through', color: '#6b7280' },
  taskMeta: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6, alignItems: 'center' },
  globalBadge: { fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 10 },
  buildingBadge: { fontSize: 10, fontWeight: 600, background: '#fdf4ff', color: '#7c3aed', padding: '2px 7px', borderRadius: 10 },
  completedInfo: { fontSize: 11, color: '#16a34a' },
  obsTag: { fontSize: 11, color: C.muted, fontStyle: 'italic' as const },
  obsBtn: { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: C.muted, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sessionFooter: { marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` },
  signBtn: { width: '100%', padding: '14px', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' },
  pendingMsg: { textAlign: 'center' as const, color: C.muted, fontSize: 13, padding: '10px 0' },
  signedInfo: { marginTop: 16, textAlign: 'center' as const, fontSize: 14, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '12px', borderRadius: 10 },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 16, padding: '28px', width: 400, maxWidth: '90vw' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px 0' },
  modalTextarea: { width: '100%', padding: '12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' },
  modalBtns: { display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' },
  modalCancel: { padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  modalSave: { padding: '10px 20px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}
