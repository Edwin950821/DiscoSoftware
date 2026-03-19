-- SI-1: 28 de febrero 2026
INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en)
VALUES ('a0000001-0000-0000-0000-000000000001', 'SI-1', '2026-02-28', 4748000, 4728500, -19500, 75000, 42000, 2629000, 640000, 1090500, 0, 252000, '2026-02-28 23:00:00');

INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales) VALUES
(gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001', 'f1e2f241-04c6-43b2-b327-60adea4500aa', 'Juan', '#FF6B35', 'JU', 961000, 0, 0, 582000, 379000, 0, 0, 0),
(gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001', '028838ee-e2d4-40fc-8781-ae7d854695d2', 'Carlos', '#4ECDC4', 'CA', 725000, 10000, 0, 144000, 0, 563000, 0, 8000),
(gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001', '28d17639-0e3a-4125-9776-47f48312b5b5', 'Loraine', '#FFE66D', 'LO', 974000, 0, 0, 868000, 100000, 0, 0, 6000),
(gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001', '1d069024-5fe0-4d83-a582-a016b9cdb6ae', 'Luis', '#A8E6CF', 'LU', 723000, 0, 0, 439000, 40000, 231000, 0, 13000),
(gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001', '1bdaae20-280f-4eca-9076-9d86bd1d9420', 'Barra', '#FF8FA3', 'BA', 1365000, 65000, 42000, 596000, 121000, 296500, 0, 225000);

-- SI-2: 1 de marzo 2026
INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en)
VALUES ('a0000002-0000-0000-0000-000000000001', 'SI-2', '2026-03-01', 3008000, 3008000, 0, 181000, 45000, 2172000, 21000, 547000, 0, 42000, '2026-03-01 23:00:00');

INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales) VALUES
(gen_random_uuid(), 'a0000002-0000-0000-0000-000000000001', 'f1e2f241-04c6-43b2-b327-60adea4500aa', 'Juan', '#FF6B35', 'JU', 1023000, 0, 0, 1023000, 0, 0, 0, 0),
(gen_random_uuid(), 'a0000002-0000-0000-0000-000000000001', '1d069024-5fe0-4d83-a582-a016b9cdb6ae', 'Luis', '#A8E6CF', 'LU', 1092000, 0, 0, 650000, 0, 442000, 0, 0),
(gen_random_uuid(), 'a0000002-0000-0000-0000-000000000001', '1bdaae20-280f-4eca-9076-9d86bd1d9420', 'Barra', '#FF8FA3', 'BA', 893000, 181000, 45000, 499000, 21000, 105000, 0, 42000);

-- SI-3: 2 de marzo 2026
INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en)
VALUES ('a0000003-0000-0000-0000-000000000001', 'SI-3', '2026-03-02', 3467000, 3445000, -22000, 89000, 489000, 1186000, 1114000, 454000, 0, 113000, '2026-03-02 23:00:00');

INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales) VALUES
(gen_random_uuid(), 'a0000003-0000-0000-0000-000000000001', 'f1e2f241-04c6-43b2-b327-60adea4500aa', 'Juan', '#FF6B35', 'JU', 525000, 0, 0, 278000, 195000, 52000, 0, 0),
(gen_random_uuid(), 'a0000003-0000-0000-0000-000000000001', '28d17639-0e3a-4125-9776-47f48312b5b5', 'Loraine', '#FFE66D', 'LO', 1731000, 70000, 0, 666000, 770000, 220000, 0, 5000),
(gen_random_uuid(), 'a0000003-0000-0000-0000-000000000001', '1bdaae20-280f-4eca-9076-9d86bd1d9420', 'Barra', '#FF8FA3', 'BA', 1211000, 19000, 489000, 242000, 149000, 182000, 0, 108000);

-- SI-6: 9 de marzo 2026
INSERT INTO disco_jornadas (id, sesion, fecha, total_vendido, total_recibido, saldo, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales, creado_en)
VALUES ('a0000006-0000-0000-0000-000000000001', 'SI-6', '2026-03-09', 9576000, 9623500, 47500, 212000, 219000, 5840000, 2037500, 863000, 300000, 152000, '2026-03-09 23:00:00');

INSERT INTO disco_mesero_jornada (id, jornada_id, mesero_id, nombre, color, avatar, total_mesero, cortesias, gastos, pagos_efectivo, pagos_qr, pagos_nequi, pagos_datafono, pagos_vales) VALUES
(gen_random_uuid(), 'a0000006-0000-0000-0000-000000000001', 'f1e2f241-04c6-43b2-b327-60adea4500aa', 'Juan', '#FF6B35', 'JU', 2306000, 0, 0, 1282000, 500000, 190000, 300000, 34000),
(gen_random_uuid(), 'a0000006-0000-0000-0000-000000000001', 'fb5b9fd8-5618-4062-bdbc-d2a68ed58630', 'Eddy', '#C3B1E1', 'ED', 2762000, 0, 0, 1642000, 711000, 409000, 0, 0),
(gen_random_uuid(), 'a0000006-0000-0000-0000-000000000001', '28d17639-0e3a-4125-9776-47f48312b5b5', 'Loraine', '#FFE66D', 'LO', 1229000, 0, 0, 496500, 732500, 0, 0, 0),
(gen_random_uuid(), 'a0000006-0000-0000-0000-000000000001', '1bdaae20-280f-4eca-9076-9d86bd1d9420', 'Barra', '#FF8FA3', 'BA', 3279000, 212000, 219000, 2419500, 94000, 264000, 0, 118000);
