let permissionGranted = false

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') {
    permissionGranted = true
    return true
  }
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  permissionGranted = result === 'granted'
  return permissionGranted
}

export function sendBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (!permissionGranted && Notification.permission !== 'granted') return
  try {
    const notif = new Notification(title, {
      body,
      icon: '/assets/M04.png',
      tag: 'monastery-pedido-' + Date.now(),
    })
    if (onClick) {
      notif.onclick = () => {
        window.focus()
        onClick()
        notif.close()
      }
    }
    setTimeout(() => notif.close(), 8000)
  } catch { /* Notification not supported in this context */ }
}

/** Vibrar el dispositivo. Funciona en Android/Chrome sin permisos adicionales, incluso en modo silencio. */
export function vibrar(patron: number | number[] = [200, 100, 200]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(patron)
  } catch { /* No soportado */ }
}
