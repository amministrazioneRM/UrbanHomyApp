// Importa le strutture (dimensione BU) da dati-bc/<societa>/strutture.csv nella tabella forecast_bc_strutture.
// Uso: node scripts/import-bc-strutture.mjs "<cartella dati-bc>"   (idempotente: aggiorna le righe esistenti)
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const base = process.argv[2] || process.env.BC_DATI_DIR;
if (!base) {
  console.error('Indica la cartella dati-bc: node scripts/import-bc-strutture.mjs "<cartella>"');
  process.exit(1);
}

const prisma = new PrismaClient();
const now = new Date();
let tot = 0;

for (const societa of fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const file = path.join(base, societa, "strutture.csv");
  if (!fs.existsSync(file)) continue;
  const righe = fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).slice(1);
  for (const riga of righe) {
    const [codice, nome, bloccata] = riga.split(";");
    await prisma.forecastBCStruttura.upsert({
      where: { societa_codice: { societa, codice } },
      create: { id: `BCS-${societa}-${codice}`, societa, codice, nome, bloccata: bloccata === "1", dataImport: now },
      update: { nome, bloccata: bloccata === "1", dataImport: now },
    });
    tot++;
  }
  console.log(`${societa}: ${righe.length} strutture`);
}

console.log(`Totale: ${tot}`);
await prisma.$disconnect();
