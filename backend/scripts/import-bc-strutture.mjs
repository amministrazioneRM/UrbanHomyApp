// Importa le BU (dimensione BU di Business Central) da dati-bc/<societa>/strutture.csv nella tabella forecast_bc_strutture.
// Le BU sono le stesse in tutte le società: ogni codice viene salvato una sola volta.
// Uso: node scripts/import-bc-strutture.mjs "<cartella dati-bc>"   (idempotente: aggiorna le righe esistenti)
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const base = process.argv[2] || process.env.BC_DATI_DIR;
if (!base) {
  console.error('Indica la cartella dati-bc: node scripts/import-bc-strutture.mjs "<cartella>"');
  process.exit(1);
}

const bu = new Map();
for (const dir of fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const file = path.join(base, dir, "strutture.csv");
  if (!fs.existsSync(file)) continue;
  const righe = fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).slice(1);
  for (const riga of righe) {
    const [codice, nome] = riga.split(";");
    bu.set(codice, nome);
  }
}

const prisma = new PrismaClient();
const now = new Date();
for (const [codice, nome] of bu) {
  await prisma.forecastBCStruttura.upsert({
    where: { codice },
    create: { id: `BCS-${codice}`, codice, nome, dataImport: now },
    update: { nome, dataImport: now },
  });
}
console.log(`BU importate: ${bu.size}`);

// Tipo attività (dimensione TIPO-AT): unione dei codici di tutte le società, a parità di codice vale la prima (urban-homy per prima).
const tipi = new Map();
const dirs = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort((a, b) => (a === "urban-homy" ? -1 : b === "urban-homy" ? 1 : a.localeCompare(b)));
for (const dir of dirs) {
  const file = path.join(base, dir, "tipi_attivita.csv");
  if (!fs.existsSync(file)) continue;
  const righe = fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).slice(1);
  for (const riga of righe) {
    const [dimensione, codice, nome] = riga.split(";");
    if (dimensione === "TIPO-AT" && !tipi.has(codice)) tipi.set(codice, nome);
  }
}
for (const [codice, nome] of tipi) {
  await prisma.forecastBCTipoAttivita.upsert({
    where: { codice },
    create: { id: `BCT-${codice}`, codice, nome, dataImport: now },
    update: { nome, dataImport: now },
  });
}
console.log(`Tipi attività importati: ${tipi.size}`);
await prisma.$disconnect();
