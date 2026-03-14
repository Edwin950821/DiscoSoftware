import { useState, useMemo } from 'react'
import { API_URL, apiFetch } from '../lib/config'
import type { DiscoRol } from '../types'
import TerminosCondiciones from './TerminosCondiciones'
import PoliticaPrivacidad from './PoliticaPrivacidad'

interface LoginProps {
  onLogin: (accessToken: string, refreshToken: string, rol: DiscoRol, nombre: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTerminos, setShowTerminos] = useState(false)
  const [showPolitica, setShowPolitica] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Ingrese usuario y contraseña')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Credenciales inválidas')
        return
      }

      onLogin(data.accessToken, data.refreshToken, data.rol, data.nombre)
    } catch {
      setError('No se pudo conectar al servidor')
    } finally {
      setLoading(false)
    }
  }

  const particles = useMemo(() =>
    Array.from({ length: 20 }, () => ({
      size: 2 + Math.random() * 4,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 5 + Math.random() * 10,
      delay: Math.random() * 5,
    })), [])

  return (
    <div className="min-h-screen flex bg-[#0A0A0A]">
      <div className="hidden lg:flex lg:w-[55%] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D0D0D] via-[#1a1206] to-[#0D0D0D]" />

        <div className="absolute inset-0 overflow-hidden">
          {particles.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full opacity-30"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: '#D4AF37',
                left: `${p.left}%`,
                top: `${p.top}%`,
                animation: `float ${p.duration}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-12">
          <img src="/assets/M02.png" alt="Monastery Club" className="h-16 object-contain mx-auto mb-6" />
          <p className="text-white/50 text-lg">La mejor experiencia en Baranoa</p>
          <div className="mt-8 w-24 h-[1px] mx-auto bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        </div>
      </div>

      <div className="w-full lg:w-[45%] flex items-center justify-center p-6">
        <div
          className="w-full max-w-[420px] rounded-[20px] p-8 sm:p-10"
          style={{
            backgroundColor: '#0D0D0D',
            border: '1px solid rgba(212,175,55,0.3)',
            boxShadow: '0 0 60px rgba(212,175,55,0.15)',
          }}
        >
      
          <div className="flex flex-col items-center mb-8">
            <img src="/assets/M04.png" alt="Monastery" className="w-20 h-20 object-contain" />
          </div>


          <form onSubmit={handleSubmit} className="space-y-5">
          
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(212,175,55,0.2)',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#D4AF37')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.2)')}
              />
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(212,175,55,0.2)',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#D4AF37')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(212,175,55,0.2)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>

         
            {error && (
              <div className="text-sm text-center py-2 px-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #F5D76E)',
                color: '#0D0D0D',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(212,175,55,0.4)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-white/20 text-[10px] mt-6 leading-relaxed">
            Al ingresar, aceptas nuestros{' '}
            <span className="underline cursor-pointer" style={{ color: '#D4AF37' }} onClick={() => setShowTerminos(true)}>
              Términos y Condiciones
            </span>{' '}
            y{' '}
            <span className="underline cursor-pointer" style={{ color: '#D4AF37' }} onClick={() => setShowPolitica(true)}>
              Política de Privacidad
            </span>
          </p>
          <p className="text-center text-white/15 text-[10px] mt-3">Solo personal autorizado</p>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 h-40 pointer-events-none lg:hidden"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(212,175,55,0.15) 0%, transparent 70%)',
        }}
      />

      {showTerminos && <TerminosCondiciones onClose={() => setShowTerminos(false)} />}
      {showPolitica && <PoliticaPrivacidad onClose={() => setShowPolitica(false)} />}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.2; }
          75% { transform: translateY(-30px) translateX(15px); opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
