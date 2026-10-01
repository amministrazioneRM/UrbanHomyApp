/* Una tantum: converte le password in chiaro già presenti in utenti_accounts
   in hash bcrypt. Idempotente — salta le righe già hashate (prefisso $2). */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const accounts = await prisma.utentiAccount.findMany();
  let count = 0;
  for (const account of accounts) {
    if (account.password.startsWith("$2")) continue; // già hashata
    const rounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10) || 10;
    const hash = await bcrypt.hash(account.password, rounds);
    await prisma.utentiAccount.update({ where: { id: account.id }, data: { password: hash } });
    count++;
  }
  console.log(`Password hashate: ${count}/${accounts.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
