import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from './firebase'

const PRODUCTOS = [
  { nombre: 'Aguila Negra 330ml',          precio: 5000,   activo: true },
  { nombre: 'Aguila Light',                precio: 5000,   activo: true },
  { nombre: 'Costeñita 330ml',             precio: 5000,   activo: true },
  { nombre: 'Coronita 355ml',              precio: 6000,   activo: true },
  { nombre: 'Club Colombia',               precio: 6000,   activo: true },
  { nombre: 'Heineken',                    precio: 6000,   activo: true },
  { nombre: 'Budweiser',                   precio: 6000,   activo: true },
  { nombre: 'Stella Artois',               precio: 10000,  activo: true },
  { nombre: 'Smirnoff Ice',                precio: 14000,  activo: true },
  { nombre: 'Antioqueño Litro Tapa Verde', precio: 150000, activo: true },
  { nombre: 'Antioqueño 750ml Verde',      precio: 120000, activo: true },
  { nombre: 'Antioqueño Litro Amarillo',   precio: 150000, activo: true },
  { nombre: 'Old Parr 1 Litro',            precio: 280000, activo: true },
  { nombre: 'Agua',                        precio: 5000,   activo: true },
  { nombre: 'Coca Cola',                   precio: 5000,   activo: true },
  { nombre: 'Soda',                        precio: 5000,   activo: true },
  { nombre: 'Gatorade',                    precio: 7000,   activo: true },
  { nombre: 'Electrolit',                  precio: 12000,  activo: true },
  { nombre: 'Redbull',                     precio: 15000,  activo: true },
  { nombre: 'Vaso Michelado',              precio: 3000,   activo: true },
  { nombre: 'Bombon',                      precio: 1000,   activo: true },
  { nombre: 'Detodito',                    precio: 7000,   activo: true },
  { nombre: 'Mani',                        precio: 3000,   activo: true },
]

const MESEROS = [
  { nombre: 'Gabriel', color: '#FF6B35', avatar: 'GA', activo: true },
  { nombre: 'Carlos',  color: '#4ECDC4', avatar: 'CA', activo: true },
  { nombre: 'Loraine', color: '#FFE66D', avatar: 'LO', activo: true },
  { nombre: 'Luis',    color: '#A8E6CF', avatar: 'LU', activo: true },
  { nombre: 'Barra',   color: '#C3B1E1', avatar: 'BA', activo: true },
]

let initialized = false

export async function initFirebase() {
  if (initialized) return
  initialized = true

  const [prodSnap, mesSnap] = await Promise.all([
    getDocs(collection(db, 'productos')),
    getDocs(collection(db, 'meseros')),
  ])
  if (prodSnap.empty) {
    await Promise.all(PRODUCTOS.map(p => addDoc(collection(db, 'productos'), p)))
  }
  if (mesSnap.empty) {
    await Promise.all(MESEROS.map(m => addDoc(collection(db, 'meseros'), m)))
  }
}
