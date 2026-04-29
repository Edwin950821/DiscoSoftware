-- ============================================================
-- MOCK DATA — JORNADAS DE PRUEBA PARA VALIDAR VISTA SUPER
-- Crea meseros + 8 jornadas distribuidas en los últimos 35 días
-- (1 en mes anterior, 7 en mes actual) para validar:
--   * Mes actual vs mes anterior
--   * Tendencia 30 días
--   * Top productos
--   * Top meseros
--   * Distribución de pagos
-- IMPORTANTE: borra los datos cuando empiece la operación real:
--   DELETE FROM disco_mesero_jornada WHERE jornada_id IN (SELECT id FROM disco_jornadas WHERE sesion LIKE 'SI-%' OR sesion LIKE 'BL-%');
--   DELETE FROM disco_jornadas WHERE sesion LIKE 'SI-%' OR sesion LIKE 'BL-%';
-- ============================================================

DO $$
DECLARE
    disco_id  UUID := (SELECT id FROM negocios WHERE slug = 'discoteca-baranoa');
    billar_id UUID := (SELECT id FROM negocios WHERE slug = 'billar');

    -- Meseros Discoteca
    m_gabriel  UUID := gen_random_uuid();
    m_carlos   UUID := gen_random_uuid();
    m_loraine  UUID := gen_random_uuid();
    m_luis     UUID := gen_random_uuid();
    m_barra    UUID := gen_random_uuid();
    -- Meseros Billar
    m_billar1  UUID := gen_random_uuid();
    m_billar2  UUID := gen_random_uuid();

    j UUID;
BEGIN
    -- ============================================================
    -- MESEROS — Discoteca (5)
    -- ============================================================
    INSERT INTO disco_meseros (id, nombre, color, avatar, activo, creado_en, negocio_id) VALUES
      (m_gabriel,  'Gabriel',  '#FF6B35', 'GA', true, NOW(), disco_id),
      (m_carlos,   'Carlos',   '#4ECDC4', 'CA', true, NOW(), disco_id),
      (m_loraine,  'Loraine',  '#FFE66D', 'LO', true, NOW(), disco_id),
      (m_luis,     'Luis',     '#A8E6CF', 'LU', true, NOW(), disco_id),
      (m_barra,    'Barra',    '#C3B1E1', 'BA', true, NOW(), disco_id);

    -- MESEROS — Billar (2)
    INSERT INTO disco_meseros (id, nombre, color, avatar, activo, creado_en, negocio_id) VALUES
      (m_billar1, 'Mesero 1', '#FF6B35', 'M1', true, NOW(), billar_id),
      (m_billar2, 'Mesero 2', '#4ECDC4', 'M2', true, NOW(), billar_id);

    -- ============================================================
    -- JORNADA 1 — Discoteca, mes ANTERIOR (2026-03-30)
    -- 2 meseros, total $1.5M, cuadre perfecto
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'SI-1', '2026-03-30', 1500000, 1500000, 0, 30000, 20000,
        900000, 350000, 150000, 50000, 50000, '2026-03-30 23:00:00', disco_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_gabriel, 'Gabriel', '#FF6B35', 'GA', 800000,
        15000, 10000, 500000, 200000, 80000, 20000, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":80,"total":400000},{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":40,"total":240000},{"productoId":"","nombre":"Antioqueño Litro Tapa Verde","precioUnitario":150000,"cantidad":1,"total":150000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":2,"total":10000}]',
        disco_id),
      (gen_random_uuid(), j, m_carlos, 'Carlos', '#4ECDC4', 'CA', 700000,
        15000, 10000, 400000, 150000, 70000, 30000, 50000,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":50,"total":250000},{"productoId":"","nombre":"Old Parr 1 Litro","precioUnitario":320000,"cantidad":1,"total":320000},{"productoId":"","nombre":"Redbull","precioUnitario":15000,"cantidad":8,"total":120000},{"productoId":"","nombre":"Detodito","precioUnitario":7000,"cantidad":1,"total":10000}]',
        disco_id);

    -- ============================================================
    -- JORNADA 2 — Discoteca (2026-04-06)
    -- 3 meseros, total $1.8M
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'SI-2', '2026-04-06', 1800000, 1810000, 10000, 25000, 35000,
        1100000, 400000, 200000, 60000, 50000, '2026-04-06 23:00:00', disco_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_gabriel, 'Gabriel', '#FF6B35', 'GA', 700000,
        10000, 10000, 450000, 150000, 70000, 30000, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":60,"total":300000},{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":50,"total":300000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":20,"total":100000}]',
        disco_id),
      (gen_random_uuid(), j, m_carlos, 'Carlos', '#4ECDC4', 'CA', 600000,
        10000, 15000, 400000, 130000, 50000, 20000, 0,
        '[{"productoId":"","nombre":"Aguila Light","precioUnitario":5000,"cantidad":80,"total":400000},{"productoId":"","nombre":"Smirnoff Ice","precioUnitario":14000,"cantidad":10,"total":140000},{"productoId":"","nombre":"Bombon","precioUnitario":1000,"cantidad":60,"total":60000}]',
        disco_id),
      (gen_random_uuid(), j, m_loraine, 'Loraine', '#FFE66D', 'LO', 500000,
        5000, 10000, 250000, 120000, 80000, 10000, 50000,
        '[{"productoId":"","nombre":"Antioqueño 750 Ml Verde","precioUnitario":120000,"cantidad":2,"total":240000},{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":40,"total":200000},{"productoId":"","nombre":"Mani","precioUnitario":3000,"cantidad":20,"total":60000}]',
        disco_id);

    -- ============================================================
    -- JORNADA 3 — Discoteca (2026-04-13)
    -- 3 meseros, total $2.1M
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'SI-3', '2026-04-13', 2100000, 2090000, -10000, 40000, 30000,
        1300000, 450000, 220000, 70000, 50000, '2026-04-13 23:00:00', disco_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_gabriel, 'Gabriel', '#FF6B35', 'GA', 850000,
        15000, 10000, 550000, 180000, 90000, 30000, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":100,"total":500000},{"productoId":"","nombre":"Buchanans Deluxe 750 Ml","precioUnitario":280000,"cantidad":1,"total":280000},{"productoId":"","nombre":"Redbull","precioUnitario":15000,"cantidad":4,"total":60000}]',
        disco_id),
      (gen_random_uuid(), j, m_carlos, 'Carlos', '#4ECDC4', 'CA', 750000,
        15000, 10000, 450000, 170000, 80000, 20000, 30000,
        '[{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":80,"total":480000},{"productoId":"","nombre":"Antioqueño 750 Ml Verde","precioUnitario":120000,"cantidad":2,"total":240000}]',
        disco_id),
      (gen_random_uuid(), j, m_luis, 'Luis', '#A8E6CF', 'LU', 500000,
        10000, 10000, 300000, 100000, 50000, 20000, 20000,
        '[{"productoId":"","nombre":"Aguila Light","precioUnitario":5000,"cantidad":60,"total":300000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":20,"total":100000},{"productoId":"","nombre":"Detodito","precioUnitario":7000,"cantidad":14,"total":100000}]',
        disco_id);

    -- ============================================================
    -- JORNADA 4 — Discoteca (2026-04-20)
    -- 3 meseros, total $1.7M
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'SI-4', '2026-04-20', 1700000, 1700000, 0, 20000, 30000,
        1050000, 380000, 180000, 50000, 40000, '2026-04-20 23:00:00', disco_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_loraine, 'Loraine', '#FFE66D', 'LO', 700000,
        10000, 10000, 450000, 150000, 70000, 20000, 10000,
        '[{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":70,"total":420000},{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":40,"total":200000},{"productoId":"","nombre":"Mani","precioUnitario":3000,"cantidad":27,"total":80000}]',
        disco_id),
      (gen_random_uuid(), j, m_luis, 'Luis', '#A8E6CF', 'LU', 600000,
        5000, 10000, 350000, 130000, 60000, 30000, 30000,
        '[{"productoId":"","nombre":"Aguila Light","precioUnitario":5000,"cantidad":80,"total":400000},{"productoId":"","nombre":"Old Parr 1 Litro","precioUnitario":320000,"cantidad":1,"total":200000}]',
        disco_id),
      (gen_random_uuid(), j, m_barra, 'Barra', '#C3B1E1', 'BA', 400000,
        5000, 10000, 250000, 100000, 50000, 0, 0,
        '[{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":40,"total":200000},{"productoId":"","nombre":"Bombon","precioUnitario":1000,"cantidad":80,"total":80000},{"productoId":"","nombre":"Vaso Michelado","precioUnitario":3000,"cantidad":40,"total":120000}]',
        disco_id);

    -- ============================================================
    -- JORNADA 5 — Discoteca (2026-04-24)
    -- 4 meseros, total $2.5M (mejor jornada)
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'SI-5', '2026-04-24', 2500000, 2510000, 10000, 50000, 40000,
        1500000, 550000, 280000, 90000, 90000, '2026-04-24 23:00:00', disco_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_gabriel, 'Gabriel', '#FF6B35', 'GA', 800000,
        15000, 10000, 500000, 180000, 90000, 30000, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":80,"total":400000},{"productoId":"","nombre":"Buchanans Master 750 Ml","precioUnitario":320000,"cantidad":1,"total":320000},{"productoId":"","nombre":"Redbull","precioUnitario":15000,"cantidad":5,"total":80000}]',
        disco_id),
      (gen_random_uuid(), j, m_carlos, 'Carlos', '#4ECDC4', 'CA', 700000,
        15000, 10000, 450000, 150000, 60000, 20000, 20000,
        '[{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":100,"total":600000},{"productoId":"","nombre":"Detodito","precioUnitario":7000,"cantidad":14,"total":100000}]',
        disco_id),
      (gen_random_uuid(), j, m_loraine, 'Loraine', '#FFE66D', 'LO', 600000,
        10000, 10000, 350000, 130000, 80000, 20000, 20000,
        '[{"productoId":"","nombre":"Aguila Light","precioUnitario":5000,"cantidad":80,"total":400000},{"productoId":"","nombre":"Smirnoff Ice","precioUnitario":14000,"cantidad":10,"total":140000},{"productoId":"","nombre":"Mani","precioUnitario":3000,"cantidad":20,"total":60000}]',
        disco_id),
      (gen_random_uuid(), j, m_luis, 'Luis', '#A8E6CF', 'LU', 400000,
        10000, 10000, 200000, 90000, 50000, 20000, 50000,
        '[{"productoId":"","nombre":"Antioqueño 750 Ml Verde","precioUnitario":120000,"cantidad":2,"total":240000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":20,"total":100000},{"productoId":"","nombre":"Bombon","precioUnitario":1000,"cantidad":60,"total":60000}]',
        disco_id);

    -- ============================================================
    -- JORNADA 6 — Discoteca (2026-04-26)
    -- 5 meseros, total $3.0M (jornada récord ayer)
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'SI-6', '2026-04-26', 3000000, 2990000, -10000, 60000, 40000,
        1800000, 650000, 350000, 100000, 90000, '2026-04-26 23:00:00', disco_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_gabriel, 'Gabriel', '#FF6B35', 'GA', 800000,
        15000, 10000, 500000, 180000, 90000, 30000, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":100,"total":500000},{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":50,"total":300000}]',
        disco_id),
      (gen_random_uuid(), j, m_carlos, 'Carlos', '#4ECDC4', 'CA', 700000,
        15000, 10000, 400000, 170000, 80000, 30000, 20000,
        '[{"productoId":"","nombre":"Aguila Light","precioUnitario":5000,"cantidad":100,"total":500000},{"productoId":"","nombre":"Smirnoff Ice","precioUnitario":14000,"cantidad":14,"total":200000}]',
        disco_id),
      (gen_random_uuid(), j, m_loraine, 'Loraine', '#FFE66D', 'LO', 600000,
        10000, 10000, 350000, 130000, 80000, 20000, 20000,
        '[{"productoId":"","nombre":"Old Parr 1 Litro","precioUnitario":320000,"cantidad":1,"total":320000},{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":40,"total":240000},{"productoId":"","nombre":"Mani","precioUnitario":3000,"cantidad":13,"total":40000}]',
        disco_id),
      (gen_random_uuid(), j, m_luis, 'Luis', '#A8E6CF', 'LU', 500000,
        10000, 5000, 300000, 100000, 60000, 20000, 20000,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":80,"total":400000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":20,"total":100000}]',
        disco_id),
      (gen_random_uuid(), j, m_barra, 'Barra', '#C3B1E1', 'BA', 400000,
        10000, 5000, 250000, 70000, 40000, 0, 30000,
        '[{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":40,"total":200000},{"productoId":"","nombre":"Vaso Michelado","precioUnitario":3000,"cantidad":40,"total":120000},{"productoId":"","nombre":"Bombon","precioUnitario":1000,"cantidad":80,"total":80000}]',
        disco_id);

    -- ============================================================
    -- JORNADA 7 — Billar (2026-04-13)
    -- 1 mesero, total $250K
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'BL-1', '2026-04-13', 250000, 250000, 0, 5000, 5000,
        180000, 50000, 20000, 0, 0, '2026-04-13 23:00:00', billar_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_billar1, 'Mesero 1', '#FF6B35', 'M1', 250000,
        5000, 5000, 180000, 50000, 20000, 0, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":30,"total":150000},{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":10,"total":60000},{"productoId":"","nombre":"Mani","precioUnitario":3000,"cantidad":13,"total":40000}]',
        billar_id);

    -- ============================================================
    -- JORNADA 8 — Billar (2026-04-20)
    -- 2 meseros, total $450K
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'BL-2', '2026-04-20', 450000, 450000, 0, 8000, 7000,
        300000, 100000, 40000, 0, 10000, '2026-04-20 23:00:00', billar_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_billar1, 'Mesero 1', '#FF6B35', 'M1', 250000,
        4000, 4000, 170000, 60000, 20000, 0, 0,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":40,"total":200000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":10,"total":50000}]',
        billar_id),
      (gen_random_uuid(), j, m_billar2, 'Mesero 2', '#4ECDC4', 'M2', 200000,
        4000, 3000, 130000, 40000, 20000, 0, 10000,
        '[{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":25,"total":150000},{"productoId":"","nombre":"Detodito","precioUnitario":7000,"cantidad":7,"total":50000}]',
        billar_id);

    -- ============================================================
    -- JORNADA 9 — Billar (2026-04-26)
    -- 2 meseros, total $700K (jornada récord ayer)
    -- ============================================================
    j := gen_random_uuid();
    INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos,
        pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en, negocio_id)
    VALUES (j, 'BL-3', '2026-04-26', 700000, 700000, 0, 10000, 10000,
        450000, 170000, 60000, 0, 20000, '2026-04-26 23:00:00', billar_id);
    INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero,
        cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales,
        lineas_detalle, negocio_id) VALUES
      (gen_random_uuid(), j, m_billar1, 'Mesero 1', '#FF6B35', 'M1', 400000,
        5000, 5000, 270000, 90000, 30000, 0, 10000,
        '[{"productoId":"","nombre":"Aguila Negra 330ml","precioUnitario":5000,"cantidad":60,"total":300000},{"productoId":"","nombre":"Heineken","precioUnitario":6000,"cantidad":15,"total":90000},{"productoId":"","nombre":"Mani","precioUnitario":3000,"cantidad":3,"total":10000}]',
        billar_id),
      (gen_random_uuid(), j, m_billar2, 'Mesero 2', '#4ECDC4', 'M2', 300000,
        5000, 5000, 180000, 80000, 30000, 0, 10000,
        '[{"productoId":"","nombre":"Aguila Light","precioUnitario":5000,"cantidad":40,"total":200000},{"productoId":"","nombre":"Coca Cola","precioUnitario":5000,"cantidad":15,"total":75000},{"productoId":"","nombre":"Bombon","precioUnitario":1000,"cantidad":25,"total":25000}]',
        billar_id);

END $$;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT n.nombre AS negocio, COUNT(j.id) AS jornadas, SUM(j.total_vendido) AS total_vendido
FROM negocios n
LEFT JOIN disco_jornadas j ON j.negocio_id = n.id
GROUP BY n.id, n.nombre
ORDER BY n.creado_en;
