const { TotalHoras50, TotalHoras100 } = require('./libreria');

function toUTC(dateStr) {
  // Recibe string 'YYYY-MM-DD HH:mm' en hora local AR y devuelve Date UTC coherente
  const [d, t] = dateStr.split(' ');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m] = t.split(':').map(Number);
  const local = new Date(Y, M - 1, D, h, m, 0, 0);
  return new Date(local.getTime());
}

function caso(titulo, inicioStr, finStr){
  const inicio = toUTC(inicioStr);
  const fin = toUTC(finStr);
  const [m50, h50] = TotalHoras50(inicio, fin);
  const [m100, h100] = TotalHoras100(inicio, fin);
  console.log(`\n== ${titulo} ==`);
  console.log(`Inicio: ${inicioStr} AR  Fin: ${finStr} AR`);
  console.log(`50% -> ${m50} min (${h50})`);
  console.log(`100% -> ${m100} min (${h100})`);
}

// Caso 1: día hábil 21:59 -> 22:01 (debería contar 1 min 50% y 1 min 100%)
caso('Weekday 21:59→22:01', '2025-08-28 21:59', '2025-08-28 22:01');

// Caso 2: sábado 13:59 → 14:01 (debería contar 1 min 50% y 1 min 100%)
// Nota: 2025-08-30 es sábado
caso('Sábado 13:59→14:01', '2025-08-30 13:59', '2025-08-30 14:01');

// Caso 3: sábado 12:59 → 13:01 (debería contar 1 min 50% y 1 min 100%)
caso('Sábado 12:59→13:01', '2025-08-30 12:59', '2025-08-30 13:01');
