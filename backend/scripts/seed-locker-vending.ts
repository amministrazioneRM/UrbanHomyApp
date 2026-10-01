/* Seed statico per Baggy Locker e Vending Machine.
   Legge i dati direttamente dai file App.jsx copiati in /tmp/
   (usati quando i sorgenti frontend non sono nel container). */
import { PrismaClient } from "@prisma/client";
import { extractSeed } from "./extract-seed.js";

const prisma = new PrismaClient();

function withDates(rows: unknown[], fields: string[]): unknown[] {
  return (rows as Record<string, unknown>[]).map((r) => {
    const out = { ...r };
    for (const f of fields) if (out[f]) out[f] = new Date((out[f] as string) + "T00:00:00");
    return out;
  });
}

async function seedLocker(): Promise<void> {
  const file = "/tmp/locker-App.jsx";
  const seedStrutture = extractSeed(file, "seedStrutture");
  const seedOrdini = withDates(extractSeed(file, "seedOrdini"), ["dataOrdine", "inizio", "fine"]);

  await prisma.lockerVendita.deleteMany();
  await prisma.lockerLocale.deleteMany();
  await prisma.lockerOrdine.deleteMany();
  await prisma.lockerStruttura.deleteMany();

  await prisma.lockerStruttura.createMany({ data: seedStrutture as never[] });
  await prisma.lockerOrdine.createMany({ data: seedOrdini as never[] });
  console.log(`Locker: ${seedStrutture.length} strutture, ${seedOrdini.length} ordini`);
}

async function seedVending(): Promise<void> {
  const file = "/tmp/vending-App.jsx";
  const seedStrutture = extractSeed(file, "seedStrutture");
  const seedMacchine = extractSeed(file, "seedMacchine");
  const seedVendite = withDates(extractSeed(file, "seedVendite"), ["data"]);

  await prisma.vendingVendita.deleteMany();
  await prisma.vendingMacchina.deleteMany();
  await prisma.vendingStruttura.deleteMany();

  await prisma.vendingStruttura.createMany({ data: seedStrutture as never[] });
  await prisma.vendingMacchina.createMany({ data: seedMacchine as never[] });
  await prisma.vendingVendita.createMany({ data: seedVendite as never[] });
  console.log(`Vending: ${seedStrutture.length} strutture, ${seedMacchine.length} macchine, ${seedVendite.length} vendite`);
}

async function main(): Promise<void> {
  await seedLocker();
  await seedVending();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
