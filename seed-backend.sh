#!/bin/bash
# Script para cargar datos iniciales en el backend de Render
API="https://monastery-backend.onrender.com/api/disco/management"

echo "=== Cargando productos ==="

PRODUCTOS=(
  '{"nombre":"Antioqueño Litro Tapa Verde","precio":150000,"activo":true}'
  '{"nombre":"Antioqueño 750 Ml Verde","precio":120000,"activo":true}'
  '{"nombre":"Antioqueño 750 Ml Azul","precio":120000,"activo":true}'
  '{"nombre":"Antioqueño 750 Ml Amarillo","precio":120000,"activo":true}'
  '{"nombre":"Antioqueño Litro Amarillo","precio":150000,"activo":true}'
  '{"nombre":"Media Aguardiente","precio":70000,"activo":true}'
  '{"nombre":"Medellin Pipona","precio":130000,"activo":true}'
  '{"nombre":"Medellin Litro","precio":160000,"activo":true}'
  '{"nombre":"Medellin Media","precio":70000,"activo":true}'
  '{"nombre":"Medellin 5 Años","precio":160000,"activo":true}'
  '{"nombre":"Medellin 8 Años","precio":180000,"activo":true}'
  '{"nombre":"Old Parr 1 Litro","precio":320000,"activo":true}'
  '{"nombre":"Old Parr 750 Ml","precio":280000,"activo":true}'
  '{"nombre":"Sello Rojo 1lt","precio":200000,"activo":true}'
  '{"nombre":"Sello Rojo 700 Ml","precio":170000,"activo":true}'
  '{"nombre":"Sello Negro 700 Ml","precio":260000,"activo":true}'
  '{"nombre":"Buchanans Deluxe 750 Ml","precio":280000,"activo":true}'
  '{"nombre":"Buchanans Deluxe 375 Ml","precio":160000,"activo":true}'
  '{"nombre":"Buchanans Master 750 Ml","precio":320000,"activo":true}'
  '{"nombre":"Buchanans 18 Años","precio":500000,"activo":true}'
  '{"nombre":"Black & White 700 Ml","precio":110000,"activo":true}'
  '{"nombre":"Tequila Jose Cuervo 700 Ml","precio":230000,"activo":true}'
  '{"nombre":"Don Julio Reposado","precio":420000,"activo":true}'
  '{"nombre":"Don Julio 70","precio":520000,"activo":true}'
  '{"nombre":"Smirnoff Lulo","precio":140000,"activo":true}'
  '{"nombre":"Aguila Negra 330ml","precio":5000,"activo":true}'
  '{"nombre":"Aguila Light","precio":5000,"activo":true}'
  '{"nombre":"Costeñita 330ml","precio":5000,"activo":true}'
  '{"nombre":"Coronita 355ml","precio":6000,"activo":true}'
  '{"nombre":"Club Colombia","precio":6000,"activo":true}'
  '{"nombre":"Heineken","precio":6000,"activo":true}'
  '{"nombre":"Budweiser","precio":6000,"activo":true}'
  '{"nombre":"Stella Artois","precio":10000,"activo":true}'
  '{"nombre":"Smirnoff Ice","precio":14000,"activo":true}'
  '{"nombre":"Agua","precio":5000,"activo":true}'
  '{"nombre":"Coca Cola","precio":5000,"activo":true}'
  '{"nombre":"Soda","precio":5000,"activo":true}'
  '{"nombre":"Gatorade","precio":7000,"activo":true}'
  '{"nombre":"Electrolit","precio":12000,"activo":true}'
  '{"nombre":"Redbull","precio":15000,"activo":true}'
  '{"nombre":"Bonfiest","precio":6000,"activo":true}'
  '{"nombre":"Vaso Michelado","precio":3000,"activo":true}'
  '{"nombre":"Bombon","precio":1000,"activo":true}'
  '{"nombre":"Detodito","precio":7000,"activo":true}'
  '{"nombre":"Mani","precio":3000,"activo":true}'
  '{"nombre":"Chicle","precio":2000,"activo":true}'
  '{"nombre":"Vaper","precio":60000,"activo":true}'
)

for p in "${PRODUCTOS[@]}"; do
  echo -n "  $(echo $p | grep -o '"nombre":"[^"]*"' | head -1)... "
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/productos" -H "Content-Type: application/json" -d "$p")
  echo "$code"
done

echo ""
echo "=== Cargando meseros ==="

MESEROS=(
  '{"nombre":"Gabriel","color":"#FF6B35","avatar":"GA","activo":true}'
  '{"nombre":"Carlos","color":"#4ECDC4","avatar":"CA","activo":true}'
  '{"nombre":"Loraine","color":"#FFE66D","avatar":"LO","activo":true}'
  '{"nombre":"Luis","color":"#A8E6CF","avatar":"LU","activo":true}'
  '{"nombre":"Barra","color":"#C3B1E1","avatar":"BA","activo":true}'
)

for m in "${MESEROS[@]}"; do
  echo -n "  $(echo $m | grep -o '"nombre":"[^"]*"' | head -1)... "
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/meseros" -H "Content-Type: application/json" -d "$m")
  echo "$code"
done

echo ""
echo "=== Cargando mesas ==="

for i in $(seq 1 10); do
  echo -n "  Mesa $i... "
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/mesas" -H "Content-Type: application/json" -d "{\"numero\":$i,\"nombre\":\"Mesa $i\"}")
  echo "$code"
done

echo ""
echo "=== Listo ==="
