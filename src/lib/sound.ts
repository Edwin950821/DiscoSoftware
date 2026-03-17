let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function playNotificationSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    const tone = (freq: number, start: number, dur: number, vol = 0.2) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(vol, start)
      gain.gain.setValueAtTime(vol, start + dur * 0.6)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.start(start)
      osc.stop(start + dur)
    }

    // Ding-dong-ding: 3 tonos con sustain más largo (~1.2s total)
    tone(784, now, 0.35, 0.22)          // Sol5 - ding
    tone(988, now + 0.3, 0.4, 0.2)      // Si5  - dong (más alto)
    tone(1175, now + 0.65, 0.55, 0.18)  // Re6  - ding final (más largo, fade suave)
  } catch { /* AudioContext no disponible */ }
}

export function playDespachadoSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.25, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.start(start)
      osc.stop(start + dur)
    }

    // 2 tonos cortos ascendentes (el sonido anterior de alerta)
    tone(830, now, 0.2)
    tone(1245, now + 0.15, 0.35)
  } catch { /* AudioContext no disponible */ }
}
