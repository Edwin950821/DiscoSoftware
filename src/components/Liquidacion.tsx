import { useState, useEffect } from 'react'
import type {
  Mesero, MeseroJornada, MedioPago, Jornada, JornadaInput,
  Producto, Inventario as InventarioType, LineaInventario, InventarioInput,
  Comparativo as ComparativoType, LineaComparativo, ComparativoInput,
} from '../types'
import { Card } from './ui/Card'
import { Btn } from './ui/Btn'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { DateRangeFilter } from './ui/DateRangeFilter'
import { fmtFull, fmtCOP } from '../lib/utils'

const COLORES_MESERO = ['#CDA52F', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C3B1E1', '#FF8FA3', '#98D8C8', '#FFB347']
const MEDIOS: MedioPago[] = ['Efectivo', 'Transferencias', 'Vales']
const COLORES_PAGO: Record<string, string> = { Efectivo: '#CDA52F', Transferencias: '#4ECDC4', Vales: '#C3B1E1' }

function emptyPagos(): Record<MedioPago, number> {
  return { Efectivo: 0, Transferencias: 0, Vales: 0 }
}

function formatMoney(n: number): string {
  if (!n) return ''
  return n.toLocaleString('es-CO')
}

const MONEY_SIZES = {
  md: { label: 'text-xs text-white/45', dollar: 'left-2.5 text-white/25 text-xs', input: 'pl-6 pr-3 py-2 text-sm' },
  sm: { label: 'text-[10px] text-white/40', dollar: 'left-2 text-white/25 text-[10px]', input: 'pl-5 pr-2 py-1.5 text-xs' },
}

function MoneyInput({ value, onChange, label, size = 'md', className = '' }: {
  value: number; onChange: (n: number) => void; label?: string; size?: 'sm' | 'md'; className?: string
}) {
  const [display, setDisplay] = useState(value ? formatMoney(value) : '')
  const s = MONEY_SIZES[size]

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
      {label && <label className={`${s.label} block mb-1`}>{label}</label>}
      <div className="relative">
        <span className={`absolute top-1/2 -translate-y-1/2 ${s.dollar}`}>$</span>
        <input type="text" inputMode="numeric" value={display} onChange={handleChange} placeholder="$0"
          className={`w-full bg-white/5 border border-white/10 rounded-lg ${s.input} text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50`} />
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
        Atrás
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

type Tab = 'semanal' | 'personal' | 'inventario' | 'comparativo'

interface Props {
  jornadas: Jornada[]
  meserosDB: Mesero[]
  productos: Producto[]
  inventarios: InventarioType[]
  comparativos: ComparativoType[]
  agregarMesero: (m: Omit<Mesero, 'id'>) => Promise<void>
  eliminarMesero: (id: string) => Promise<void>
  guardarJornada: (jornada: JornadaInput) => Promise<void>
  eliminarJornada: (id: string) => Promise<void>
  guardarInventario: (inv: InventarioInput) => Promise<void>
  eliminarInventario: (id: string) => Promise<void>
  guardarComparativo: (comp: ComparativoInput) => Promise<void>
  eliminarComparativo: (id: string) => Promise<void>
}

export default function Liquidacion({
  jornadas, meserosDB, productos, inventarios, comparativos,
  agregarMesero, eliminarMesero,
  guardarJornada, eliminarJornada,
  guardarInventario, eliminarInventario,
  guardarComparativo, eliminarComparativo,
}: Props) {
  const [tab, setTab] = useState<Tab>('semanal')

  const [modoPersonal, setModoPersonal] = useState<'lista' | 'nueva'>('lista')
  const [nuevoMesero, setNuevoMesero] = useState('')
  const nextSesion = () => {
    const nums = jornadas.map(j => {
      const match = j.sesion.match(/(\d+)/)
      return match ? Number(match[1]) : 0
    })
    const max = nums.length > 0 ? Math.max(...nums) : 0
    return `SI-${max + 1}`
  }
  const [sesion, setSesion] = useState('')
  const [fechaPersonal, setFechaPersonal] = useState(new Date().toISOString().split('T')[0])
  const [meseros, setMeseros] = useState<MeseroJornada[]>([])
  const [guardandoP, setGuardandoP] = useState(false)
  const [confirmDeleteJ, setConfirmDeleteJ] = useState<string | null>(null)

  const [modoInv, setModoInv] = useState<'lista' | 'nuevo'>('lista')
  const [fechaInv, setFechaInv] = useState(new Date().toISOString().split('T')[0])
  const [lineas, setLineas] = useState<LineaInventario[]>([])
  const [expandedInv, setExpandedInv] = useState<string | null>(null)
  const [confirmDeleteI, setConfirmDeleteI] = useState<string | null>(null)
  const [guardandoI, setGuardandoI] = useState(false)
  const [modalExito, setModalExito] = useState<string | null>(null)

  const [modoComp, setModoComp] = useState<'lista' | 'nuevo'>('lista')
  const [fechaComp, setFechaComp] = useState(new Date().toISOString().split('T')[0])
  const [lineasComp, setLineasComp] = useState<LineaComparativo[]>([])
  const [expandedComp, setExpandedComp] = useState<string | null>(null)
  const [confirmDeleteC, setConfirmDeleteC] = useState<string | null>(null)
  const [guardandoC, setGuardandoC] = useState(false)

  const handleAgregarMesero = async () => {
    if (!nuevoMesero.trim()) return
    const color = COLORES_MESERO[meserosDB.length % COLORES_MESERO.length]
    const avatar = nuevoMesero.trim().slice(0, 2).toUpperCase()
    await agregarMesero({ nombre: nuevoMesero.trim(), color, avatar, activo: true })
    setNuevoMesero('')
  }

  const toggleMesero = (id: string) => {
    setMeseros(prev => {
      const idx = prev.findIndex(m => m.meseroId === id)
      if (idx >= 0) return prev.filter(m => m.meseroId !== id)
      const m = meserosDB.find(x => x.id === id)
      if (!m) return prev
      return [...prev, {
        meseroId: m.id, nombre: m.nombre, color: m.color, avatar: m.avatar,
        totalMesero: 0, pagos: emptyPagos(), cortesias: 0, gastos: 0, efectivoEntregado: 0,
      }]
    })
  }

  const recalcEfectivo = (m: MeseroJornada): MeseroJornada => {
    const efectivo = m.totalMesero - m.pagos.Transferencias - m.pagos.Vales - m.cortesias - m.gastos
    return { ...m, pagos: { ...m.pagos, Efectivo: Math.max(0, efectivo) } }
  }

  const updateMesero = (meseroId: string, campo: string, valor: number) => {
    setMeseros(prev => prev.map(m => {
      if (m.meseroId !== meseroId) return m
      let updated = { ...m }
      if (campo === 'totalMesero') updated.totalMesero = valor
      else if (campo === 'cortesias') updated.cortesias = valor
      else if (campo === 'gastos') updated.gastos = valor
      else if (campo === 'efectivoEntregado') updated.efectivoEntregado = valor
      else if (campo === 'Transferencias' || campo === 'Vales') updated.pagos = { ...m.pagos, [campo]: valor }
      return recalcEfectivo(updated)
    }))
  }

  const globalVendido = meseros.reduce((s, m) => s + m.totalMesero, 0)
  const globalCortesias = meseros.reduce((s, m) => s + m.cortesias, 0)
  const globalGastos = meseros.reduce((s, m) => s + m.gastos, 0)
  const globalPagos = MEDIOS.reduce((acc, medio) => {
    acc[medio] = meseros.reduce((s, m) => s + (m.pagos[medio] || 0), 0); return acc
  }, {} as Record<MedioPago, number>)
  const globalRecibido = MEDIOS.reduce((s, m) => s + globalPagos[m], 0)
  const globalEsperado = globalVendido - globalCortesias - globalGastos
  const globalSaldo = globalRecibido - globalEsperado
  const fechasJornadas = new Set(jornadas.map(j => j.fecha))
  const fechasInv = new Set(inventarios.map(i => i.fecha))
  const fechaPersonalDuplicada = fechasJornadas.has(fechaPersonal)
  const fechaInvDuplicada = fechasInv.has(fechaInv)
  const formValidoP = sesion.trim() !== '' && meseros.length > 0 && !fechaPersonalDuplicada

  const handleGuardarPersonal = async () => {
    if (guardandoP) return
    setGuardandoP(true)
    try {
      await guardarJornada({ sesion, fecha: fechaPersonal, meseros })
      setGuardandoP(false)
      setModalExito('Liquidación personal guardada')
      setTimeout(() => {
        setModalExito(null)
        setSesion(''); setFechaPersonal(new Date().toISOString().split('T')[0]); setMeseros([])
        setModoPersonal('lista')
      }, 2000)
    } catch {
      setGuardandoP(false)
      alert('Error al guardar. Revisa la consola.')
    }
  }

  const handleEliminarJ = async (id: string) => { await eliminarJornada(id); setConfirmDeleteJ(null) }

  const generarLineasInv = () => {
    const activos = productos.filter(p => p.activo)
    if (activos.length === 0) return []
    const ultimo = inventarios.length > 0 ? inventarios[0] : null
    return activos.map(p => {
      const ant = ultimo?.lineas.find(l => l.productoId === p.id)
      const invInicial = ant?.invFisico ?? 0
      const saldo = Math.abs(invInicial)
      return { productoId: p.id, nombre: p.nombre, valorUnitario: p.precio, invInicial, entradas: 0, invFisico: 0, saldo, total: saldo * p.precio }
    }).sort((a, b) => b.valorUnitario - a.valorUnitario)
  }

  const crearNuevoInv = () => {
    setLineas(generarLineasInv())
    setFechaInv(new Date().toISOString().split('T')[0])
    setModoInv('nuevo')
  }

  useEffect(() => {
    if (modoInv === 'nuevo' && lineas.length === 0 && productos.length > 0) {
      setLineas(generarLineasInv())
    }
  }, [modoInv, productos, lineas.length, inventarios])

  const actualizarLinea = (idx: number, campo: 'invInicial' | 'entradas' | 'invFisico', valor: string) => {
    setLineas(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [campo]: Number(valor) || 0 }
      const disponible = updated.invInicial + updated.entradas
      updated.saldo = Math.abs(disponible - updated.invFisico)
      updated.total = updated.saldo * updated.valorUnitario
      return updated
    }))
  }

  const totalGeneralInv = lineas.reduce((s, l) => s + l.total, 0)

  const formValidoInv = !fechaInvDuplicada && lineas.length > 0

  const handleGuardarInv = async () => {
    if (fechaInvDuplicada || guardandoI) return
    setGuardandoI(true)
    try {
      await guardarInventario({ fecha: fechaInv, lineas, totalGeneral: totalGeneralInv })
      setGuardandoI(false)
      setModalExito('Liquidación de inventario guardada')
      setTimeout(() => { setModalExito(null); setModoInv('lista') }, 2000)
    } catch {
      setGuardandoI(false)
      alert('Error al guardar inventario. Revisa la consola.')
    }
  }

  const handleEliminarI = async (id: string) => { await eliminarInventario(id); setConfirmDeleteI(null); setExpandedInv(null) }

  const fechasComp = new Set(comparativos.map(c => c.fecha))
  const fechaCompDuplicada = fechasComp.has(fechaComp)

  const generarLineasComp = () => {
    const activos = productos.filter(p => p.activo)
    if (activos.length === 0) return []
    return activos.map(p => ({
      productoId: p.id, nombre: p.nombre, conteo: 0, tiquets: 0, diferencia: 0,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  const crearNuevoComp = () => {
    setLineasComp(generarLineasComp())
    setFechaComp(new Date().toISOString().split('T')[0])
    setModoComp('nuevo')
  }

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
      setModalExito('Comparativo de ventas guardado')
      setTimeout(() => { setModalExito(null); setModoComp('lista') }, 2000)
    } catch {
      setGuardandoC(false)
      alert('Error al guardar comparativo. Revisa la consola.')
    }
  }

  const handleEliminarC = async (id: string) => { await eliminarComparativo(id); setConfirmDeleteC(null); setExpandedComp(null) }

  const cambiarTab = (t: Tab) => {
    setGuardandoP(false)
    setGuardandoI(false)
    setGuardandoC(false)
    setTab(t)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'semanal', label: 'Semanal' },
    { key: 'personal', label: 'Personal' },
    { key: 'inventario', label: 'Inventario' },
    { key: 'comparativo', label: 'Comparativo' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Liquidaciones</h2>

      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => cambiarTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === t.key ? 'bg-[#CDA52F] text-white font-medium shadow-[0_0_10px_rgba(205,165,47,0.3)]' : 'text-white/50 hover:text-white/70 hover:shadow-[0_0_8px_rgba(205,165,47,0.15)]'
              }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'semanal' && <TabSemanal jornadas={jornadas} />}
      {tab === 'personal' && (
        modoPersonal === 'nueva' ? (
          <PersonalNueva
            jornadas={jornadas} meseros={meseros} meserosDB={meserosDB} sesion={sesion} fecha={fechaPersonal}
            nuevoMesero={nuevoMesero} guardando={guardandoP} formValido={formValidoP}
            fechaDuplicada={fechaPersonalDuplicada}
            globalVendido={globalVendido} globalCortesias={globalCortesias} globalGastos={globalGastos}
            globalPagos={globalPagos} globalRecibido={globalRecibido} globalEsperado={globalEsperado} globalSaldo={globalSaldo}
            setSesion={setSesion} setFecha={setFechaPersonal} setNuevoMesero={setNuevoMesero}
            toggleMesero={toggleMesero} updateMesero={updateMesero}
            handleAgregarMesero={handleAgregarMesero} eliminarMesero={eliminarMesero}
            handleGuardar={handleGuardarPersonal} onBack={() => setModoPersonal('lista')}
          />
        ) : (
          <PersonalLista jornadas={jornadas} confirmDelete={confirmDeleteJ}
            setConfirmDelete={setConfirmDeleteJ} handleEliminar={handleEliminarJ}
            onNueva={() => { setSesion(nextSesion()); setModoPersonal('nueva') }} />
        )
      )}
      {tab === 'inventario' && (
        modoInv === 'nuevo' ? (
          <InventarioNuevo
            fecha={fechaInv} setFecha={setFechaInv} lineas={lineas} totalGeneral={totalGeneralInv}
            actualizarLinea={actualizarLinea} guardando={guardandoI} fechaDuplicada={fechaInvDuplicada}
            handleGuardar={handleGuardarInv} onBack={() => setModoInv('lista')}
          />
        ) : (
          <InventarioLista inventarios={inventarios} expandedId={expandedInv} setExpandedId={setExpandedInv}
            confirmDelete={confirmDeleteI} setConfirmDelete={setConfirmDeleteI}
            handleEliminar={handleEliminarI} onNuevo={crearNuevoInv} productosLoaded={productos.length > 0} />
        )
      )}
      {tab === 'comparativo' && (
        modoComp === 'nuevo' ? (
          <ComparativoNuevo
            fecha={fechaComp} setFecha={setFechaComp} lineas={lineasComp}
            totalConteo={totalConteoComp} totalTiquets={totalTiquetsComp}
            actualizarLinea={actualizarLineaComp} guardando={guardandoC}
            fechaDuplicada={fechaCompDuplicada}
            handleGuardar={handleGuardarComp} onBack={() => setModoComp('lista')}
          />
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

function TabSemanal({ jornadas }: { jornadas: Jornada[] }) {
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mesAnio, setMesAnio] = useState(() => {
    const hoy = new Date()
    return { mes: hoy.getMonth(), anio: hoy.getFullYear() }
  })

  const sorted = [...jornadas].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const gt = {
    vendido: sorted.reduce((s, j) => s + j.totalVendido, 0),
    recibido: sorted.reduce((s, j) => s + j.totalRecibido, 0),
    gastos: sorted.reduce((s, j) => s + j.gastos, 0),
    cortesias: sorted.reduce((s, j) => s + j.cortesias, 0),
    saldo: sorted.reduce((s, j) => s + j.saldo, 0),
  }

  if (jornadas.length === 0) return (
    <div className="text-center mt-16">
      <p className="text-2xl text-white/30 mb-2">Sin datos</p>
      <p className="text-sm text-white/20">Agrega liquidaciones personales para ver el resumen semanal</p>
    </div>
  )
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const primerDiaMes = new Date(mesAnio.anio, mesAnio.mes, 1)
  let diaInicio = primerDiaMes.getDay() - 1
  if (diaInicio < 0) diaInicio = 6
  const diasEnMes = new Date(mesAnio.anio, mesAnio.mes + 1, 0).getDate()

  const jornadasPorFecha = new Map<string, Jornada>()
  for (const j of sorted) jornadasPorFecha.set(j.fecha, j)

  const navMes = (dir: -1 | 1) => {
    setMesAnio(prev => {
      let m = prev.mes + dir
      let a = prev.anio
      if (m < 0) { m = 11; a-- }
      if (m > 11) { m = 0; a++ }
      return { mes: m, anio: a }
    })
  }

  return (
    <div>

      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          <button onClick={() => setVista('lista')}
            className={`px-3 py-1 rounded-md text-xs transition-all ${vista === 'lista' ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/60'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            Lista
          </button>
          <button onClick={() => setVista('calendario')}
            className={`px-3 py-1 rounded-md text-xs transition-all ${vista === 'calendario' ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/60'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Calendario
          </button>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Vendido</p>
            <p className="text-sm font-bold text-[#FFE66D]">{fmtCOP(gt.vendido)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Recibido</p>
            <p className="text-sm font-bold text-[#4ECDC4]">{fmtCOP(gt.recibido)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Saldo</p>
            <p className={`text-sm font-bold ${gt.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtCOP(gt.saldo)}</p>
          </div>
        </div>
      </div>

      {vista === 'lista' ? (

        <div className="space-y-2">
          {sorted.map(j => {
            const expanded = expandedId === j.id
            const esperado = j.totalVendido - j.cortesias - j.gastos
            return (
              <div key={j.id}
                className={`rounded-xl border transition-all duration-200 ${expanded ? 'bg-[#141414] border-white/10' : 'bg-[#111] border-white/[0.05] hover:border-white/10 hover:bg-[#141414]'}`}>
                <button className="w-full text-left px-4 py-3 flex items-center gap-4" onClick={() => setExpandedId(expanded ? null : j.id)}>

                  <div className="flex flex-col items-center min-w-[48px]">
                    <span className="text-[10px] text-white/25 uppercase">{new Date(j.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short' })}</span>
                    <span className="text-lg font-bold text-white/80">{j.fecha.split('-')[2]}</span>
                    <span className="text-[10px] text-white/25">{new Date(j.fecha + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short' })}</span>
                  </div>
                  <div className="h-10 w-px bg-white/[0.07]" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#CDA52F]/15 text-[#CDA52F]">{j.sesion}</span>
                      <span className="text-[10px] text-white/25">{j.meseros?.length || 0} meseros</span>
                    </div>

                    <div className="flex gap-1">
                      {j.meseros?.slice(0, 6).map(m => (
                        <div key={m.meseroId} className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold"
                          style={{ backgroundColor: m.color + '33', color: m.color }}>{m.avatar}</div>
                      ))}
                      {(j.meseros?.length || 0) > 6 && <span className="text-[10px] text-white/25 self-center">+{j.meseros.length - 6}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-white/25">Vendido</p>
                      <p className="text-sm font-bold text-[#FFE66D]">{fmtCOP(j.totalVendido)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/25">Saldo</p>
                      <p className={`text-sm font-bold ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtCOP(j.saldo)}</p>
                    </div>
                    <Chevron expanded={expanded} />
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4 mb-4">
                      {j.meseros?.map(m => (
                        <div key={m.meseroId} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{ backgroundColor: m.color + '33', color: m.color }}>{m.avatar}</div>
                            <span className="text-xs text-white/70 flex-1">{m.nombre}</span>
                            <span className="text-xs text-[#FFE66D] font-bold">{fmtFull(m.totalMesero)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 ml-9">
                            {MEDIOS.filter(medio => (m.pagos?.[medio] || 0) > 0).map(medio => (
                              <span key={medio} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: (COLORES_PAGO[medio] || '#fff') + '22', color: COLORES_PAGO[medio] || '#fff' }}>
                                {medio}: {fmtCOP(m.pagos[medio])}
                              </span>
                            ))}
                            {(m.cortesias || 0) > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">Cort: {fmtCOP(m.cortesias)}</span>}
                            {(m.gastos || 0) > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">Gast: {fmtCOP(m.gastos)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {j.pagos && Object.entries(j.pagos).filter(([, v]) => v > 0).map(([k, v]) => (
                        <span key={k} className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ backgroundColor: (COLORES_PAGO[k] || '#fff') + '22', color: COLORES_PAGO[k] || '#fff' }}>
                          {k}: {fmtFull(v as number)}
                        </span>
                      ))}
                    </div>

                    <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-white/30 mb-0.5">Vendido</p>
                          <p className="text-[#FFE66D] font-bold">{fmtFull(j.totalVendido)}</p>
                        </div>
                        <div>
                          <p className="text-white/30 mb-0.5">Esperado</p>
                          <p className="text-white font-medium">{fmtFull(esperado)}</p>
                        </div>
                        <div>
                          <p className="text-white/30 mb-0.5">Recibido</p>
                          <p className="text-[#4ECDC4] font-bold">{fmtFull(j.totalRecibido)}</p>
                        </div>
                        <div>
                          <p className="text-white/30 mb-0.5">Saldo</p>
                          <p className={`font-bold text-base ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(j.saldo)}</p>
                        </div>
                      </div>
                      {(j.cortesias > 0 || j.gastos > 0) && (
                        <div className="flex gap-4 mt-2 pt-2 border-t border-white/5 text-[10px] text-white/30">
                          {j.cortesias > 0 && <span>Cortesias: {fmtFull(j.cortesias)}</span>}
                          {j.gastos > 0 && <span>Gastos: {fmtFull(j.gastos)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (

        <div>

          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navMes(-1)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-sm font-bold text-white/80">{nombresMes[mesAnio.mes]} {mesAnio.anio}</span>
            <button onClick={() => navMes(1)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {diasSemana.map(d => (
              <div key={d} className="text-center text-[10px] text-white/30 font-medium py-2">{d}</div>
            ))}
            {Array.from({ length: diaInicio }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1
              const fechaStr = `${mesAnio.anio}-${String(mesAnio.mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              const jornada = jornadasPorFecha.get(fechaStr)
              const hoy = new Date().toISOString().split('T')[0] === fechaStr
              return (
                <div key={dia}
                  onClick={() => jornada && setExpandedId(expandedId === jornada.id ? null : jornada.id)}
                  className={`min-h-[80px] rounded-lg border p-1.5 transition-all ${jornada
                      ? 'border-[#CDA52F]/30 bg-[#CDA52F]/5 cursor-pointer hover:border-[#CDA52F]/50 hover:bg-[#CDA52F]/10'
                      : hoy ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.04] bg-transparent'
                    } ${expandedId === jornada?.id ? 'ring-1 ring-[#CDA52F]/50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${hoy ? 'text-[#CDA52F] font-bold' : jornada ? 'text-white/70 font-medium' : 'text-white/20'}`}>{dia}</span>
                    {jornada && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#CDA52F]/20 text-[#CDA52F]">{jornada.sesion}</span>}
                  </div>
                  {jornada && (
                    <div>
                      <p className="text-[10px] text-[#FFE66D] font-bold">{fmtCOP(jornada.totalVendido)}</p>
                      <p className={`text-[9px] font-medium ${jornada.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                        {jornada.saldo >= 0 ? '+' : ''}{fmtCOP(jornada.saldo)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {expandedId && (() => {
            const j = sorted.find(j => j.id === expandedId)
            if (!j) return null
            const esperado = j.totalVendido - j.cortesias - j.gastos
            return (
              <div className="mt-4 rounded-xl bg-[#141414] border border-white/10 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#CDA52F]/15 text-[#CDA52F]">{j.sesion}</span>
                  <span className="text-sm text-white/50">{j.fecha}</span>
                  <button onClick={() => setExpandedId(null)} className="ml-auto text-white/30 hover:text-white/60">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {j.meseros?.map(m => (
                    <div key={m.meseroId} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{ backgroundColor: m.color + '33', color: m.color }}>{m.avatar}</div>
                        <span className="text-xs text-white/70 flex-1">{m.nombre}</span>
                        <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(m.totalMesero)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><p className="text-white/30 mb-0.5">Vendido</p><p className="text-[#FFE66D] font-bold">{fmtFull(j.totalVendido)}</p></div>
                  <div><p className="text-white/30 mb-0.5">Esperado</p><p className="text-white font-medium">{fmtFull(esperado)}</p></div>
                  <div><p className="text-white/30 mb-0.5">Recibido</p><p className="text-[#4ECDC4] font-bold">{fmtFull(j.totalRecibido)}</p></div>
                  <div><p className="text-white/30 mb-0.5">Saldo</p><p className={`font-bold text-base ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(j.saldo)}</p></div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function PersonalLista({ jornadas, confirmDelete, setConfirmDelete, handleEliminar, onNueva }: {
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
      <div className="flex items-center justify-between mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={jornadas.length} filtrados={filtradas.length} />
        <Btn onClick={onNueva}>+ Nueva Liquidación</Btn>
      </div>
      {filtradas.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">
          {jornadas.length === 0 ? 'No hay liquidaciones personales registradas.' : 'No hay liquidaciones en el periodo seleccionado.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map(j => {
            const expanded = expandedId === j.id
            const esperado = j.totalVendido - j.cortesias - j.gastos
            return (
              <Card key={j.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : j.id)}>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge>{j.sesion}</Badge>
                    <span className="text-sm text-white/45">{j.fecha}</span>
                    <span className="text-xs text-white/30">{j.meseros?.length || 0} meseros</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-white/30">Vendido: <span className="text-sm text-[#FFE66D] font-medium">{fmtCOP(j.totalVendido)}</span></span>
                    <span className="text-xs text-white/30">Saldo: <span className={`text-sm font-bold ${j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtCOP(j.saldo)}</span></span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-white/[0.07]" onClick={e => e.stopPropagation()}>

                    <div className="space-y-3 mb-4">
                      {j.meseros?.map(m => {
                        const totalLiq = (m.pagos?.Efectivo || 0) + (m.pagos?.Transferencias || 0) + (m.pagos?.Vales || 0)
                        return (
                          <div key={m.meseroId} className="p-3 rounded-lg bg-white/[0.03]">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ backgroundColor: m.color + '33', color: m.color }}>{m.avatar}</div>
                              <span className="text-xs text-white/70 flex-1">{m.nombre}</span>
                              <span className="text-xs text-[#FFE66D] font-bold">{fmtFull(m.totalMesero)}</span>
                            </div>
                            {m.pagos && (
                              <div className="flex flex-wrap gap-1.5 ml-9">
                                {MEDIOS.filter(medio => (m.pagos[medio] || 0) > 0).map(medio => (
                                  <span key={medio} className="text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: (COLORES_PAGO[medio] || '#fff') + '22', color: COLORES_PAGO[medio] || '#fff' }}>
                                    {medio}: {fmtFull(m.pagos[medio])}
                                  </span>
                                ))}
                                {(m.cortesias || 0) > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                                    Cortesias: {fmtFull(m.cortesias)}
                                  </span>
                                )}
                                {(m.gastos || 0) > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                                    Gastos: {fmtFull(m.gastos)}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex justify-between ml-9 mt-1 text-[10px]">
                              <span className="text-white/30">Total Liq: {fmtFull(totalLiq)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {j.pagos && Object.entries(j.pagos).filter(([, v]) => v > 0).map(([k, v]) => (
                        <span key={k} className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{ backgroundColor: (COLORES_PAGO[k] || '#fff') + '22', color: COLORES_PAGO[k] || '#fff' }}>
                          {k}: {fmtFull(v as number)}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs space-y-1 mb-4">
                      <div className="flex justify-between"><span className="text-white/45">Vendido</span><span>{fmtFull(j.totalVendido)}</span></div>
                      <div className="flex justify-between"><span className="text-white/45">Cortesias</span><span>-{fmtFull(j.cortesias)}</span></div>
                      <div className="flex justify-between"><span className="text-white/45">Gastos</span><span>-{fmtFull(j.gastos)}</span></div>
                      <div className="flex justify-between"><span className="text-white/45">Esperado</span><span className="text-white font-medium">{fmtFull(esperado)}</span></div>
                      <div className="flex justify-between"><span className="text-white/45">Recibido</span><span className="text-[#4ECDC4]">{fmtFull(j.totalRecibido)}</span></div>
                      <div className="flex justify-between font-bold">
                        <span>Saldo</span>
                        <span className={j.saldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}>{fmtFull(j.saldo)}</span>
                      </div>
                    </div>

                    {confirmDelete === j.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#FF5050]">¿Seguro?</span>
                        <Btn size="sm" variant="danger" onClick={() => handleEliminar(j.id)}>Si, eliminar</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
                      </div>
                    ) : (
                      <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(j.id)}>Eliminar liquidación</Btn>
                    )}
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

function PersonalNueva({ jornadas: allJornadas, meseros, meserosDB, sesion, fecha, nuevoMesero, guardando, formValido,
  fechaDuplicada, globalVendido, globalCortesias, globalGastos, globalPagos, globalRecibido, globalEsperado, globalSaldo,
  setSesion, setFecha, setNuevoMesero, toggleMesero, updateMesero,
  handleAgregarMesero, eliminarMesero, handleGuardar, onBack }: {
    jornadas: Jornada[]; meseros: MeseroJornada[]; meserosDB: Mesero[]; sesion: string; fecha: string
    nuevoMesero: string; guardando: boolean; formValido: boolean; fechaDuplicada: boolean
    globalVendido: number; globalCortesias: number; globalGastos: number
    globalPagos: Record<MedioPago, number>; globalRecibido: number; globalEsperado: number; globalSaldo: number
    setSesion: (v: string) => void; setFecha: (v: string) => void; setNuevoMesero: (v: string) => void
    toggleMesero: (id: string) => void; updateMesero: (id: string, campo: string, valor: number) => void
    handleAgregarMesero: () => void; eliminarMesero: (id: string) => Promise<void>
    handleGuardar: () => void; onBack: () => void
  }) {
  const [activeMeseroId, setActiveMeseroId] = useState<string | null>(meseros.length > 0 ? meseros[0].meseroId : null)
  const [modalMesero, setModalMesero] = useState<Mesero | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [showCuadre, setShowCuadre] = useState(false)

  useEffect(() => {
    if (meseros.length > 0 && !meseros.find(m => m.meseroId === activeMeseroId)) {
      setActiveMeseroId(meseros[0].meseroId)
    }
    if (meseros.length === 0) setActiveMeseroId(null)
  }, [meseros, activeMeseroId])

  const activeMesero = meseros.find(m => m.meseroId === activeMeseroId)

  const handleTabClick = (id: string) => {
    const isSelected = meseros.some(mj => mj.meseroId === id)
    if (isSelected) {

      setActiveMeseroId(id)
    } else {

      toggleMesero(id)
      setActiveMeseroId(id)
    }
  }

  const handleMeseroNameClick = (e: React.MouseEvent, dbMesero: Mesero) => {
    e.stopPropagation()
    setModalMesero(dbMesero)
    setConfirmEliminar(false)
  }

  const handleEliminarMesero = async () => {
    if (!modalMesero) return
    if (meseros.some(mj => mj.meseroId === modalMesero.id)) toggleMesero(modalMesero.id)
    await eliminarMesero(modalMesero.id)
    setModalMesero(null)
    setConfirmEliminar(false)
  }

  const handleDeseleccionar = () => {
    if (!modalMesero) return
    if (meseros.some(mj => mj.meseroId === modalMesero.id)) toggleMesero(modalMesero.id)
    setModalMesero(null)
  }

  return (
    <div>
      <BackButton onClick={onBack} title="Nueva Liquidación Personal" />

      <div className="flex gap-3 items-end mb-2">
        <Input label="Sesión" value={sesion} onChange={e => setSesion(e.target.value)} placeholder="SI-7" className="w-32" />
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-44" />
      </div>
      {fechaDuplicada && (
        <p className="text-xs text-[#FF5050] mb-3">Ya existe una liquidación para esta fecha. Escoge otra.</p>
      )}

      <div className="flex gap-2 flex-wrap items-center mb-5">
        {meserosDB.filter(m => m.activo).map(m => {
          const sel = meseros.some(mj => mj.meseroId === m.id)
          const isActive = activeMeseroId === m.id
          return (
            <button key={m.id} onClick={() => handleTabClick(m.id)}
              onContextMenu={e => { e.preventDefault(); handleMeseroNameClick(e, m) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs ${isActive && sel ? 'ring-2 ring-offset-1 ring-offset-[#0A0A0A]' : ''}`}
              style={{
                border: `2px solid ${sel ? m.color : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: sel ? m.color + '20' : 'transparent',
                color: sel ? m.color : 'rgba(255,255,255,0.5)',
                ...(sel ? { '--tw-ring-color': m.color } as React.CSSProperties : {}),
              }}>
              <span className="font-bold">{m.avatar}</span>
              <span onClick={e => handleMeseroNameClick(e, m)} className="cursor-pointer hover:underline">{m.nombre}</span>
            </button>
          )
        })}
        <div className="flex gap-1 items-center">
          <input type="text" placeholder="+ Mesero" value={nuevoMesero} onChange={e => setNuevoMesero(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregarMesero()}
            className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 w-28" />
          {nuevoMesero.trim() && <button onClick={handleAgregarMesero} className="text-[#CDA52F] text-sm font-bold hover:text-[#CDA52F]/70">+</button>}
        </div>
      </div>

      {activeMesero ? (
        <div className="space-y-4">
          {(() => {
            const m = activeMesero
            return (
              <Card key={m.meseroId}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: m.color + '33', color: m.color }}>{m.avatar}</div>
                  <span className="text-sm font-medium">{m.nombre}</span>
                  <span className="text-xs text-white/30 ml-auto">Liq. Diaria</span>
                </div>

                <MoneyInput label="Total Liquidación del Día" value={m.totalMesero} onChange={v => updateMesero(m.meseroId, 'totalMesero', v)} className="mb-3" />
                <MoneyInput label="Efectivo Entregado" value={m.efectivoEntregado} onChange={v => updateMesero(m.meseroId, 'efectivoEntregado', v)} className="mb-4" />

                <p className="text-xs text-white/30 mb-2">Descuentos</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <MoneyInput size="sm" label="Transferencias" value={m.pagos.Transferencias} onChange={v => updateMesero(m.meseroId, 'Transferencias', v)} />
                  <MoneyInput size="sm" label="Vales" value={m.pagos.Vales} onChange={v => updateMesero(m.meseroId, 'Vales', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <MoneyInput size="sm" label="Cortesias" value={m.cortesias} onChange={v => updateMesero(m.meseroId, 'cortesias', v)} />
                  <MoneyInput size="sm" label="Gastos" value={m.gastos} onChange={v => updateMesero(m.meseroId, 'gastos', v)} />
                </div>

                <div className="border-t border-white/[0.07] pt-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Total Liquidación</span><span className="text-white font-medium">{fmtFull(m.totalMesero)}</span></div>
                  {m.pagos.Transferencias > 0 && <div className="flex justify-between"><span className="text-white/40">(-) Transferencias</span><span className="text-white/60">-{fmtFull(m.pagos.Transferencias)}</span></div>}
                  {m.pagos.Vales > 0 && <div className="flex justify-between"><span className="text-white/40">(-) Vales</span><span className="text-white/60">-{fmtFull(m.pagos.Vales)}</span></div>}
                  {m.cortesias > 0 && <div className="flex justify-between"><span className="text-white/40">(-) Cortesias</span><span className="text-white/60">-{fmtFull(m.cortesias)}</span></div>}
                  {m.gastos > 0 && <div className="flex justify-between"><span className="text-white/40">(-) Gastos</span><span className="text-white/60">-{fmtFull(m.gastos)}</span></div>}
                  <div className="border-t border-white/5 my-1" />
                  <div className="flex justify-between font-bold">
                    <span className="text-white/60">Efectivo s/n Liquidación</span>
                    <span className="text-white">{fmtFull(m.pagos.Efectivo)}</span>
                  </div>
                </div>

                {m.efectivoEntregado > 0 && (() => {
                  const saldo = m.efectivoEntregado - m.pagos.Efectivo
                  return (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-bold flex justify-between ${saldo === 0 ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : saldo > 0 ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'bg-[#FF5050]/10 text-[#FF5050]'}`}>
                      <span>{saldo === 0 ? 'Cuadre perfecto' : saldo > 0 ? 'Sobrante' : 'Faltante'}</span>
                      <span>{fmtFull(Math.abs(saldo))}</span>
                    </div>
                  )
                })()}
              </Card>
            )
          })()}

          <button onClick={() => setShowCuadre(!showCuadre)}
            className="w-full text-left text-sm font-medium text-[#FFE66D] py-2 px-3 rounded-lg bg-[#FFE66D]/5 hover:bg-[#FFE66D]/10 transition-all flex items-center justify-between">
            <span>Cuadre de Caja — {sesion || '...'}</span>
            <Chevron expanded={showCuadre} />
          </button>

          {showCuadre && (
            <Card className="border-[#FFE66D]/20">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/45">Total vendido</span><span className="text-[#FFE66D] font-bold">{fmtFull(globalVendido)}</span></div>
                <div className="flex justify-between"><span className="text-white/45">(-) Cortesias</span><span className="text-white/70">-{fmtFull(globalCortesias)}</span></div>
                <div className="flex justify-between"><span className="text-white/45">(-) Gastos</span><span className="text-white/70">-{fmtFull(globalGastos)}</span></div>
                <div className="border-t border-white/10 my-2" />
                <div className="flex justify-between"><span className="text-white/45">Lo que deberia ingresar</span><span className="text-white font-bold">{fmtFull(globalEsperado)}</span></div>
                <div className="flex justify-between"><span className="text-white/45">Total recibido</span><span className="text-[#4ECDC4] font-bold">{fmtFull(globalRecibido)}</span></div>
                <div className="pl-4 space-y-1">
                  {MEDIOS.map(medio => (
                    <div key={medio} className="flex justify-between text-xs"><span className="text-white/30">{medio}</span><span className="text-white/50">{fmtFull(globalPagos[medio])}</span></div>
                  ))}
                </div>
                <div className="border-t border-white/10 my-2" />
                <div className="flex justify-between text-lg"><span className="font-bold">SALDO</span>
                  <span className={`font-bold ${globalSaldo >= 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>{fmtFull(globalSaldo)}</span></div>
              </div>
            </Card>
          )}

        </div>
      ) : (
        <Card className="text-center py-12 text-white/30 text-sm">Selecciona al menos un mesero para comenzar</Card>
      )}

      {meseros.length > 0 && (
        <div className="mt-4">
          {!formValido && !guardando && (
            <p className="text-xs text-[#FF5050] mb-2 text-right">
              {sesion.trim() === '' ? 'Falta el ID de sesión' : fechaDuplicada ? 'Ya existe una liquidación para esta fecha' : ''}
            </p>
          )}
          <div className="flex justify-end">
            <Btn onClick={handleGuardar} disabled={!formValido || guardando}>{guardando ? 'Guardando...' : 'Guardar Liquidación'}</Btn>
          </div>
        </div>
      )}

      {modalMesero && (() => {
        const historial = allJornadas
          .filter(j => j.meseros?.some(m => m.meseroId === modalMesero.id))
          .map(j => {
            const mj = j.meseros.find(m => m.meseroId === modalMesero.id)!
            const liq = (mj.pagos?.Efectivo || 0) + (mj.pagos?.Transferencias || 0) + (mj.pagos?.Vales || 0)
            return { sesion: j.sesion, fecha: j.fecha, totalVendido: mj.totalMesero, liq }
          })
        const totalHistorico = historial.reduce((s, h) => s + h.totalVendido, 0)

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setModalMesero(null); setConfirmEliminar(false) }}>
            <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 shadow-2xl w-[380px] max-h-[80vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: modalMesero.color + '33', color: modalMesero.color }}>{modalMesero.avatar}</div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white">{modalMesero.nombre}</p>
                  <p className="text-xs text-white/40">{historial.length} liquidaciones — Total: <span className="text-[#FFE66D]">{fmtCOP(totalHistorico)}</span></p>
                </div>
              </div>

              {historial.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-white/40 mb-2 font-medium">Historial de liquidaciones</p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {historial.map(h => (
                      <div key={h.sesion} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#CDA52F]/15 text-[#CDA52F] font-medium">{h.sesion}</span>
                          <span className="text-[10px] text-white/30">{h.fecha}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-[#FFE66D] font-bold">{fmtCOP(h.totalVendido)}</span>
                          <span className="text-[10px] text-white/25 ml-2">Liq: {fmtCOP(h.liq)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {historial.length > 0 && (
                    <div className="flex justify-between mt-2 pt-2 border-t border-white/5 px-2">
                      <span className="text-[10px] text-white/40">Promedio/noche</span>
                      <span className="text-xs text-white/60 font-medium">{fmtCOP(Math.round(totalHistorico / historial.length))}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {meseros.some(mj => mj.meseroId === modalMesero.id) ? (
                  <button onClick={handleDeseleccionar}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 flex items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                    Quitar de esta liquidación
                  </button>
                ) : (
                  <button onClick={() => { toggleMesero(modalMesero.id); setActiveMeseroId(modalMesero.id); setModalMesero(null) }}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 flex items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                    Agregar a esta liquidación
                  </button>
                )}

                <button onClick={() => { setActiveMeseroId(modalMesero.id); setModalMesero(null) }}
                  className={`w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-sm text-white/70 flex items-center gap-3 ${!meseros.some(mj => mj.meseroId === modalMesero.id) ? 'opacity-40 pointer-events-none' : ''}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  Ver liquidación
                </button>

                <div className="border-t border-white/10 my-2" />

                {confirmEliminar ? (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-xs text-[#FF5050] flex-1">¿Eliminar permanentemente?</span>
                    <Btn size="sm" variant="danger" onClick={handleEliminarMesero}>Si</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmEliminar(false)}>No</Btn>
                  </div>
                ) : (
                  <button onClick={() => setConfirmEliminar(true)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#FF5050]/10 transition-all text-sm text-[#FF5050] flex items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    Eliminar mesero
                  </button>
                )}
              </div>

              <button onClick={() => { setModalMesero(null); setConfirmEliminar(false) }}
                className="mt-4 w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors py-2">Cerrar</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function InventarioNuevo({ fecha, setFecha, lineas, totalGeneral, actualizarLinea, guardando, fechaDuplicada, handleGuardar, onBack }: {
  fecha: string; setFecha: (v: string) => void; lineas: LineaInventario[]; totalGeneral: number
  actualizarLinea: (idx: number, campo: 'invInicial' | 'entradas' | 'invFisico', valor: string) => void
  guardando: boolean; fechaDuplicada: boolean; handleGuardar: () => void; onBack: () => void
}) {
  return (
    <div>
      <BackButton onClick={onBack} title="Nueva Liquidación Inventario" />
      <div className="flex gap-3 items-end mb-2">
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-44" />
        <div className="text-sm text-white/45 pb-2">Total: <span className="text-[#FFE66D] font-bold">{fmtFull(totalGeneral)}</span></div>
      </div>
      {fechaDuplicada && (
        <p className="text-xs text-[#FF5050] mb-3">Ya existe un inventario para esta fecha. Escoge otra.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/45 text-xs font-medium py-2 pr-2">Producto</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-24">Inv. Inicial</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-24">Entradas</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-24">Inv. Físico</th>
              <th className="text-center text-[#FFE66D]/70 text-xs font-medium py-2 px-1 w-20">Saldo</th>
              <th className="text-right text-white/45 text-xs font-medium py-2 px-1 w-20">Val. Unit.</th>
              <th className="text-right text-[#FFE66D]/70 text-xs font-medium py-2 pl-1 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr key={l.productoId} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-2 text-white/80 text-xs">{l.nombre}</td>
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
              <td colSpan={6} className="py-3 text-right text-sm font-bold text-white/70">Total General:</td>
              <td className={`py-3 pl-1 text-right text-sm font-bold ${totalGeneral >= 0 ? 'text-[#FFE66D]' : 'text-[#FF5050]'}`}>{fmtFull(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <Btn onClick={handleGuardar} disabled={guardando || fechaDuplicada}>{guardando ? 'Guardando...' : 'Guardar Liquidación'}</Btn>
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

  const filtrados = inventarios.filter(inv => {
    if (desde && inv.fecha < desde) return false
    if (hasta && inv.fecha > hasta) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={inventarios.length} filtrados={filtrados.length} />
        <Btn onClick={onNuevo} disabled={!productosLoaded}>{productosLoaded ? '+ Nueva Liquidación' : 'Cargando productos...'}</Btn>
      </div>
      {filtrados.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">
          {inventarios.length === 0 ? 'No hay liquidaciones de inventario registradas.' : 'No hay inventarios en el periodo seleccionado.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(inv => {
            const expanded = expandedId === inv.id
            const conVenta = inv.lineas.filter(l => l.saldo > 0).length
            return (
              <Card key={inv.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : inv.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge color="#4ECDC4">{inv.fecha}</Badge>
                    <span className="text-xs text-white/45">{conVenta} productos con venta</span>
                  </div>
                  <div className="flex items-center gap-3">
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
                            <th className="text-left text-white/45 py-1 pr-2">Producto</th>
                            <th className="text-center text-white/45 py-1 px-1">Inv.I</th>
                            <th className="text-center text-white/45 py-1 px-1">Entr.</th>
                            <th className="text-center text-white/45 py-1 px-1">Inv.F</th>
                            <th className="text-center text-white/45 py-1 px-1">Saldo</th>
                            <th className="text-right text-white/45 py-1 px-1">V.U.</th>
                            <th className="text-right text-white/45 py-1 pl-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.lineas.filter(l => l.saldo !== 0 || l.entradas !== 0).map(l => (
                            <tr key={l.productoId} className="border-b border-white/5">
                              <td className="py-1 pr-2 text-white/70">{l.nombre}</td>
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
                            <td colSpan={6} className="py-2 text-right text-sm font-bold text-white/60">Total:</td>
                            <td className="py-2 pl-1 text-right text-sm font-bold text-[#FFE66D]">{fmtFull(inv.totalGeneral)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex justify-end mt-3">
                      {confirmDelete === inv.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-[#FF5050]">¿Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(inv.id)}>Sí</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(inv.id)}>Eliminar</Btn>
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
      {fechaDuplicada && (
        <p className="text-xs text-[#FF5050] mb-3">Ya existe un comparativo para esta fecha. Escoge otra.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/45 text-xs font-medium py-2 pr-2">Artículo</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-28">Ventas conteo</th>
              <th className="text-center text-white/45 text-xs font-medium py-2 px-1 w-28">Ventas tiquets</th>
              <th className="text-center text-[#FFE66D]/70 text-xs font-medium py-2 px-1 w-24">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr key={l.productoId} className="border-b border-white/5 hover:bg-white/[0.02]">
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
                  <span className={`inline-block min-w-[32px] px-2 py-0.5 rounded text-xs font-bold ${l.diferencia === 0 ? 'text-white/30' : l.diferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'
                    }`}>{l.diferencia !== 0 ? l.diferencia : '0'}</span>
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
                <span className={`inline-block min-w-[40px] px-2 py-0.5 rounded text-sm font-bold ${totalDiferencia === 0 ? 'text-white/30' : totalDiferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'
                  }`}>{totalDiferencia}</span>
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

  const filtrados = comparativos.filter(c => {
    if (desde && c.fecha < desde) return false
    if (hasta && c.fecha > hasta) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <DateRangeFilter desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta}
          total={comparativos.length} filtrados={filtrados.length} />
        <Btn onClick={onNuevo} disabled={!productosLoaded}>{productosLoaded ? '+ Nuevo Comparativo' : 'Cargando productos...'}</Btn>
      </div>
      {filtrados.length === 0 ? (
        <Card className="text-center py-12 text-white/30 text-sm">
          {comparativos.length === 0 ? 'No hay comparativos de ventas registrados.' : 'No hay comparativos en el periodo seleccionado.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => {
            const expanded = expandedId === c.id
            const totalDif = c.lineas.reduce((s, l) => s + l.diferencia, 0)
            const conDif = c.lineas.filter(l => l.diferencia !== 0).length
            return (
              <Card key={c.id} className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : c.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge color="#4ECDC4">{c.fecha}</Badge>
                    <span className="text-xs text-white/45">{conDif} con diferencia</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">Conteo: <span className="text-white/70 font-medium">{c.totalConteo}</span></span>
                    <span className="text-xs text-white/40">Tiquets: <span className="text-[#4ECDC4] font-medium">{c.totalTiquets}</span></span>
                    <span className={`text-xs font-bold ${totalDif === 0 ? 'text-white/30' : totalDif > 0 ? 'text-[#4ECDC4]' : 'text-[#FF5050]'}`}>
                      Dif: {totalDif}
                    </span>
                    <Chevron expanded={expanded} />
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4" onClick={e => e.stopPropagation()}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/45 py-1 pr-2">Artículo</th>
                            <th className="text-center text-white/45 py-1 px-1">Conteo</th>
                            <th className="text-center text-white/45 py-1 px-1">Tiquets</th>
                            <th className="text-center text-white/45 py-1 px-1">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.lineas.filter(l => l.conteo > 0 || l.tiquets > 0).map(l => (
                            <tr key={l.productoId} className="border-b border-white/5">
                              <td className="py-1 pr-2 text-white/70">{l.nombre}</td>
                              <td className="py-1 px-1 text-center text-white/50">{l.conteo}</td>
                              <td className="py-1 px-1 text-center text-[#4ECDC4]">{l.tiquets}</td>
                              <td className="py-1 px-1 text-center">
                                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-bold ${l.diferencia === 0 ? 'text-white/30' : l.diferencia > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'
                                  }`}>{l.diferencia}</span>
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
                              <span className={`inline-block min-w-[36px] px-2 py-0.5 rounded text-sm font-bold ${totalDif === 0 ? 'text-white/30' : totalDif > 0 ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#FF5050]/15 text-[#FF5050]'
                                }`}>{totalDif}</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex justify-end mt-3">
                      {confirmDelete === c.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-[#FF5050]">¿Eliminar?</span>
                          <Btn size="sm" variant="danger" onClick={() => handleEliminar(c.id)}>Sí</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(c.id)}>Eliminar</Btn>
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
