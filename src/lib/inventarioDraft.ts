import type { LineaInventario } from '../types'

export interface InventarioDraft {
  modoInv: 'nuevo' | 'editar'
  editInvId: string | null
  fechaInv: string
  lineasInv: LineaInventario[]
}

let draft: InventarioDraft | null = null

export const getInventarioDraft = (): InventarioDraft | null => draft

export const setInventarioDraft = (next: InventarioDraft): void => {
  draft = next
}

export const clearInventarioDraft = (): void => {
  draft = null
}
