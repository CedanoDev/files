'use client'

import { useState } from 'react'

type Role = 'ADMIN' | 'SUPERVISOR' | 'EMPLOYEE'

interface LoginForm {
  email: string
  password: string
}

// Demo credentials para mostrar en desarrollo
const DEMO_USERS = [
  { role: 'ADMIN' as Role,      email: 'admin@storyland.com',      label: 'Admin global',   color: '#1a5c3a' },
  { role: 'SUPERVISOR' as Role, email: 'supervisor@storyland.com', label: 'Supervisor',      color: '#1e3a5f' },
  { role: 'EMPLOYEE' as Role,   email: 'employee@storyland.com',   label: 'Empleado',        color: '#7c2d12' },
]

const ROLE_REDIRECTS: Record<Role, string> = {
  ADMIN:      '/dashboard',
  SUPERVISOR: '/checklist',
  EMPLOYEE:   '/temperatures',
}

export default function LoginPage() {
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<{ role: Role; name: string } | null>(null)

  function setField(field: keyof LoginForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleLogin() {
    if (!form.email || !form.password) {
      setError('Completa todos los campos.')
      return
    }
    setLoading(true)
    setError(null)

    // Simula llamada a POST /api/auth/login
    await new Promise((r) => setTimeout(r, 900))

    // Lógica demo — en producción: validar JWT del servidor
    const demo = DEMO_USERS.find((u) => u.email === form.email)
    if (demo && form.password === 'demo123') {
      setLoggedIn({ role: demo.role, name: demo.label })
    } else {
      setError('Credenciales incorrectas. Usa las cuentas demo.')
    }
    setLoading(false)
  }

  function fillDemo(email: string) {
    setForm({ email, password: 'demo123' })
    setError(null)
  }

  if (loggedIn) {
    return (
      <div style={S.page}>
        <div style={S.successBox}>
          <div style={S.successIcon}>✓</div>
          <h2 style={S.successTitle}>¡Bienvenido, {loggedIn.name}!</h2>
          <p style={S.successText}>
            Iniciaste sesión correctamente. Redirigiendo a{' '}
            <strong>{ROLE_REDIRECTS[loggedIn.role]}</strong>...
          </p>
          <div style={S.roleTag}>{loggedIn.role}</div>
          <button style={S.backBtn} onClick={() => setLoggedIn(null)}>
            ← Volver al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo / brand */}
        <div style={S.brand}>
          <div style={S.brandIcon}>🎠</div>
          <div>
            <div style={S.brandName}>Story Land</div>
            <div style={S.brandSub}>Food Safety System</div>
          </div>
        </div>

        <h1 style={S.title}>Iniciar sesión</h1>
        <p style={S.subtitle}>Ingresa con tu cuenta de empleado</p>

        {/* Formulario */}
        <div style={S.field}>
          <label style={S.label}>Correo electrónico</label>
          <input style={S.input}
            type="email"
            placeholder="tu@storyland.com"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoComplete="email"
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>Contraseña</label>
          <input style={S.input}
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
          />
        </div>

        {error && <div style={S.error}>{error}</div>}

        <button
          style={{ ...S.loginBtn, ...(loading ? S.loginDisabled : {}) }}
          onClick={handleLogin}
          disabled={loading}>
          {loading ? 'Verificando...' : 'Entrar'}
        </button>

        {/* Cuentas demo */}
        <div style={S.demoDivider}>
          <span style={S.demoLine} />
          <span style={S.demoText}>Cuentas de demostración</span>
          <span style={S.demoLine} />
        </div>

        <div style={S.demoGrid}>
          {DEMO_USERS.map((u) => (
            <button key={u.role}
              style={{ ...S.demoBtn, borderColor: u.color + '40' }}
              onClick={() => fillDemo(u.email)}>
              <div style={{ ...S.demoRole, color: u.color }}>{u.label}</div>
              <div style={S.demoEmail}>{u.email}</div>
              <div style={S.demoRedirect}>→ {ROLE_REDIRECTS[u.role]}</div>
            </button>
          ))}
        </div>

        <div style={S.demoHint}>
          Contraseña demo: <strong>demo123</strong>
        </div>
      </div>
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
  page: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Georgia', serif", padding: '24px' },
  card: { background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, padding: '40px', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' },
  brand: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
  brandIcon: { fontSize: 36 },
  brandName: { fontSize: 18, fontWeight: 800, color: C.text },
  brandSub: { fontSize: 12, color: C.muted },
  title: { fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 6px 0' },
  subtitle: { fontSize: 14, color: C.muted, margin: '0 0 24px 0' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, color: C.text, background: '#fff', boxSizing: 'border-box' as const, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  loginBtn: { width: '100%', padding: '14px', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 24, letterSpacing: '0.02em' },
  loginDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  demoDivider: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  demoLine: { flex: 1, height: 1, background: C.border },
  demoText: { fontSize: 11, color: C.muted, whiteSpace: 'nowrap' as const },
  demoGrid: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 14 },
  demoBtn: { textAlign: 'left' as const, padding: '10px 14px', borderRadius: 10, border: '1px solid', background: '#fafaf8', cursor: 'pointer', fontFamily: 'inherit' },
  demoRole: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  demoEmail: { fontSize: 12, color: C.muted },
  demoRedirect: { fontSize: 11, color: C.muted, marginTop: 2 },
  demoHint: { textAlign: 'center' as const, fontSize: 12, color: C.muted },
  successBox: { background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, padding: '50px 40px', textAlign: 'center' as const, maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' },
  successIcon: { width: 64, height: 64, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#16a34a', margin: '0 auto 20px', fontWeight: 800 },
  successTitle: { fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 10px 0' },
  successText: { fontSize: 14, color: C.muted, marginBottom: 16 },
  roleTag: { display: 'inline-block', fontSize: 12, fontWeight: 700, background: '#e8f5ee', color: C.accent, padding: '4px 14px', borderRadius: 20, marginBottom: 20 },
  backBtn: { background: 'none', border: `1px solid ${C.border}`, padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit' },
}
