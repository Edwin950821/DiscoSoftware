import { useState } from 'react'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { API_URL } from '../lib/config'

interface Props {
  accessToken: string
}

export default function Configuracion({ accessToken }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async () => {
    setPwMsg(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMsg({ text: 'Completa todos los campos', ok: false })
      return
    }
    if (newPassword.length < 6) {
      setPwMsg({ text: 'La nueva contraseña debe tener al menos 6 caracteres', ok: false })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'Las contraseñas no coinciden', ok: false })
      return
    }

    setPwLoading(true)
    try {
      const res = await fetch(`${API_URL}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setPwMsg({ text: data.message || 'Contraseña actualizada', ok: true })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPwMsg({ text: data.message || 'Error al cambiar contraseña', ok: false })
      }
    } catch {
      setPwMsg({ text: 'No se pudo conectar al servidor', ok: false })
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Configuración</h2>

      <Card className="max-w-md">
        <h3 className="text-sm font-medium text-white/45 mb-4">Cambiar contraseña</h3>
        <div className="space-y-3">
          <Input
            label="Contraseña actual"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="••••••"
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repetir nueva contraseña"
          />

          {pwMsg && (
            <div className={`text-sm text-center py-2 px-3 rounded-lg border ${
              pwMsg.ok
                ? 'bg-[#4ECDC4]/10 text-[#4ECDC4] border-[#4ECDC4]/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {pwMsg.text}
            </div>
          )}

          <Btn
            onClick={handleChangePassword}
            disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
          >
            {pwLoading ? 'Guardando...' : 'Cambiar contraseña'}
          </Btn>
        </div>
      </Card>
    </div>
  )
}
