/**
 * Seed Admin — crea o aggiorna l'account amministratore locale.
 *
 * Utilizzo:
 *   ADMIN_PASSWORD=<password> npm run seed:admin
 *
 * L'account admin è l'unico che può autenticarsi via POST /api/auth/login
 * con email + password. Tutti gli altri utenti accedono tramite SSO Microsoft.
 */

import bcrypt from "bcryptjs";
import prisma from "./prisma.js";

const ADMIN_EMAIL = "admin@urbanhomy.it";
const ADMIN_NOME = "Amministratore";
const SALT_ROUNDS = 12;

async function seedAdmin() {
  const rawPassword = process.env.ADMIN_PASSWORD;
  if (!rawPassword) {
    console.error("Errore: variabile d'ambiente ADMIN_PASSWORD non impostata.");
    console.error("Utilizzo: ADMIN_PASSWORD=<password> npm run seed:admin");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(rawPassword, SALT_ROUNDS);

  const existing = await prisma.utentiAccount.findFirst({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    await prisma.utentiAccount.update({
      where: { id: existing.id },
      data: {
        password: hashedPassword,
        ruoloGlobale: "Amministratore",
      },
    });
    console.log(`Account admin aggiornato: ${ADMIN_EMAIL}`);
  } else {
    await prisma.utentiAccount.create({
      data: {
        id: "ACC-ADMIN",
        nome: ADMIN_NOME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        ruoloGlobale: "Amministratore",
        accessi: "{}",
      },
    });
    console.log(`Account admin creato: ${ADMIN_EMAIL}`);
  }

  await prisma.$disconnect();
}

seedAdmin().catch((err) => {
  console.error("Seed fallito:", err);
  prisma.$disconnect();
  process.exit(1);
});
