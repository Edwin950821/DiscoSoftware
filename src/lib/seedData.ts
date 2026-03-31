import { db, hashPassword } from './db'

const PRODUCTOS = [
  { nombre: 'Aguila Negra 330ml', precio: 5000, activo: true },
  { nombre: 'Aguila Light', precio: 5000, activo: true },
  { nombre: 'Costeñita 330ml', precio: 5000, activo: true },
  { nombre: 'Coronita 355ml', precio: 6000, activo: true },
  { nombre: 'Club Colombia', precio: 6000, activo: true },
  { nombre: 'Heineken', precio: 6000, activo: true },
  { nombre: 'Budweiser', precio: 6000, activo: true },
  { nombre: 'Stella Artois', precio: 10000, activo: true },
  { nombre: 'Smirnoff Ice', precio: 14000, activo: true },
  { nombre: 'Antioqueño Litro Tapa Verde', precio: 150000, activo: true },
  { nombre: 'Antioqueño 750ml Verde', precio: 120000, activo: true },
  { nombre: 'Antioqueño Litro Amarillo', precio: 150000, activo: true },
  { nombre: 'Old Parr 1 Litro', precio: 280000, activo: true },
  { nombre: 'Agua', precio: 5000, activo: true },
  { nombre: 'Coca Cola', precio: 5000, activo: true },
  { nombre: 'Soda', precio: 5000, activo: true },
  { nombre: 'Gatorade', precio: 7000, activo: true },
  { nombre: 'Electrolit', precio: 12000, activo: true },
  { nombre: 'Redbull', precio: 15000, activo: true },
  { nombre: 'Vaso Michelado', precio: 3000, activo: true },
  { nombre: 'Bombon', precio: 1000, activo: true },
  { nombre: 'Detodito', precio: 7000, activo: true },
  { nombre: 'Mani', precio: 3000, activo: true },
]

const TRABAJADORES = [
  { nombre: 'Gabriel', color: '#FF6B35', avatar: 'GA', activo: true },
  { nombre: 'Carlos', color: '#4ECDC4', avatar: 'CA', activo: true },
  { nombre: 'Loraine', color: '#FFE66D', avatar: 'LO', activo: true },
  { nombre: 'Luis', color: '#A8E6CF', avatar: 'LU', activo: true },
  { nombre: 'Barra', color: '#C3B1E1', avatar: 'BA', activo: true },
]

const MESAS = Array.from({ length: 10 }, (_, i) => ({
  numero: i + 1,
  nombre: `Mesa ${i + 1}`,
  estado: 'LIBRE',
}))

export async function seedDatabase() {
  const prodCount = await db.productos.count()
  if (prodCount === 0) {
    await db.productos.bulkAdd(PRODUCTOS)
  }

  const trabCount = await db.trabajadores.count()
  if (trabCount === 0) {
    await db.trabajadores.bulkAdd(TRABAJADORES)
  }

  const mesaCount = await db.mesas.count()
  if (mesaCount === 0) {
    await db.mesas.bulkAdd(MESAS)
  }

  const userCount = await db.users.count()
  if (userCount === 0) {
    const adminHash = await hashPassword('admin')
    const duenoHash = await hashPassword('dueno')
    await db.users.bulkAdd([
      { username: 'admin', passwordHash: adminHash, nombre: 'Administrador', role: 'ADMINISTRADOR', isActive: true },
      { username: 'dueno', passwordHash: duenoHash, nombre: 'Dueño', role: 'DUENO', isActive: true },
    ])
  }
}
