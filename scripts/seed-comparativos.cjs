const http = require('http');

const prodMap = {
  'Aguila Negra': 'b6395bd6-2645-409f-ab69-daa5381ac5c8',
  'Aguila Light': 'a03f33a7-4cb7-4d5c-bcae-169a33098fef',
  'Costeñita': 'a2099b66-38e1-4a62-8853-65093430888e',
  'Budweiser': 'dca6ac90-36d7-423e-9759-6da8d6f0a6bc',
  'Coronita': '797d3146-9ada-458a-9480-33417a80fb27',
  'Club Colombia': 'abdfe082-2d89-45c4-b13e-4392c84f0748',
  'Heinekeen': '00954b24-44d2-4841-8b90-6561713bea34',
  'Stella Artois': '74543805-8314-4004-b7c3-e39c43239a62',
  'Smirnoff': '9d82e723-8f04-41b4-bbf7-2e3afa2c2390',
  'Agua': '27f1e7b4-84da-493c-a0fd-608f0d05f2a6',
  'Coca Cola': 'a188558f-3f28-49e2-9b6d-ab19c6755bfd',
  'Soda': 'b255650d-3c49-4b8d-82de-d098cd3f7e20',
  'Gatorade': '6a521c5e-a325-4f1c-a27f-78d480d2a3ac',
  'Redbull': '31e31f6f-2698-47de-85a8-7e9ed14cfca4',
  'Electrolit': '468ec508-0bf5-4a50-8b34-fb2b9924d02f',
  'Bonfiest': '468ec508-0bf5-4a50-8b34-fb2b9924d02f',
  'Mani': 'd16871e1-5048-4119-88f1-d5e787e49e2d',
  'Detodito': 'b4f77fb2-04ba-4195-83a9-3eb104df9530',
  'Bombon': '72c4284d-396f-4c7a-9202-3ddb73d447fe',
  'Chicle': '72c4284d-396f-4c7a-9202-3ddb73d447fe',
  'Vaper': 'dca6ac90-36d7-423e-9759-6da8d6f0a6bc',
  'Vaso Michelado': '3c5323a3-f530-4309-924d-01a2a7039171',
  'Antioqueño Litro Tapa Verde': 'ce00a5b7-db23-4a1f-80f6-c712e0b20f84',
  'Antioqueño 750 Ml Verde': 'e495a094-12aa-48a9-bf6b-7bf0f264c270',
  'Antioqueño 750 Ml Azul': 'e495a094-12aa-48a9-bf6b-7bf0f264c270',
  'Antioqueño 750 Ml Amarillo': 'bde59b3c-e782-4f93-b8ae-9a35da11b917',
  'Antioqueño Litro Amarillo': 'bde59b3c-e782-4f93-b8ae-9a35da11b917',
  'Media Aguardiente': 'ce00a5b7-db23-4a1f-80f6-c712e0b20f84',
  'Medellin Pipona': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Medellin Litro': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Medellin Media': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Medellin 5 Años': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Medellin 8 Años': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Old Parr 1litro': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Old Parr 750 Ml': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Sello Rojo 1lt': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Sello Rojo 700 Ml': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Sello Negro 700 Ml': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  "Buchanan's Deluxe 750 Ml": 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  "Buchanan's Deluxe 375 Ml": 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  "Buchanan's Master 750 Ml": 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  "Buchanan's 18 Años": 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Black & White 700 Ml': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Tequilia Jose Cuervo 700 Ml': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Smirnoff Lulo': '9d82e723-8f04-41b4-bbf7-2e3afa2c2390',
  'Don Julio Resposado': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Don Julio 70': 'f4a87146-ad4b-4205-8e9e-a24ab6d9afd0',
  'Corona cero (obsequio)': 'dca6ac90-36d7-423e-9759-6da8d6f0a6bc',
  'Somethin Especial (obsequio)': 'dca6ac90-36d7-423e-9759-6da8d6f0a6bc',
  'Amper (obsequio)': 'dca6ac90-36d7-423e-9759-6da8d6f0a6bc',
};

// Excel data: [nombre, conteo, tiquets]
// Semana 1: 2026-03-07
const sem1 = [
  ['Aguila Negra',285,285],['Aguila Light',25,25],['Costeñita',342,342],['Budweiser',24,24],
  ['Coronita',345,345],['Club Colombia',33,33],['Heinekeen',4,4],['Stella Artois',0,0],
  ['Smirnoff',8,8],['Agua',33,36],['Coca Cola',10,10],['Soda',22,22],
  ['Gatorade',31,32],['Redbull',3,3],['Electrolit',12,12],['Bonfiest',3,3],
  ['Mani',4,5],['Detodito',13,13],['Bombon',44,44],['Chicle',9,9],
  ['Vaper',0,0],['Vaso Michelado',58,58],['Antioqueño Litro Tapa Verde',13,13],
  ['Antioqueño 750 Ml Verde',0,0],['Antioqueño 750 Ml Azul',0,0],['Antioqueño 750 Ml Amarillo',0,0],
  ['Antioqueño Litro Amarillo',2,2],['Media Aguardiente',4,4],['Medellin Pipona',0,0],
  ['Medellin Litro',1,1],['Medellin Media',0,0],['Medellin 5 Años',1,1],['Medellin 8 Años',0,0],
  ['Old Parr 1litro',2,2],['Old Parr 750 Ml',0,0],['Sello Rojo 1lt',0,0],['Sello Rojo 700 Ml',0,0],
  ['Sello Negro 700 Ml',0,0],["Buchanan's Deluxe 750 Ml",1,1],["Buchanan's Deluxe 375 Ml",0,0],
  ["Buchanan's Master 750 Ml",1,1],["Buchanan's 18 Años",0,0],['Black & White 700 Ml',0,0],
  ['Tequilia Jose Cuervo 700 Ml',0,0],['Smirnoff Lulo',1,1],['Don Julio Resposado',0,0],
  ['Don Julio 70',0,0],['Corona cero (obsequio)',0,0],['Somethin Especial (obsequio)',0,0],
  ['Amper (obsequio)',6,6]
];

// Semana 2: 2026-03-14
const sem2 = [
  ['Aguila Negra',292,292],['Aguila Light',32,32],['Costeñita',181,181],['Budweiser',0,0],
  ['Coronita',234,234],['Club Colombia',25,25],['Heinekeen',15,15],['Stella Artois',0,0],
  ['Smirnoff',4,4],['Agua',34,34],['Coca Cola',7,7],['Soda',18,18],
  ['Gatorade',13,13],['Redbull',0,0],['Electrolit',10,10],['Bonfiest',3,3],
  ['Mani',2,2],['Detodito',5,5],['Bombon',18,18],['Chicle',4,4],
  ['Vaper',0,0],['Vaso Michelado',30,30],['Antioqueño Litro Tapa Verde',23,23],
  ['Antioqueño 750 Ml Verde',1,1],['Antioqueño 750 Ml Azul',0,0],['Antioqueño 750 Ml Amarillo',0,0],
  ['Antioqueño Litro Amarillo',0,0],['Media Aguardiente',2,2],['Medellin Pipona',0,0],
  ['Medellin Litro',0,0],['Medellin Media',0,0],['Medellin 5 Años',0,0],['Medellin 8 Años',0,0],
  ['Old Parr 1litro',0,0],['Old Parr 750 Ml',0,0],['Sello Rojo 1lt',0,0],['Sello Rojo 700 Ml',0,0],
  ['Sello Negro 700 Ml',0,0],["Buchanan's Deluxe 750 Ml",0,0],["Buchanan's Deluxe 375 Ml",0,0],
  ["Buchanan's Master 750 Ml",3,3],["Buchanan's 18 Años",0,0],['Black & White 700 Ml',0,0],
  ['Tequilia Jose Cuervo 700 Ml',0,0],['Smirnoff Lulo',0,0],['Don Julio Resposado',0,0],
  ['Don Julio 70',0,0],['Corona cero (obsequio)',0,0],['Somethin Especial (obsequio)',0,0],
  ['Amper (obsequio)',0,0]
];

function buildBody(fecha, data) {
  const lineas = data.map(([nombre, conteo, tiquets]) => ({
    productoId: 0,
    nombre,
    conteo: conteo || 0,
    tiquets: tiquets || 0,
    diferencia: (tiquets || 0) - (conteo || 0)
  }));
  return JSON.stringify({
    fecha,
    lineas,
    totalConteo: lineas.reduce((s, l) => s + l.conteo, 0),
    totalTiquets: lineas.reduce((s, l) => s + l.tiquets, 0)
  });
}

function post(body) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:8081/api/disco/management/comparativos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode !== 201) console.log('Response:', d.substring(0, 300));
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('Creando comparativo semana 1 (2026-03-07)...');
  await post(buildBody('2026-03-07', sem1));
  console.log('Creando comparativo semana 2 (2026-03-14)...');
  await post(buildBody('2026-03-14', sem2));
  console.log('Listo!');
})();
