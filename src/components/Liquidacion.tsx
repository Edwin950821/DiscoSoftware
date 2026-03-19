import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  Producto, Trabajador, Jornada, LiquidacionTrabajador, TipoPago,
  Inventario as InventarioType, LineaInventario, InventarioInput,
  Comparativo as ComparativoType, LineaComparativo, ComparativoInput,
  Pedido, CuentaMesa,
} from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { DateRangeFilter } from './ui/DateRangeFilter'
import { fmtFull, fmtCOP, calcularLiquidacion, calcularCuadreDia } from '../lib/utils'
import { API_PEDIDOS, apiFetch } from '../lib/config'

const TIPOS_PAGO: TipoPago[] = ['Datafono', 'QR', 'Nequi']
const COLORES_PAGO: Record<string, string> = { Efectivo: '#CDA52F', Datafono: '#A8E6CF', QR: '#4ECDC4', Nequi: '#FFE66D', Vales: '#C3B1E1' }
const COLORES_TRABAJADOR = ['#CDA52F', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C3B1E1', '#FF8FA3', '#98D8C8', '#FFB347']

function formatMoney(n: number): string {
  if (!n) return ''
  return n.toLocaleString('es-CO')
}

function MoneyInput({ value, onChange, label, placeholder, className = '' }: {
  value: number; onChange: (n: number) => void; label?: string; placeholder?: string; className?: string
}) {
  const [display, setDisplay] = useState(value ? formatMoney(value) : '')

  useEffect(() => {
    setDisplay(value ? formatMoney(value) : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = Number(raw) || 0
    setDisplay(num ? formatMoney(num) : '')
    onChange(num)
  }

  return (
    <div className={className}>
      {label && <label className="text-xs text-white/45 block mb-1">{label}</label>}
      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 left-2.5 text-white/25 text-xs">$</span>
        <input type="text" inputMode="numeric" value={display} onChange={handleChange} placeholder={placeholder || '$0'}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50" />
      </div>
    </div>
  )
}

function BackButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.05] transition-all duration-200 group">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform duration-200 group-hover:-translate-x-0.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Atras
      </button>
      <div className="w-px h-5 bg-white/[0.08]" />
      <span className="text-sm font-medium text-white/50">{title}</span>
    </div>
  )
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

type Tab = 'liquidacion' | 'semana' | 'inventario' | 'comparativo'

interface Props {
  jornadas: Jornada[]
  trabajadores: Trabajador[]
  productos: Producto[]
  inventarios: InventarioType[]
  comparativos: ComparativoType[]
  agregarTrabajador: (t: Omit<Trabajador, 'id'>) => Promise<void>
  eliminarTrabajador: (id: string) => Promise<void>
  guardarJornada: (input: { sesion: string; fecha: string; liquidaciones: LiquidacionTrabajador[] }) => Promise<void>
  eliminarJornada: (id: string) => Promise<void>
  guardarInventario: (inv: InventarioInput) => Promise<void>
  eliminarInventario: (id: string) => Promise<void>
  guardarComparativo: (comp: ComparativoInput) => Promise<void>
  eliminarComparativo: (id: string) => Promise<void>
  initialTab?: 'inventario' | 'comparativo'
}

export default function Liquidacion({
  jornadas, trabajadores, productos, inventarios, comparativos,
  agregarTrabajador, eliminarTrabajador,
  guardarJornada, eliminarJornada,
  guardarInventario, eliminarInventario,
  guardarComparativo, eliminarComparativo,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab || 'liquidacion')


  const [modoLiq, setModoLiq] = useState<'lista' | 'nueva'>('lista')
  const nextSesion = () => {
    const nums = jornadas.map(j => { const m = j.sesion.match(/(\d+)/); return m ? Number(m[1]) : 0 })
    return `SI-${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`
  }
  const [sesion, setSesion] = useState('')
  const [fechaLiq, setFechaLiq] = useState(new Date().toISOString().split('T')[0])
  const [liquidaciones, _setLiquidaciones] = useState<LiquidacionTrabajador[]>([])
  const [liqHistory, setLiqHistory] = useState<LiquidacionTrabajador[][]>([])
  const setLiquidaciones: typeof _setLiquidaciones = (val) => {
    _setLiquidaciones(prev => {
      setLiqHistory(h => [...h.slice(-30), prev])
      return typeof val === 'function' ? val(prev) : val
    })
  }
  const [activeTrabajadorId, setActiveTrabajadorId] = useState<string | null>(null)
  const [guardandoLiq, setGuardandoLiq] = useState(false)
  const [nuevoTrabajador, setNuevoTrabajador] = useState('')
  const [confirmDeleteJ, setConfirmDeleteJ] = useState<string | null>(null)
  const [modalExito, setModalExito] = useState<string | null>(null)


  const [modoInv, setModoInv] = useState<'lista' | 'nuevo'>('lista')
  const [fechaInv, setFechaInv] = useState(new Date().toISOString().split('T')[0])
  const [lineasInv, _setLineasInv] = useState<LineaInventario[]>([])
  const [invHistory, setInvHistory] = useState<LineaInventario[][]>([])
  const setLineasInv: typeof _setLineasInv = (val) => {
    _setLineasInv(prev => {
      setInvHistory(h => [...h.slice(-30), prev])
      return typeof val === 'function' ? val(prev) : val
    })
  }
  const [expandedInv, setExpandedInv] = useState<string | null>(null)
  const [confirmDeleteI, setConfirmDeleteI] = useState<string | null>(null)
  const [guardandoI, setGuardandoI] = useState(false)


  const [modoComp, setModoComp] = useState<'lista' | 'nuevo'>('lista')
  const [fechaComp, setFechaComp] = useState(new Date().toISOString().split('T')[0])
  const [lineasComp, setLineasComp] = useState<LineaComparativo[]>([])
  const [expandedComp, setExpandedComp] = useState<string | null>(null)
  const [confirmDeleteC, setConfirmDeleteC] = useState<string | null>(null)
  const [guardandoC, setGuardandoC] = useState(false)



  const undoLiq = useCallback(() => {
    setLiqHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      _setLiquidaciones(prev)
      return h.slice(0, -1)
    })
  }, [])

  const undoInv = useCallback(() => {
    setInvHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      _setLineasInv(prev)
      return h.slice(0, -1)
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        if (tab === 'liquidacion' && modoLiq === 'nueva') undoLiq()
        else if (tab === 'inventario' && modoInv === 'nuevo') undoInv()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tab, modoLiq, modoInv, undoLiq, undoInv])

  const fechasJornadas = new Set(jornadas.map(j => j.fecha))
  const fechaLiqDuplicada = fechasJornadas.has(fechaLiq)

  const toggleTrabajador = (id: string) => {
    setLiquidaciones(prev => {
      const idx = prev.findIndex(l => l.trabajadorId === id)
      if (idx >= 0) {
        const next = prev.filter(l => l.trabajadorId !== id)
        if (activeTrabajadorId === id) setActiveTrabajadorId(next.length > 0 ? next[0].trabajadorId : null)
        return next
      }
      const t = trabajadores.find(x => x.id === id)
      if (!t) return prev
      const lineasIniciales = productos.filter(p => p.activo).map(p => ({
        productoId: p.id, nombre: p.nombre, precioUnitario: p.precio, cantidad: 0, total: 0,
      }))
      const newLiq: LiquidacionTrabajador = {
        trabajadorId: t.id, nombre: t.nombre, color: t.color, avatar: t.avatar,
        lineas: lineasIniciales, transacciones: [], vales: [], cortesias: [], gastos: [],
        totalVenta: 0, efectivoEntregado: 0,
      }
      setActiveTrabajadorId(id)
      return [...prev, newLiq]
    })
  }

  const handleTabClick = (id: string) => {
    const isSelected = liquidaciones.some(l => l.trabajadorId === id)
    if (isSelected) {
      setActiveTrabajadorId(id)
    } else {
      toggleTrabajador(id)
    }
  }

  const updateLiquidacion = (trabajadorId: string, updater: (liq: LiquidacionTrabajador) => LiquidacionTrabajador) => {
    setLiquidaciones(prev => prev.map(l => {
      if (l.trabajadorId !== trabajadorId) return l
      return updater(l)
    }))
  }

  const updateEfectivoEntregado = (trabajadorId: string, valor: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, efectivoEntregado: valor }))
  }

  const updateTotalVentaManual = (trabajadorId: string, total: number) => {
    setLiquidaciones(prev => prev.map(l => l.trabajadorId === trabajadorId ? { ...l, totalVenta: total } : l))
  }

  const updateLineaCantidad = (trabajadorId: string, productoId: string, cantidad: number) => {
    if (cantidad < 0) return
    updateLiquidacion(trabajadorId, liq => {
      const lineas = liq.lineas.map(l =>
        l.productoId === productoId ? { ...l, cantidad, total: l.precioUnitario * cantidad } : l
      )
      const totalVenta = lineas.reduce((s, l) => s + l.total, 0)
      return { ...liq, lineas, totalVenta }
    })
  }


  const addTransaccion = (trabajadorId: string, tipo: TipoPago) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, transacciones: [...liq.transacciones, { tipo, concepto: '', monto: 0 }],
    }))
  }
  const updateTransaccion = (trabajadorId: string, idx: number, field: 'concepto' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, transacciones: liq.transacciones.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }))
  }
  const removeTransaccion = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, transacciones: liq.transacciones.filter((_, i) => i !== idx),
    }))
  }


  const addVale = (trabajadorId: string) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, vales: [...liq.vales, { tercero: '', monto: 0 }],
    }))
  }
  const updateVale = (trabajadorId: string, idx: number, field: 'tercero' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, vales: liq.vales.map((v, i) => i === idx ? { ...v, [field]: value } : v),
    }))
  }
  const removeVale = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, vales: liq.vales.filter((_, i) => i !== idx) }))
  }


  const addCortesia = (trabajadorId: string) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, cortesias: [...liq.cortesias, { concepto: '', monto: 0 }],
    }))
  }
  const updateCortesia = (trabajadorId: string, idx: number, field: 'concepto' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, cortesias: liq.cortesias.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }))
  }
  const removeCortesia = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, cortesias: liq.cortesias.filter((_, i) => i !== idx) }))
  }


  const addGasto = (trabajadorId: string) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, gastos: [...liq.gastos, { concepto: '', monto: 0 }],
    }))
  }
  const updateGasto = (trabajadorId: string, idx: number, field: 'concepto' | 'monto', value: string | number) => {
    updateLiquidacion(trabajadorId, liq => ({
      ...liq, gastos: liq.gastos.map((g, i) => i === idx ? { ...g, [field]: value } : g),
    }))
  }
  const removeGasto = (trabajadorId: string, idx: number) => {
    updateLiquidacion(trabajadorId, liq => ({ ...liq, gastos: liq.gastos.filter((_, i) => i !== idx) }))
  }

  const cuadreDia = calcularCuadreDia(liquidaciones)
  const todosConVentas = liquidaciones.length > 0 && liquidaciones.every(liq => liq.lineas.some(l => l.cantidad > 0) || liq.totalVenta > 0)
  const formValidoLiq = sesion.trim() !== '' && todosConVentas && !fechaLiqDuplicada

  const handleGuardarLiq = async () => {
    if (!formValidoLiq || guardandoLiq) return
    setGuardandoLiq(true)
    try {

      const liqsConEfectivo = liquidaciones.map(liq => {
        const c = calcularLiquidacion(liq)
        return { ...liq, efectivoEntregado: c.efectivo }
      })
      await guardarJornada({ sesion, fecha: fechaLiq, liquidaciones: liqsConEfectivo })
      setGuardandoLiq(false)
      setModalExito('Liquidacion guardada correctamente')
      setTimeout(() => {
        setModalExito(null)
        setSesion(''); setFechaLiq(new Date().toISOString().split('T')[0])
        setLiquidaciones([]); setActiveTrabajadorId(null); setModoLiq('lista')
      }, 2000)
    } catch {
      setGuardandoLiq(false)
      alert('Error al guardar. Revisa la consola.')
    }
  }

  const handleEliminarJ = async (id: string) => { await eliminarJornada(id); setConfirmDeleteJ(null) }

  const handleAgregarTrabajador = async () => {
    if (!nuevoTrabajador.trim()) return
    const color = COLORES_TRABAJADOR[trabajadores.length % COLORES_TRABAJADOR.length]
    const avatar = nuevoTrabajador.trim().slice(0, 2).toUpperCase()
    await agregarTrabajador({ nombre: nuevoTrabajador.trim(), color, avatar, activo: true })
    setNuevoTrabajador('')
  }


  const fechasInv = new Set(inventarios.map(i => i.fecha))
  const fechaInvDuplicada = fechasInv.has(fechaInv)

  const generarLineasInv = () => {
    const activos = productos.filter(p => p.activo)
    if (activos.length === 0) return []
    const ultimo = inventarios.length > 0 ? inventarios[0] : null
    return activos.map(p => {
      const ant = ultimo?.lineas.find(l => l.productoId === p.id)
      const invInicial = ant?.invFisico ?? 0
      const saldo = invInicial
      return { productoId: p.id, nombre: p.nombre, valorUnitario: p.precio, salidas: 0, invInicial, entradas: 0, invFisico: 0, saldo, total: saldo * p.precio }
    }).sort((a, b) => b.valorUnitario - a.valorUnitario)
  }

  const crearNuevoInv = () => { setLineasInv(generarLineasInv()); setFechaInv(new Date().toISOString().split('T')[0]); setModoInv('nuevo') }

  useEffect(() => {
    if (modoInv === 'nuevo' && lineasInv.length === 0 && productos.length > 0) setLineasInv(generarLineasInv())
  }, [modoInv, productos, lineasInv.length])

  const actualizarLineaInv = (idx: number, campo: 'salidas' | 'invInicial' | 'entradas' | 'invFisico', valor: string) => {
    setLineasInv(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [campo]: Number(valor) || 0 }

      updated.saldo = (updated.invInicial + updated.entradas) - updated.invFisico - updated.salidas
      updated.total = updated.saldo * updated.valorUnitario
      return updated
    }))
  }

  const reordenarLineasInv = (campo: string, dir: 'asc' | 'desc') => {
    setLineasInv(prev => [...prev].sort((a, b) => {
      const va = (a as any)[campo] ?? ''
      const vb = (b as any)[campo] ?? ''
      if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return dir === 'asc' ? va - vb : vb - va
    }))
  }

  const totalGeneralInv = lineasInv.reduce((s, l) => s + l.total, 0)

  const handleGuardarInv = async () => {
    if (fechaInvDuplicada || guardandoI) return
    setGuardandoI(true)
    try {
      await guardarInventario({ fecha: fechaInv, lineas: lineasInv, totalGeneral: totalGeneralInv })
      setGuardandoI(false)
      setModalExito('Inventario guardado correctamente')
      setTimeout(() => { setModalExito(null); setModoInv('lista') }, 2000)
    } catch { setGuardandoI(false); alert('Error al guardar inventario.') }
  }

  const handleEliminarI = async (id: string) => { await eliminarInventario(id); setConfirmDeleteI(null); setExpandedInv(null) }


  const fechasComp = new Set(comparativos.map(c => c.fecha))
  const fechaCompDuplicada = fechasComp.has(fechaComp)

  const generarLineasComp = () => {
    const activos = productos.filter(p => p.activo)
    if (activos.length === 0) return []

    return activos.map(p => ({
      productoId: p.id, nombre: p.nombre, conteo: 0, tiquets: 0, diferencia: 0
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  const crearNuevoComp = () => { setLineasComp(generarLineasComp()); setFechaComp(new Date().toISOString().split('T')[0]); setModoComp('nuevo') }

  const actualizarLineaComp = (idx: number, campo: 'conteo' | 'tiquets', valor: string) => {
    setLineasComp(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [campo]: Number(valor) || 0 }
      updated.diferencia = updated.tiquets - updated.conteo
      return updated
    }))
  }

  const totalConteoComp = lineasComp.reduce((s, l) => s + l.conteo, 0)
  const totalTiquetsComp = lineasComp.reduce((s, l) => s + l.tiquets, 0)

  const handleGuardarComp = async () => {
    if (fechaCompDuplicada || guardandoC) return
    setGuardandoC(true)
    try {
      await guardarComparativo({ fecha: fechaComp, lineas: lineasComp, totalConteo: totalConteoComp, totalTiquets: totalTiquetsComp })
      setGuardandoC(false)
      setModalExito('Comparativo guardado correctamente')
      setTimeout(() => { setModalExito(null); setModoComp('lista') }, 2000)
    } catch { setGuardandoC(false); alert('Error al guardar comparativo.') }
  }

  const handleEliminarC = async (id: string) => { await eliminarComparativo(id); setConfirmDeleteC(null); setExpandedComp(null) }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'liquidacion', label: 'Liquidacion' },
    { key: 'semana', label: 'Liq. Semana' },
    { key: 'inventario', label: 'Inventario' },
    { key: 'comparativo', label: 'Comparativo' },
  ]

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Liquidaciones</h2>

      <div className="flex gap-1 mb-4 sm:mb-6 bg-white/5 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm transition-all whitespace-nowrap flex-1 sm:flex-none ${tab === t.key ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'liquidacion' && (
        modoLiq === 'nueva' ? (
          <LiquidacionNueva
            trabajadores={trabajadores}
            liquidaciones={liquidaciones} activeTrabajadorId={activeTrabajadorId}
            sesion={sesion} fecha={fechaLiq} fechaDuplicada={fechaLiqDuplicada}
            guardando={guardandoLiq} formValido={formValidoLiq}
            cuadreDia={cuadreDia}
            nuevoTrabajador={nuevoTrabajador} setNuevoTrabajador={setNuevoTrabajador}
            handleAgregarTrabajador={handleAgregarTrabajador}
            setSesion={setSesion} setFecha={setFechaLiq}
            handleTabClick={handleTabClick}
            updateEfectivoEntregado={updateEfectivoEntregado} updateTotalVentaManual={updateTotalVentaManual}
            updateLineaCantidad={updateLineaCantidad}
            updateTransaccion={updateTransaccion}
            addTransaccion={addTransaccion} removeTransaccion={removeTransaccion}
            updateVale={updateVale} addVale={addVale} removeVale={removeVale}
            updateCortesia={updateCortesia} addCortesia={addCortesia} removeCortesia={removeCortesia}
            updateGasto={updateGasto} addGasto={addGasto} removeGasto={removeGasto}
            updateLiqDirect={(tid: string, data: Partial<LiquidacionTrabajador>) => {
              setLiquidaciones(prev => prev.map(l => l.trabajadorId !== tid ? l : { ...l, ...data }))
            }}
            handleGuardar={handleGuardarLiq}
            onBack={() => setModoLiq('lista')}
          />
        ) : (
          <LiquidacionLista jornadas={jornadas} confirmDelete={confirmDeleteJ}
            setConfirmDelete={setConfirmDeleteJ} handleEliminar={handleEliminarJ}
            onNueva={() => { setSesion(nextSesion()); setModoLiq('nueva') }} />
        )
      )}

      {tab === 'semana' && <LiquidacionSemana jornadas={jornadas} inventarios={inventarios} />}

      {tab === 'inventario' && (
        modoInv === 'nuevo' ? (
          <InventarioNuevo fecha={fechaInv} setFecha={setFechaInv} lineas={lineasInv} totalGeneral={totalGeneralInv}
            actualizarLinea={actualizarLineaInv} reordenarLineas={reordenarLineasInv} guardando={guardandoI} fechaDuplicada={fechaInvDuplicada}
            handleGuardar={handleGuardarInv} onBack={() => setModoInv('lista')} />
        ) : (
          <InventarioLista inventarios={inventarios} expandedId={expandedInv} setExpandedId={setExpandedInv}
            confirmDelete={confirmDeleteI} setConfirmDelete={setConfirmDeleteI}
            handleEliminar={handleEliminarI} onNuevo={crearNuevoInv} productosLoaded={productos.length > 0} />
        )
      )}

      {tab === 'comparativo' && (
        modoComp === 'nuevo' ? (
          <ComparativoNuevo fecha={fechaComp} setFecha={setFechaComp} lineas={lineasComp}
            totalConteo={totalConteoComp} totalTiquets={totalTiquetsComp}
            actualizarLinea={actualizarLineaComp} guardando={guardandoC} fechaDuplicada={fechaCompDuplicada}
            handleGuardar={handleGuardarComp} onBack={() => setModoComp('lista')} />
        ) : (
          <ComparativoLista comparativos={comparativos} expandedId={expandedComp} setExpandedId={setExpandedComp}
            confirmDelete={confirmDeleteC} setConfirmDelete={setConfirmDeleteC}
            handleEliminar={handleEliminarC} onNuevo={crearNuevoComp} productosLoaded={productos.length > 0} />
        )
      )}

      {modalExito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#CDA52F]/30 rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4"
            style={{ boxShadow: '0 0 40px rgba(205,165,47,0.15)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDA52F]/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CDA52F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-lg font-bold text-white mb-1">{modalExito}</p>
            <p className="text-sm text-white/40">Datos almacenados correctamente</p>
          </div>
        </div>
      )}
    </div>
  )
}



function LiquidacionLista({ jornadas, confirmDelete, setConfirmDelete, handleEliminar, onNueva }: {
  jornadas: Jornada[]; confirmDelete: string | null; setConfirmDelete: (id: string | null) => void
  handleEliminar: (id: string) => void; onNueva: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const filtradas = jornadas.filter(j => {
    if (desde && j.fecha < desde) return false
    if (hasta && j.fecha > hasta) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={jornadas.length} filtrados={filtradas.length} />
        <Btn onClick={onNueva} className="w-full sm:w-auto shrink-0">+ Nueva Liquidacion</Btn>
      </div>
      {filtradas.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">
          {jornadas.length === 0 ? 'No hay liquidaciones registradas.' : 'No hay liquidaciones en el periodo seleccionado.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map(j => {
            const expanded = expandedId === j.id
            const esperado = j.totalVendido - j.cortesias - j.gastos
            return (
              <Card key={j.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : j.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#CDA52F]/15 text-[#CDA52F] shrink-0">{j.sesion}</span>
                    <span className="text-xs sm:text-sm text-white/45 truncate">{j.fecha}</span>
                    <span className="text-[10px] sm:text-xs text-white/30 shrink-0">{j.liquidaciones?.length || 0} trab.</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 ml-auto">
                    <span className="text-xs sm:text-sm text-[#FFE66D] font-medium">{fmtCOP(j.totalVendido)}</span>
                    <span className={`text-xs sm:text-sm font-bold ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtCOP(j.saldo)}</span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-white/[0.07]" onClick={e => e.stopPropagation()}>
                    <div className="space-y-3 mb-4">
                      {j.liquidaciones?.map((liq, i) => {
                        const c = calcularLiquidacion(liq)
                        return (
                          <div key={i} className="p-3 rounded-lg bg-white/[0.03]">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ backgroundColor: liq.color + '33', color: liq.color }}>{liq.avatar}</div>
                              <span className="text-xs text-white/70 flex-1">{liq.nombre}</span>
                              <span className="text-xs text-[#FFE66D] font-bold">{fmtFull(c.totalVenta)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-9">
                              {liq.efectivoEntregado > 0 && (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#CDA52F22', color: '#CDA52F' }}>
                                  Efectivo: {fmtFull(liq.efectivoEntregado)}
                                </span>
                              )}
                              {c.totalDatafono > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#A8E6CF22', color: '#A8E6CF' }}>Datafono: {fmtFull(c.totalDatafono)}</span>}
                              {c.totalQR > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#4ECDC422', color: '#4ECDC4' }}>QR: {fmtFull(c.totalQR)}</span>}
                              {c.totalNequi > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FFE66D22', color: '#FFE66D' }}>Nequi: {fmtFull(c.totalNequi)}</span>}
                              {c.totalVales > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#C3B1E122', color: '#C3B1E1' }}>Vales: {fmtFull(c.totalVales)}</span>}
                              {c.totalCortesias > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-white/40">Cort: {fmtFull(c.totalCortesias)}</span>}
                              {c.totalGastos > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-white/40">Gast: {fmtFull(c.totalGastos)}</span>}
                            </div>
                            <div className="ml-9 mt-1.5 flex justify-between text-xs">
                              <span className="text-white/30 font-medium">Saldo: <span className={`font-bold ${c.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(c.saldo)}</span></span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><p className="text-white/30 mb-0.5">Vendido</p><p className="text-[#FFE66D] font-bold">{fmtFull(j.totalVendido)}</p></div>
                        <div><p className="text-white/30 mb-0.5">Esperado</p><p className="text-white font-medium">{fmtFull(esperado)}</p></div>
                        <div><p className="text-white/30 mb-0.5">Recibido</p><p className="text-[#4ECDC4] font-bold">{fmtFull(j.totalRecibido)}</p></div>
                        <div><p className="text-white/30 mb-0.5">Saldo</p><p className={`font-bold text-base ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(j.saldo)}</p></div>
                      </div>
                    </div>

                    <div className="flex justify-end mt-3">
                      {confirmDelete === j.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#FF5050]">Seguro?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(j.id)}>Si, eliminar</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(j.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar</Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



function LiquidacionNueva({
  trabajadores, liquidaciones, activeTrabajadorId,
  sesion, fecha, fechaDuplicada, guardando, formValido, cuadreDia,
  nuevoTrabajador, setNuevoTrabajador, handleAgregarTrabajador,
  setSesion, setFecha, handleTabClick,
  updateEfectivoEntregado, updateTotalVentaManual,
  updateLineaCantidad,
  updateTransaccion, addTransaccion, removeTransaccion,
  updateVale, addVale, removeVale,
  updateCortesia, addCortesia, removeCortesia,
  updateGasto, addGasto, removeGasto,
  updateLiqDirect,
  handleGuardar, onBack,
}: {
  trabajadores: Trabajador[]
  liquidaciones: LiquidacionTrabajador[]; activeTrabajadorId: string | null
  sesion: string; fecha: string; fechaDuplicada: boolean; guardando: boolean; formValido: boolean
  cuadreDia: ReturnType<typeof calcularCuadreDia>
  nuevoTrabajador: string; setNuevoTrabajador: (v: string) => void; handleAgregarTrabajador: () => void
  setSesion: (v: string) => void; setFecha: (v: string) => void
  handleTabClick: (id: string) => void
  updateEfectivoEntregado: (tid: string, val: number) => void
  updateTotalVentaManual: (tid: string, total: number) => void
  updateLineaCantidad: (tid: string, productoId: string, cantidad: number) => void
  updateTransaccion: (tid: string, idx: number, field: 'concepto' | 'monto', value: string | number) => void
  addTransaccion: (tid: string, tipo: TipoPago) => void
  removeTransaccion: (tid: string, idx: number) => void
  updateVale: (tid: string, idx: number, field: 'tercero' | 'monto', value: string | number) => void
  addVale: (tid: string) => void
  removeVale: (tid: string, idx: number) => void
  updateCortesia: (tid: string, idx: number, field: 'concepto' | 'monto', value: string | number) => void
  addCortesia: (tid: string) => void
  removeCortesia: (tid: string, idx: number) => void
  updateGasto: (tid: string, idx: number, field: 'concepto' | 'monto', value: string | number) => void
  addGasto: (tid: string) => void
  removeGasto: (tid: string, idx: number) => void
  updateLiqDirect: (tid: string, data: Partial<LiquidacionTrabajador>) => void
  handleGuardar: () => void; onBack: () => void
}) {
  const activeLiq = liquidaciones.find(l => l.trabajadorId === activeTrabajadorId)


  const [pedidosHoy, setPedidosHoy] = useState<Pedido[]>([])
  const [cuentasHoy, setCuentasHoy] = useState<CuentaMesa[]>([])
  const [ticketsExpanded, setTicketsExpanded] = useState(true)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)

  const fetchPedidosHoy = useCallback(async () => {
    try {
      const [resPedidos, resCuentas] = await Promise.all([
        apiFetch(`${API_PEDIDOS}/hoy`),
        apiFetch(`${API_PEDIDOS}/cuentas/hoy`),
      ])
      if (resPedidos.ok) {
        const data = await resPedidos.json()
        setPedidosHoy(data.map((p: any) => ({ ...p, id: String(p.id) })))
      }
      if (resCuentas.ok) {
        const data = await resCuentas.json()
        setCuentasHoy(data.map((c: any) => ({
          ...c,
          id: String(c.id),
          pedidos: (c.pedidos || []).map((p: any) => ({ ...p, id: String(p.id) })),
        })))
      }
    } catch (e) { console.error('Error cargando pedidos para liquidacion:', e) }
  }, [])

  useEffect(() => { fetchPedidosHoy() }, [fetchPedidosHoy])

  const pedidosTrabajador = useMemo(() => {
    if (!activeTrabajadorId) return []
    return pedidosHoy.filter(p => p.meseroId === activeTrabajadorId)
  }, [pedidosHoy, activeTrabajadorId])

  const cuentasTrabajador = useMemo(() => {
    if (!activeTrabajadorId) return []
    return cuentasHoy.filter(c => c.meseroId === activeTrabajadorId)
  }, [cuentasHoy, activeTrabajadorId])

  const totalTicketsTrabajador = useMemo(() => pedidosTrabajador.reduce((s, p) => s + p.total, 0), [pedidosTrabajador])


  useEffect(() => { setExpandedTicket(null) }, [activeTrabajadorId])

  return (
    <div>
      <BackButton onClick={onBack} title="Nueva Liquidacion" />

      <div className="flex gap-2 sm:gap-3 items-end mb-2">
        <Input label="Sesion" value={sesion} onChange={e => setSesion(e.target.value)} placeholder="SI-7" className="w-24 sm:w-32" />
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-36 sm:w-44" />
      </div>
      {fechaDuplicada && <p className="text-xs text-[#FF5050] mb-3">Ya existe una liquidacion para esta fecha.</p>}

      <div className="flex gap-2 flex-wrap items-center mb-5">
        {trabajadores.filter(t => t.activo).map(t => {
          const sel = liquidaciones.some(l => l.trabajadorId === t.id)
          const isActive = activeTrabajadorId === t.id
          return (
            <button key={t.id} onClick={() => handleTabClick(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs ${isActive && sel ? 'ring-2 ring-offset-1 ring-offset-[#0A0A0A]' : ''}`}
              style={{
                border: `2px solid ${sel ? t.color : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: sel ? t.color + '20' : 'transparent',
                color: sel ? t.color : 'rgba(255,255,255,0.5)',
                ...(sel ? { '--tw-ring-color': t.color } as React.CSSProperties : {}),
              }}>
              <span className="font-bold">{t.avatar}</span>
              <span>{t.nombre}</span>
              {sel && (() => { const liq = liquidaciones.find(l => l.trabajadorId === t.id); if (!liq) return null; const c = calcularLiquidacion(liq); return c.totalVenta > 0 ? <span className="text-[10px] opacity-70">{fmtCOP(c.totalVenta)}</span> : null })()}
            </button>
          )
        })}
        <div className="flex gap-1 items-center">
          <input type="text" placeholder="+ Trabajador" value={nuevoTrabajador} onChange={e => setNuevoTrabajador(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregarTrabajador()}
            className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 w-28" />
          {nuevoTrabajador.trim() && <button onClick={handleAgregarTrabajador} className="text-[#CDA52F] text-sm font-bold hover:text-[#CDA52F]/70">+</button>}
        </div>
      </div>

      {activeLiq ? (
        <div className="flex flex-col lg:flex-row gap-4">

          {liquidaciones.length > 0 && (
            <div className="lg:hidden flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              <div className="flex gap-2 items-center shrink-0 px-3 py-2 rounded-lg border border-[#FFE66D]/15 bg-[#FFE66D]/[0.03]">
                <span className="text-[10px] text-white/40">Vendido</span>
                <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(cuadreDia.totalVendido)}</span>
              </div>
              <div className="flex gap-2 items-center shrink-0 px-3 py-2 rounded-lg border border-[#4ECDC4]/15 bg-[#4ECDC4]/[0.03]">
                <span className="text-[10px] text-white/40">Recibido</span>
                <span className="text-xs text-[#4ECDC4] font-bold">{fmtCOP(cuadreDia.totalRecibido)}</span>
              </div>
              <div className={`flex gap-2 items-center shrink-0 px-3 py-2 rounded-lg border ${cuadreDia.saldo >= 0 ? 'border-[#4ECDC4]/15 bg-[#4ECDC4]/[0.03]' : 'border-[#FF5050]/15 bg-[#FF5050]/[0.03]'}`}>
                <span className="text-[10px] text-white/40">Saldo</span>
                <span className={`text-xs font-bold ${cuadreDia.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(cuadreDia.saldo)}</span>
              </div>
            </div>
          )}

          <div className="hidden lg:block w-[220px] shrink-0 space-y-2">
            {liquidaciones.map(liq => {
              const c = calcularLiquidacion(liq)
              const isActive = liq.trabajadorId === activeTrabajadorId
              return (
                <button key={liq.trabajadorId} onClick={() => handleTabClick(liq.trabajadorId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${isActive ? 'border-white/15 bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: liq.color + '33', color: liq.color }}>{liq.avatar}</div>
                    <span className="text-xs text-white/80 font-medium flex-1 truncate">{liq.nombre}</span>
                  </div>
                  <div className="ml-9 flex items-center justify-between">
                    <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(c.totalVenta)}</span>
                    {c.totalVenta > 0 && (
                      <span className={`text-[10px] font-bold ${c.saldo === 0 ? 'text-[#4ECDC4]' : c.saldo > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                        {c.saldo === 0 ? '\u2713' : fmtCOP(c.saldo)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}

            {liquidaciones.length > 0 && (
              <div className="mt-4 p-3 rounded-xl border border-[#FFE66D]/15 bg-[#FFE66D]/[0.03]">
                <p className="text-[10px] text-white/40 font-medium mb-2 uppercase tracking-wider">Cuadre del Dia</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Vendido</span><span className="text-[#FFE66D] font-bold">{fmtCOP(cuadreDia.totalVendido)}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Recibido</span><span className="text-[#4ECDC4] font-bold">{fmtCOP(cuadreDia.totalRecibido)}</span></div>
                  <div className="border-t border-white/5 my-1" />
                  <div className="flex justify-between font-bold">
                    <span className="text-white/60">Saldo</span>
                    <span className={cuadreDia.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>{fmtFull(cuadreDia.saldo)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: activeLiq.color + '33', color: activeLiq.color }}>{activeLiq.avatar}</div>
              <span className="text-sm font-medium">{activeLiq.nombre}</span>
              <span className="text-xs text-white/30 ml-auto">Liquidacion Diaria</span>
            </div>

            {pedidosTrabajador.length > 0 && (
              <Card className="mb-4 border-[#D4AF37]/10">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setTicketsExpanded(!ticketsExpanded)}>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <p className="text-xs text-[#D4AF37] font-medium uppercase tracking-wider">
                      Tickets del dia ({pedidosTrabajador.length})
                    </p>
                    <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(totalTicketsTrabajador)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); fetchPedidosHoy() }}
                      className="p-1 rounded-md hover:bg-white/5 text-white/30 hover:text-white/50 transition-colors" title="Actualizar">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    </button>
                    <Chevron expanded={ticketsExpanded} />
                  </div>
                </div>

                {ticketsExpanded && (
                  <div className="mt-3 space-y-2">
                    {cuentasTrabajador.length > 0 && cuentasTrabajador.map(cuenta => {
                      const pedidosCuenta = pedidosTrabajador.filter(p =>
                        cuenta.pedidos.some(cp => cp.id === p.id)
                      )
                      if (pedidosCuenta.length === 0) return null
                      return (
                        <div key={`cuenta-${cuenta.id}`} className="rounded-lg bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white/60">{cuenta.mesaNombre}</span>
                              <span className="text-[10px] text-white/30">— {cuenta.nombreCliente}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                cuenta.estado === 'PAGADA' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FFE66D]/15 text-[#FFE66D]'
                              }`}>{cuenta.estado}</span>
                            </div>
                            <span className="text-xs font-bold text-[#FFE66D]">{fmtCOP(cuenta.total)}</span>
                          </div>
                          <div className="divide-y divide-white/[0.03]">
                            {pedidosCuenta.map(p => {
                              const isExpanded = expandedTicket === p.id
                              return (
                                <div key={p.id}>
                                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                    onClick={() => setExpandedTicket(isExpanded ? null : p.id)}>
                                    <span className="text-[10px] font-bold text-[#CDA52F]">#{p.ticketDia}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                      p.estado === 'PENDIENTE' ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                                      : p.estado === 'DESPACHADO' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                                      : p.estado === 'CANCELADO' ? 'bg-[#FF5050]/15 text-[#FF5050]'
                                      : 'bg-white/5 text-white/30'
                                    }`}>{p.estado}</span>
                                    <span className="text-[10px] text-white/25">{p.lineas.length} items</span>
                                    <span className="text-[10px] text-white/20 ml-auto">
                                      {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-xs text-white/60 font-medium">{fmtCOP(p.total)}</span>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                      className={`text-white/20 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                      <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                  </div>
                                  {isExpanded && (
                                    <div className="px-3 pb-2 space-y-0.5">
                                      {p.lineas.map(l => (
                                        <div key={l.id} className="flex items-center gap-2 py-0.5">
                                          <span className="w-5 h-5 rounded bg-[#CDA52F]/10 text-[#CDA52F] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                          <span className="text-[11px] text-white/50 flex-1">{l.nombre}</span>
                                          <span className="text-[10px] text-white/20">{fmtCOP(l.precioUnitario)} c/u</span>
                                          <span className="text-[11px] text-white/50 font-medium w-16 text-right">{fmtCOP(l.total)}</span>
                                        </div>
                                      ))}
                                      {p.nota && <p className="text-[10px] text-white/25 italic mt-1">Nota: {p.nota}</p>}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {(() => {
                      const pedidosSinCuenta = pedidosTrabajador.filter(p =>
                        !cuentasTrabajador.some(c => c.pedidos.some(cp => cp.id === p.id))
                      )
                      if (pedidosSinCuenta.length === 0) return null
                      return pedidosSinCuenta.map(p => {
                        const isExpanded = expandedTicket === p.id
                        return (
                          <div key={p.id} className="rounded-lg bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                              onClick={() => setExpandedTicket(isExpanded ? null : p.id)}>
                              <span className="text-[10px] font-bold text-[#CDA52F]">#{p.ticketDia}</span>
                              <span className="text-[10px] text-white/40">{p.mesaNombre}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                p.estado === 'PENDIENTE' ? 'bg-[#FFE66D]/15 text-[#FFE66D]'
                                : p.estado === 'DESPACHADO' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                                : p.estado === 'CANCELADO' ? 'bg-[#FF5050]/15 text-[#FF5050]'
                                : 'bg-white/5 text-white/30'
                              }`}>{p.estado}</span>
                              <span className="text-[10px] text-white/20 ml-auto">
                                {new Date(p.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-xs text-white/60 font-medium">{fmtCOP(p.total)}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                className={`text-white/20 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-2 space-y-0.5">
                                {p.lineas.map(l => (
                                  <div key={l.id} className="flex items-center gap-2 py-0.5">
                                    <span className="w-5 h-5 rounded bg-[#CDA52F]/10 text-[#CDA52F] text-[9px] font-bold flex items-center justify-center shrink-0">{l.cantidad}</span>
                                    <span className="text-[11px] text-white/50 flex-1">{l.nombre}</span>
                                    <span className="text-[10px] text-white/20">{fmtCOP(l.precioUnitario)} c/u</span>
                                    <span className="text-[11px] text-white/50 font-medium w-16 text-right">{fmtCOP(l.total)}</span>
                                  </div>
                                ))}
                                {p.nota && <p className="text-[10px] text-white/25 italic mt-1">Nota: {p.nota}</p>}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </Card>
            )}

            <Card className="mb-4">
              <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Productos — Cantidades Vendidas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/45 text-xs font-medium py-2 pr-2">Producto</th>
                      <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-16">Precio</th>
                      <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-32">Cantidad</th>
                      <th className="text-right text-[#FFE66D] text-xs font-medium py-2 pl-1 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLiq.lineas.map(l => (
                      <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 pr-2 text-white/80 text-xs">{l.nombre}</td>
                        <td className="py-2 px-1 text-center text-xs text-white/45">{fmtCOP(l.precioUnitario)}</td>
                        <td className="py-1 px-1">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateLineaCantidad(activeLiq.trabajadorId, l.productoId, l.cantidad - 1)}
                              className="w-7 h-7 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white flex items-center justify-center text-sm font-bold">-</button>
                            <input type="number" min={0} value={l.cantidad || ''}
                              onChange={e => updateLineaCantidad(activeLiq.trabajadorId, l.productoId, Number(e.target.value) || 0)}
                              className="bg-white/5 border border-white/10 rounded px-1 py-1 text-xs text-white w-12 text-center focus:outline-none focus:border-[#CDA52F]/50" />
                            <button onClick={() => updateLineaCantidad(activeLiq.trabajadorId, l.productoId, l.cantidad + 1)}
                              className="w-7 h-7 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white flex items-center justify-center text-sm font-bold">+</button>
                          </div>
                        </td>
                        <td className="py-2 pl-1 text-right text-xs font-bold text-white/30">{l.total > 0 ? <span className="text-[#FFE66D]">{fmtCOP(l.total)}</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {activeLiq.lineas.some(l => l.total > 0) && (
                    <tfoot>
                      <tr className="border-t-2 border-white/10">
                        <td colSpan={3} className="py-3 text-right text-sm font-bold text-white/70">Total Vendido:</td>
                        <td className="py-3 pl-1 text-right text-sm font-bold text-[#FFE66D]">{fmtFull(activeLiq.lineas.reduce((s, l) => s + l.total, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {(() => {
              const totalVenta = activeLiq.lineas.reduce((s, l) => s + l.total, 0) || activeLiq.totalVenta
              const esBarra = activeLiq.nombre.toLowerCase() === 'barra'
              return (
                <>
                  <Card className="mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#CDA52F' }}>Efectivo s/n Liquidacion</span>
                      <span className="text-lg font-bold" style={{ color: '#CDA52F' }}>{fmtFull(totalVenta)}</span>
                    </div>
                  </Card>
                  {esBarra && (
                    <Card className="mb-4">
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-medium uppercase tracking-wider text-white/60 shrink-0">Efectivo Entregado</span>
                        <MoneyInput value={activeLiq.efectivoEntregado}
                          onChange={v => updateEfectivoEntregado(activeLiq.trabajadorId, v)} placeholder="$0" />
                      </div>
                    </Card>
                  )}
                </>
              )
            })()}

            {TIPOS_PAGO.map(tipo => {
              const entries = activeLiq.transacciones.map((t, idx) => ({ ...t, idx })).filter(t => t.tipo === tipo)
              const totalTipo = entries.reduce((s, t) => s + t.monto, 0)
              const color = COLORES_PAGO[tipo] || '#4ECDC4'
              return (
                <Card key={tipo} className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color }}>{tipo}</p>
                    <button onClick={() => addTransaccion(activeLiq.trabajadorId, tipo)}
                      className="text-xs px-2 py-1 rounded hover:opacity-80 transition"
                      style={{ backgroundColor: color + '15', color }}>+ Agregar</button>
                  </div>
                  {entries.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin {tipo.toLowerCase()}</p>}
                  <div className="space-y-2">
                    {entries.map(t => (
                      <div key={t.idx} className="flex items-center gap-2">
                        <input value={t.concepto || ''} onChange={e => updateTransaccion(activeLiq.trabajadorId, t.idx, 'concepto', e.target.value)}
                          placeholder="Concepto"
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-32" />
                        <MoneyInput value={t.monto} onChange={v => updateTransaccion(activeLiq.trabajadorId, t.idx, 'monto', v)} placeholder="$0" />
                        <button onClick={() => removeTransaccion(activeLiq.trabajadorId, t.idx)}
                          className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                      </div>
                    ))}
                  </div>
                  {entries.length > 0 && (
                    <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                      <span className="text-white/45">Total {tipo}</span>
                      <span className="font-bold" style={{ color }}>{fmtFull(totalTipo)}</span>
                    </div>
                  )}
                </Card>
              )
            })}

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#C3B1E1' }}>Vales</p>
                <button onClick={() => addVale(activeLiq.trabajadorId)}
                  className="text-xs px-2 py-1 rounded bg-[#C3B1E1]/10 text-[#C3B1E1] hover:bg-[#C3B1E1]/20 transition">+ Agregar</button>
              </div>
              {activeLiq.vales.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin vales</p>}
              <div className="space-y-2">
                {activeLiq.vales.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={v.tercero} onChange={e => updateVale(activeLiq.trabajadorId, i, 'tercero', e.target.value)}
                      placeholder="Nombre 3ero"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#C3B1E1]/50 w-32" />
                    <MoneyInput value={v.monto} onChange={val => updateVale(activeLiq.trabajadorId, i, 'monto', val)} placeholder="$0" />
                    <button onClick={() => removeVale(activeLiq.trabajadorId, i)}
                      className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                  </div>
                ))}
              </div>
              {activeLiq.vales.length > 0 && (
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-white/45">Total Vales</span>
                  <span className="text-[#C3B1E1] font-bold">{fmtFull(activeLiq.vales.reduce((s, v) => s + v.monto, 0))}</span>
                </div>
              )}
            </Card>

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">Cortesias</p>
                <button onClick={() => addCortesia(activeLiq.trabajadorId)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:bg-white/10 transition">+ Agregar</button>
              </div>
              {activeLiq.cortesias.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin cortesias</p>}
              <div className="space-y-2">
                {activeLiq.cortesias.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={c.concepto} onChange={e => updateCortesia(activeLiq.trabajadorId, i, 'concepto', e.target.value)}
                      placeholder="Concepto"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-32" />
                    <MoneyInput value={c.monto} onChange={val => updateCortesia(activeLiq.trabajadorId, i, 'monto', val)} placeholder="$0" />
                    <button onClick={() => removeCortesia(activeLiq.trabajadorId, i)}
                      className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                  </div>
                ))}
              </div>
              {activeLiq.cortesias.length > 0 && (
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-white/45">Total Cortesias</span>
                  <span className="text-white/60 font-bold">{fmtFull(activeLiq.cortesias.reduce((s, c) => s + c.monto, 0))}</span>
                </div>
              )}
            </Card>

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">Gastos</p>
                <button onClick={() => addGasto(activeLiq.trabajadorId)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:bg-white/10 transition">+ Agregar</button>
              </div>
              {activeLiq.gastos.length === 0 && <p className="text-xs text-white/20 text-center py-2">Sin gastos</p>}
              <div className="space-y-2">
                {activeLiq.gastos.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={g.concepto} onChange={e => updateGasto(activeLiq.trabajadorId, i, 'concepto', e.target.value)}
                      placeholder="Concepto"
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-32" />
                    <MoneyInput value={g.monto} onChange={val => updateGasto(activeLiq.trabajadorId, i, 'monto', val)} placeholder="$0" />
                    <button onClick={() => removeGasto(activeLiq.trabajadorId, i)}
                      className="text-[#FF5050]/60 hover:text-[#FF5050] text-lg leading-none shrink-0">&times;</button>
                  </div>
                ))}
              </div>
              {activeLiq.gastos.length > 0 && (
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-white/45">Total Gastos</span>
                  <span className="text-white/60 font-bold">{fmtFull(activeLiq.gastos.reduce((s, g) => s + g.monto, 0))}</span>
                </div>
              )}
            </Card>

            {(() => {
              const c = calcularLiquidacion(activeLiq)
              return (
                <Card className="mb-4 border-[#CDA52F]/15">
                  <p className="text-xs text-white/40 font-medium mb-3 uppercase tracking-wider">Cuadre — {activeLiq.nombre}</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-white/45">Total Venta</span><span className="text-[#FFE66D] font-bold">{fmtFull(c.totalVenta)}</span></div>
                    {c.totalDatafono > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Datafono</span><span className="text-white/60">-{fmtFull(c.totalDatafono)}</span></div>}
                    {c.totalQR > 0 && <div className="flex justify-between"><span className="text-white/45">(-) QR</span><span className="text-white/60">-{fmtFull(c.totalQR)}</span></div>}
                    {c.totalNequi > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Nequi</span><span className="text-white/60">-{fmtFull(c.totalNequi)}</span></div>}
                    {c.totalVales > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Vales</span><span className="text-white/60">-{fmtFull(c.totalVales)}</span></div>}
                    {c.totalCortesias > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Cortesias</span><span className="text-white/60">-{fmtFull(c.totalCortesias)}</span></div>}
                    {c.totalGastos > 0 && <div className="flex justify-between"><span className="text-white/45">(-) Gastos</span><span className="text-white/60">-{fmtFull(c.totalGastos)}</span></div>}
                    <div className="border-t border-white/10 my-1" />
                    <div className={`flex justify-between text-lg font-bold mt-1 px-3 py-2 rounded-lg ${c.efectivo >= 0 ? 'bg-[#CDA52F]/10' : 'bg-[#FF5050]/10'}`}>
                      <span className={c.efectivo >= 0 ? 'text-[#CDA52F]' : 'text-[#FF5050]'}>EFECTIVO</span>
                      <span className={c.efectivo >= 0 ? 'text-[#CDA52F]' : 'text-[#FF5050]'}>{fmtFull(c.efectivo)}</span>
                    </div>
                  </div>
                </Card>
              )
            })()}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12 text-white/30 text-sm">Selecciona al menos un trabajador para comenzar</Card>
      )}

      {liquidaciones.length > 0 && (
        <div className="mt-4">
          {!formValido && !guardando && (
            <p className="text-xs text-[#FF5050] mb-2 text-right">
              {sesion.trim() === '' ? 'Falta el ID de sesion' : fechaDuplicada ? 'Ya existe una liquidacion para esta fecha' : ''}
            </p>
          )}
          <div className="flex justify-end">
            <Btn onClick={handleGuardar} disabled={!formValido || guardando}>{guardando ? 'Guardando...' : 'Guardar Liquidacion'}</Btn>
          </div>
        </div>
      )}
    </div>
  )
}



function InventarioNuevo({ fecha, setFecha, lineas, totalGeneral, actualizarLinea, reordenarLineas, guardando, fechaDuplicada, handleGuardar, onBack }: {
  fecha: string; setFecha: (v: string) => void; lineas: LineaInventario[]; totalGeneral: number
  actualizarLinea: (idx: number, campo: 'salidas' | 'invInicial' | 'entradas' | 'invFisico', valor: string) => void
  reordenarLineas: (campo: string, dir: 'asc' | 'desc') => void
  guardando: boolean; fechaDuplicada: boolean; handleGuardar: () => void; onBack: () => void
}) {
  const [sortCol, setSortCol] = useState<string>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (campo: string) => {
    const newDir = sortCol === campo && sortDir === 'asc' ? 'desc' : 'asc'
    setSortCol(campo)
    setSortDir(newDir)
    reordenarLineas(campo, newDir)
  }

  const SortTh = ({ campo, label, className = '' }: { campo: string; label: string; className?: string }) => (
    <th className={`text-xs font-medium py-2 px-1 cursor-pointer select-none hover:text-white/70 transition-colors ${className}`}
      onClick={() => handleSort(campo)}>
      {label} {sortCol === campo ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )

  return (
    <div>
      <BackButton onClick={onBack} title="Nuevo Inventario" />
      <div className="flex gap-3 items-end mb-2">
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-44" />
        <div className="text-sm text-white/45 pb-2">Total: <span className="text-[#FFE66D] font-bold">{fmtFull(totalGeneral)}</span></div>
      </div>
      {fechaDuplicada && <p className="text-xs text-[#FF5050] mb-3">Ya existe un inventario para esta fecha.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <SortTh campo="nombre" label="Articulos" className="text-left text-white/45 pr-2" />
              <SortTh campo="salidas" label="Salidas" className="text-center text-white/45 w-20" />
              <SortTh campo="invInicial" label="Inv. Inicial" className="text-center text-white/45 w-24" />
              <SortTh campo="entradas" label="Entradas" className="text-center text-white/45 w-24" />
              <SortTh campo="invFisico" label="Inv. Fisico" className="text-center text-white/45 w-24" />
              <SortTh campo="saldo" label="Saldo" className="text-center text-[#FFE66D]/70 w-20" />
              <SortTh campo="valorUnitario" label="Var Unitario" className="text-right text-white/45 w-24" />
              <SortTh campo="total" label="Total" className="text-right text-[#FFE66D]/70 w-28" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-2 text-white/80 text-xs">{l.nombre}</td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.salidas || ''} onChange={e => actualizarLinea(idx, 'salidas', e.target.value)}
                    className="bg-white/5 border border-[#FF5050]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#FF5050]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.invInicial || ''} onChange={e => actualizarLinea(idx, 'invInicial', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#CDA52F]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.entradas || ''} onChange={e => actualizarLinea(idx, 'entradas', e.target.value)}
                    className="bg-white/5 border border-[#4ECDC4]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#4ECDC4]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.invFisico || ''} onChange={e => actualizarLinea(idx, 'invFisico', e.target.value)}
                    className="bg-white/5 border border-[#CDA52F]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#CDA52F]/50" />
                </td>
                <td className={`py-2 px-1 text-center text-xs font-bold ${l.saldo >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{l.saldo}</td>
                <td className="py-2 px-1 text-right text-xs text-white/45">{fmtFull(l.valorUnitario)}</td>
                <td className={`py-2 pl-1 text-right text-xs font-bold ${l.total >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/10">
              <td colSpan={7} className="py-3 text-right text-sm font-bold text-white/70">Total General:</td>
              <td className={`py-3 pl-1 text-right text-sm font-bold ${totalGeneral >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <Btn onClick={handleGuardar} disabled={guardando || fechaDuplicada}>{guardando ? 'Guardando...' : 'Guardar Inventario'}</Btn>
      </div>
    </div>
  )
}

function InventarioLista({ inventarios, expandedId, setExpandedId, confirmDelete, setConfirmDelete, handleEliminar, onNuevo, productosLoaded }: {
  inventarios: InventarioType[]; expandedId: string | null; setExpandedId: (id: string | null) => void
  confirmDelete: string | null; setConfirmDelete: (id: string | null) => void
  handleEliminar: (id: string) => void; onNuevo: () => void; productosLoaded: boolean
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const filtrados = inventarios.filter(inv => { if (desde && inv.fecha < desde) return false; if (hasta && inv.fecha > hasta) return false; return true })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} total={inventarios.length} filtrados={filtrados.length} />
        <Btn onClick={onNuevo} disabled={!productosLoaded} className="w-full sm:w-auto shrink-0">{productosLoaded ? '+ Nuevo Inventario' : 'Cargando...'}</Btn>
      </div>
      {filtrados.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">{inventarios.length === 0 ? 'No hay inventarios registrados.' : 'No hay inventarios en el periodo seleccionado.'}</Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(inv => {
            const expanded = expandedId === inv.id
            const conVenta = inv.lineas.filter(l => l.saldo > 0).length
            return (
              <Card key={inv.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : inv.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#4ECDC4]/15 text-[#4ECDC4] shrink-0">{inv.fecha}</span>
                    <span className="text-xs text-white/45 truncate">{conVenta} con venta</span>
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-sm font-bold text-[#FFE66D]">{fmtCOP(inv.totalGeneral)}</span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4" onClick={e => e.stopPropagation()}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/45 py-1 pr-2">Articulos</th>
                            <th className="text-center text-white/45 py-1 px-1">Salidas</th>
                            <th className="text-center text-white/45 py-1 px-1">Inv. Inicial</th>
                            <th className="text-center text-white/45 py-1 px-1">Entradas</th>
                            <th className="text-center text-white/45 py-1 px-1">Inv. Fisico</th>
                            <th className="text-center text-white/45 py-1 px-1">Saldo</th>
                            <th className="text-right text-white/45 py-1 px-1">Var Unitario</th>
                            <th className="text-right text-white/45 py-1 pl-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.lineas.filter(l => l.saldo !== 0 || l.entradas !== 0 || (l.salidas && l.salidas !== 0)).map(l => (
                            <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5">
                              <td className="py-1 pr-2 text-white/70">{l.nombre}</td>
                              <td className="py-1 px-1 text-center text-[#FF5050]">{l.salidas || '-'}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.invInicial}</td>
                              <td className="py-1 px-1 text-center text-[#4ECDC4]">{l.entradas || '-'}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.invFisico}</td>
                              <td className={`py-1 px-1 text-center font-bold ${l.saldo >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{l.saldo}</td>
                              <td className="py-1 px-1 text-right text-white/40">{fmtFull(l.valorUnitario)}</td>
                              <td className={`py-1 pl-1 text-right font-bold ${l.total >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(l.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10">
                            <td colSpan={7} className="py-2 text-right text-sm font-bold text-white/60">Total:</td>
                            <td className="py-2 pl-1 text-right text-sm font-bold text-[#FFE66D]">{fmtFull(inv.totalGeneral)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex justify-end mt-3">
                      {confirmDelete === inv.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-[#FF5050]">Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(inv.id)}>Si</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(inv.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar</Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



function ComparativoNuevo({ fecha, setFecha, lineas, totalConteo, totalTiquets, actualizarLinea, guardando, fechaDuplicada, handleGuardar, onBack }: {
  fecha: string; setFecha: (v: string) => void; lineas: LineaComparativo[]
  totalConteo: number; totalTiquets: number
  actualizarLinea: (idx: number, campo: 'conteo' | 'tiquets', valor: string) => void
  guardando: boolean; fechaDuplicada: boolean; handleGuardar: () => void; onBack: () => void
}) {
  const totalDiferencia = lineas.reduce((s, l) => s + l.diferencia, 0)
  return (
    <div>
      <BackButton onClick={onBack} title="Nuevo Comparativo de Ventas" />
      <div className="flex gap-3 items-end mb-2">
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-44" />
      </div>
      {fechaDuplicada && <p className="text-xs text-[#FF5050] mb-3">Ya existe un comparativo para esta fecha.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/45 text-xs font-medium py-2 pr-2">Articulo</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-28">Ventas conteo</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-28">Ventas tiquets</th>
              <th className="text-center text-[#FFE66D]/70 text-xs font-medium py-2 px-1 w-24">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-2 text-white/80 text-xs">{l.nombre}</td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.conteo || ''} onChange={e => actualizarLinea(idx, 'conteo', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#CDA52F]/50" />
                </td>
                <td className="py-1 px-1">
                  <input type="number" min={0} value={l.tiquets || ''} onChange={e => actualizarLinea(idx, 'tiquets', e.target.value)}
                    className="bg-white/5 border border-[#4ECDC4]/20 rounded px-2 py-1 text-xs text-white w-full text-center focus:outline-none focus:border-[#4ECDC4]/50" />
                </td>
                <td className="py-2 px-1 text-center">
                  <span className={`inline-block min-w-[32px] px-2 py-0.5 rounded text-xs font-bold ${l.diferencia === 0 ? 'text-white/30' : l.diferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                    {l.diferencia !== 0 ? Math.abs(l.diferencia) : '0'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/10">
              <td className="py-3 text-right text-sm font-bold text-white/70">Total:</td>
              <td className="py-3 text-center text-sm font-bold text-white/80">{totalConteo}</td>
              <td className="py-3 text-center text-sm font-bold text-[#4ECDC4]">{totalTiquets}</td>
              <td className="py-3 text-center">
                <span className={`inline-block min-w-[40px] px-2 py-0.5 rounded text-sm font-bold ${totalDiferencia === 0 ? 'text-white/30' : totalDiferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                  {totalDiferencia}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <Btn onClick={handleGuardar} disabled={guardando || fechaDuplicada}>{guardando ? 'Guardando...' : 'Guardar Comparativo'}</Btn>
      </div>
    </div>
  )
}

function ComparativoLista({ comparativos, expandedId, setExpandedId, confirmDelete, setConfirmDelete, handleEliminar, onNuevo, productosLoaded }: {
  comparativos: ComparativoType[]; expandedId: string | null; setExpandedId: (id: string | null) => void
  confirmDelete: string | null; setConfirmDelete: (id: string | null) => void
  handleEliminar: (id: string) => void; onNuevo: () => void; productosLoaded: boolean
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const filtrados = comparativos.filter(c => { if (desde && c.fecha < desde) return false; if (hasta && c.fecha > hasta) return false; return true })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} total={comparativos.length} filtrados={filtrados.length} />
        <Btn onClick={onNuevo} disabled={!productosLoaded} className="w-full sm:w-auto shrink-0">{productosLoaded ? '+ Nuevo Comparativo' : 'Cargando...'}</Btn>
      </div>
      {filtrados.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">{comparativos.length === 0 ? 'No hay comparativos registrados.' : 'No hay comparativos en el periodo seleccionado.'}</Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => {
            const expanded = expandedId === c.id
            const totalDif = c.lineas.reduce((s, l) => s + l.diferencia, 0)
            const conDif = c.lineas.filter(l => l.diferencia !== 0).length
            return (
              <Card key={c.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : c.id)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#4ECDC4]/15 text-[#4ECDC4] shrink-0">{c.fecha}</span>
                    <span className="text-xs text-white/45 truncate">{conDif} con diferencia</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap">
                    <span className="text-[10px] sm:text-xs text-white/40">Conteo: <span className="text-white/70 font-medium">{c.totalConteo}</span></span>
                    <span className="text-[10px] sm:text-xs text-white/40">Tiquets: <span className="text-[#4ECDC4] font-medium">{c.totalTiquets}</span></span>
                    <span className={`text-[10px] sm:text-xs font-bold ${totalDif === 0 ? 'text-white/30' : totalDif > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>Dif: {totalDif}</span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4" onClick={e => e.stopPropagation()}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/45 py-1 pr-2">Articulo</th>
                            <th className="text-center text-white/45 py-1 px-1">Conteo</th>
                            <th className="text-center text-white/45 py-1 px-1">Tiquets</th>
                            <th className="text-center text-white/45 py-1 px-1">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.lineas.map(l => (
                            <tr key={`${l.productoId}-${l.nombre}`} className="border-b border-white/5">
                              <td className="py-1 pr-2 text-white/70">{l.nombre}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.conteo}</td>
                              <td className="py-1 px-1 text-center text-[#4ECDC4]">{l.tiquets}</td>
                              <td className="py-1 px-1 text-center">
                                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-bold ${l.diferencia === 0 ? 'text-white/30' : l.diferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                                  {Math.abs(l.diferencia)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10">
                            <td className="py-2 text-right text-sm font-bold text-white/60">Total:</td>
                            <td className="py-2 text-center text-sm font-bold text-white/70">{c.totalConteo}</td>
                            <td className="py-2 text-center text-sm font-bold text-[#4ECDC4]">{c.totalTiquets}</td>
                            <td className="py-2 text-center">
                              <span className={`inline-block min-w-[36px] px-2 py-0.5 rounded text-sm font-bold ${totalDif === 0 ? 'text-white/30' : totalDif > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'}`}>
                                {totalDif}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex justify-end mt-3">
                      {confirmDelete === c.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-[#FF5050]">Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(c.id)}>Si</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(c.id)} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Eliminar</Btn>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



function calcSemanaData(jornadasSem: Jornada[]) {
  const tMap = new Map<string, { nombre: string; color: string; avatar: string; totales: number[] }>()
  for (let i = 0; i < jornadasSem.length; i++) {
    for (const liq of jornadasSem[i].liquidaciones || []) {
      if (!tMap.has(liq.nombre)) tMap.set(liq.nombre, { nombre: liq.nombre, color: liq.color, avatar: liq.avatar, totales: new Array(jornadasSem.length).fill(0) })
      tMap.get(liq.nombre)!.totales[i] = liq.lineas?.reduce((s, l) => s + l.total, 0) || liq.totalVenta || 0
    }
  }
  const resumen = jornadasSem.map(j => { const c = calcularCuadreDia(j.liquidaciones || []); return { sesion: j.sesion, fecha: j.fecha, id: j.id, ventaTotal: c.totalVendido, gastos: c.totalGastos, datafono: c.pagos.Datafono, qr: c.pagos.QR, nequi: c.pagos.Nequi, vales: c.pagos.Vales, cortesias: c.totalCortesias, efectivo: c.pagos.Efectivo, totalRecibido: c.totalRecibido, saldo: c.saldo } })
  const s = (k: string) => resumen.reduce((a, r) => a + ((r as any)[k] || 0), 0)
  const tot = { ventaTotal: s('ventaTotal'), gastos: s('gastos'), datafono: s('datafono'), qr: s('qr'), nequi: s('nequi'), vales: s('vales'), cortesias: s('cortesias'), efectivo: s('efectivo'), totalRecibido: s('totalRecibido'), saldo: s('saldo') }
  return { trabajadores: Array.from(tMap.values()), resumen, tot }
}

const FILAS_SEM: { key: string; label: string; color: string; bold?: boolean; isSaldo?: boolean }[] = [
  { key: 'ventaTotal', label: 'Venta Total', color: '#FFE66D', bold: true },
  { key: 'gastos', label: 'Gastos', color: '' },
  { key: 'datafono', label: 'Datafono', color: '#A8E6CF' },
  { key: 'qr', label: 'QR', color: '#4ECDC4' },
  { key: 'nequi', label: 'Nequi', color: '#FFE66D' },
  { key: 'vales', label: 'Vales', color: '#C3B1E1' },
  { key: 'cortesias', label: 'Cortesias', color: '' },
  { key: 'efectivo', label: 'Efectivo Entregado', color: '#CDA52F' },
  { key: 'totalRecibido', label: 'Total', color: '#4ECDC4', bold: true },
  { key: 'saldo', label: 'Saldo a Favor o en contra', color: '', isSaldo: true },
]

function LiquidacionSemana({ jornadas }: { jornadas: Jornada[]; inventarios: InventarioType[] }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [semanaActiva, setSemanaActiva] = useState<number | null>(null)

  const jornadasFiltradas = useMemo(() => {
    if (!desde || !hasta) return []
    return jornadas.filter(j => j.fecha >= desde && j.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [jornadas, desde, hasta])

  const fechasDisponibles = useMemo(() => {
    const sorted = [...jornadas].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const grupos: Jornada[][] = []
    let curr: Jornada[] = []
    for (const j of sorted) {
      if (curr.length > 0) {
        const prev = new Date(curr[curr.length - 1].fecha + 'T12:00:00')
        const cur = new Date(j.fecha + 'T12:00:00')
        if ((cur.getTime() - prev.getTime()) / 86400000 > 2) { grupos.push(curr); curr = [] }
      }
      curr.push(j)
    }
    if (curr.length > 0) grupos.push(curr)
    return grupos
  }, [jornadas])

  const jornadasVisibles = useMemo(() => {
    if (semanaActiva === null || !fechasDisponibles[semanaActiva]) return jornadasFiltradas
    const grupo = fechasDisponibles[semanaActiva]
    const ids = new Set(grupo.map(j => j.id))
    return jornadasFiltradas.filter(j => ids.has(j.id))
  }, [jornadasFiltradas, semanaActiva, fechasDisponibles])

  const d = useMemo(() => jornadasVisibles.length > 0 ? calcSemanaData(jornadasVisibles) : null, [jornadasVisibles])

  const diasNombre = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

  return (
    <div>
      <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Liquidacion Semanal</h3>

      <div className="flex items-end gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/30 uppercase">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/30 uppercase">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CDA52F]/50" />
        </div>
        {desde && hasta && (
          <span className="text-[10px] text-white/30 pb-2">{jornadasFiltradas.length} jornada{jornadasFiltradas.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {desde && hasta && fechasDisponibles.filter(g => g[0].fecha <= hasta && g[g.length - 1].fecha >= desde).length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Sesiones en el rango seleccionado</p>
          <div className="flex flex-wrap gap-2">
            {fechasDisponibles.map((grupo, gi) => {
              const f0 = grupo[0].fecha
              const fN = grupo[grupo.length - 1].fecha
              if (!(f0 <= hasta && fN >= desde)) return null
              const isActive = semanaActiva === gi
              return (
                <button key={gi} onClick={() => setSemanaActiva(isActive ? null : gi)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all ${isActive ? 'border-[#CDA52F] bg-[#CDA52F]/25 text-[#CDA52F] ring-1 ring-[#CDA52F]/40' : 'border-[#CDA52F]/50 bg-[#CDA52F]/10 text-[#CDA52F] hover:bg-[#CDA52F]/20'}`}>
                  <span className="font-bold">S{gi + 1}</span>
                  <span className="text-white/30">|</span>
                  {grupo.map((j, ji) => {
                    const dt = new Date(j.fecha + 'T12:00:00')
                    return (
                      <span key={ji} className="px-1 py-0.5 rounded text-[10px] text-[#CDA52F]">
                        {diasNombre[dt.getDay()]} {dt.getDate()}
                      </span>
                    )
                  })}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!desde || !hasta ? (
        <Card className="text-center py-12 text-white/30 text-sm">Selecciona un rango de fechas para ver la liquidacion semanal.</Card>
      ) : jornadasVisibles.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">No hay jornadas en el rango seleccionado.</Card>
      ) : d && (
        <div className="space-y-4">
          <Card className="border-[#CDA52F]/20">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center text-white/30 py-2 pr-4 font-bold border-b border-[#CDA52F]/20 text-[10px] uppercase tracking-wider">Meseros</th>
                    {jornadasVisibles.map(j => (
                      <th key={j.id} className="text-right text-white/50 py-2 px-3 font-medium border-b border-[#CDA52F]/20 min-w-[100px]">
                        <div className="text-[11px] font-bold">{j.sesion}</div>
                        <div className="text-[9px] text-white/25 font-normal">{j.fecha}</div>
                      </th>
                    ))}
                    {jornadasVisibles.length > 1 && (
                      <th className="text-center text-[#CDA52F] py-2 px-3 font-bold border-b border-[#CDA52F]/20 bg-white/[0.02]">LIQ. SEMANA</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {d.trabajadores.map(t => (
                    <tr key={t.nombre} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: t.color + '33', color: t.color }}>{t.avatar}</div>
                          <span className="text-white/60 font-medium">{t.nombre}</span>
                        </div>
                      </td>
                      {t.totales.map((v, i) => (
                        <td key={i} className="text-right text-white/50 py-2 px-3">{v > 0 ? fmtCOP(v) : '-'}</td>
                      ))}
                      {jornadasVisibles.length > 1 && (
                        <td className="text-center font-bold text-white/80 py-2 px-3 bg-white/[0.02]">{fmtCOP(t.totales.reduce((a, v) => a + v, 0))}</td>
                      )}
                    </tr>
                  ))}

                  <tr className="border-t-2 border-[#FFE66D]/30">
                    <td className="py-2.5 pr-4 font-bold text-[#FFE66D] text-sm">Venta Total</td>
                    {d.resumen.map((r, i) => (
                      <td key={i} className="text-right font-bold text-[#FFE66D] py-2.5 px-3">{fmtCOP(r.ventaTotal)}</td>
                    ))}
                    {jornadasVisibles.length > 1 && (
                      <td className="text-center font-bold text-[#FFE66D] text-sm py-2.5 px-3 bg-white/[0.02]">{fmtCOP(d.tot.ventaTotal)}</td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="border-white/[0.07]">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-3">Medios de Pago & Deducciones</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-white/40 py-2 pr-4 font-medium border-b border-white/10"></th>
                    {jornadasVisibles.map(j => (
                      <th key={j.id} className="text-right text-white/40 py-2 px-3 font-medium border-b border-white/10 min-w-[100px]">{j.sesion}</th>
                    ))}
                    {jornadasVisibles.length > 1 && (
                      <th className="text-center text-[#CDA52F] py-2 px-3 font-bold border-b border-white/10 bg-white/[0.02]">Total</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {FILAS_SEM.filter(f => f.key !== 'ventaTotal' && !f.isSaldo).map(f => {
                    const vals = d.resumen.map(r => ((r as any)[f.key] as number) ?? 0)
                    const total = ((d.tot as any)[f.key] as number) ?? 0
                    const isTotal = f.key === 'totalRecibido'
                    return (
                      <tr key={f.key} className={`border-b border-white/[0.04] ${isTotal ? 'border-t-2 border-[#4ECDC4]/30' : ''}`}>
                        <td className={`py-2 pr-4 ${isTotal ? 'font-bold text-white/70 text-sm' : 'text-white/40'}`}>{f.label}</td>
                        {vals.map((v, i) => (
                          <td key={i} className={`text-right py-2 px-3 ${isTotal ? 'font-bold' : ''}`} style={{ color: f.color || 'rgba(255,255,255,0.5)' }}>
                            {fmtCOP(v)}
                          </td>
                        ))}
                        {jornadasVisibles.length > 1 && (
                          <td className={`text-center py-2 px-3 bg-white/[0.02] ${isTotal ? 'font-bold text-sm' : 'font-bold'}`} style={{ color: f.color || '#CDA52F' }}>
                            {fmtCOP(total)}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {(() => {
                    const saldoVals = d.resumen.map(r => r.saldo)
                    const saldoTotal = d.tot.saldo
                    return (
                      <tr className="border-t-2 border-white/20">
                        <td className="py-3 pr-4 font-bold text-sm" style={{ color: saldoTotal >= 0 ? '#4ECDC4' : '#FF5050' }}>Saldo</td>
                        {saldoVals.map((v, i) => (
                          <td key={i} className="text-right py-3 px-3 font-bold" style={{ color: v >= 0 ? '#4ECDC4' : '#FF5050' }}>
                            {fmtCOP(v)}
                          </td>
                        ))}
                        {jornadasVisibles.length > 1 && (
                          <td className="text-center py-3 px-3 font-bold text-sm bg-white/[0.02]" style={{ color: saldoTotal >= 0 ? '#4ECDC4' : '#FF5050' }}>
                            {fmtCOP(saldoTotal)}
                          </td>
                        )}
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
