-- CreateTable
CREATE TABLE "utenti_accounts" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "ruoloGlobale" TEXT NOT NULL,
    "accessi" JSONB NOT NULL,

    CONSTRAINT "utenti_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utenti_ruoli" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bloccato" BOOLEAN NOT NULL DEFAULT false,
    "permessi" JSONB NOT NULL,

    CONSTRAINT "utenti_ruoli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utenti_sostituti" (
    "id" TEXT NOT NULL,
    "titolareId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "sostitutoId" TEXT NOT NULL,
    "dataInizio" TIMESTAMP(3) NOT NULL,
    "dataFine" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "utenti_sostituti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utenti_sedi" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "citta" TEXT,
    "indirizzo" TEXT,
    "attiva" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "utenti_sedi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_strutture" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "ticket_strutture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_utenti" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "reparto" TEXT NOT NULL,

    CONSTRAINT "ticket_utenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "reparto" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "priorita" TEXT NOT NULL,
    "stato" TEXT NOT NULL,
    "dataCreazione" TIMESTAMP(3) NOT NULL,
    "scadenza" TIMESTAMP(3) NOT NULL,
    "richiedente" TEXT,
    "note" TEXT,
    "foto" TEXT[],

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locker_strutture" (
    "id" TEXT NOT NULL,
    "sedeCentraleId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "attiva" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "locker_strutture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locker_ordini" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "dataOrdine" TIMESTAMP(3) NOT NULL,
    "oraOrdine" TEXT NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "oraInizio" TEXT NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "oraFine" TEXT NOT NULL,
    "prezzo" DECIMAL(10,2) NOT NULL,
    "stato" TEXT NOT NULL,
    "numArmadio" INTEGER NOT NULL,
    "tipologia" TEXT NOT NULL,
    "provenienza" TEXT NOT NULL,

    CONSTRAINT "locker_ordini_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locker_locali" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "conteggi" JSONB NOT NULL,

    CONSTRAINT "locker_locali_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locker_vendite" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "ora" TEXT NOT NULL,
    "prodotto" TEXT NOT NULL,
    "quantita" INTEGER NOT NULL,
    "prezzoUnitario" DECIMAL(10,2) NOT NULL,
    "metodoPagamento" TEXT NOT NULL,

    CONSTRAINT "locker_vendite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vending_strutture" (
    "id" TEXT NOT NULL,
    "sedeCentraleId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "attiva" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vending_strutture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vending_macchine" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "attiva" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vending_macchine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vending_vendite" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "macchinaId" TEXT,
    "macchinaNome" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "ora" TEXT NOT NULL,
    "prodotto" TEXT NOT NULL,
    "quantita" INTEGER NOT NULL,
    "prezzoUnitario" DECIMAL(10,2) NOT NULL,
    "metodoPagamento" TEXT NOT NULL,
    "stato" TEXT NOT NULL,

    CONSTRAINT "vending_vendite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_utenti_strutturaId_idx" ON "ticket_utenti"("strutturaId");

-- CreateIndex
CREATE INDEX "tickets_strutturaId_idx" ON "tickets"("strutturaId");

-- CreateIndex
CREATE INDEX "locker_ordini_strutturaId_idx" ON "locker_ordini"("strutturaId");

-- CreateIndex
CREATE INDEX "locker_locali_strutturaId_idx" ON "locker_locali"("strutturaId");

-- CreateIndex
CREATE INDEX "locker_vendite_strutturaId_idx" ON "locker_vendite"("strutturaId");

-- CreateIndex
CREATE INDEX "vending_macchine_strutturaId_idx" ON "vending_macchine"("strutturaId");

-- CreateIndex
CREATE INDEX "vending_vendite_strutturaId_idx" ON "vending_vendite"("strutturaId");

-- CreateIndex
CREATE INDEX "vending_vendite_macchinaId_idx" ON "vending_vendite"("macchinaId");

-- AddForeignKey
ALTER TABLE "ticket_utenti" ADD CONSTRAINT "ticket_utenti_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "ticket_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "ticket_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locker_ordini" ADD CONSTRAINT "locker_ordini_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "locker_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locker_locali" ADD CONSTRAINT "locker_locali_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "locker_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locker_vendite" ADD CONSTRAINT "locker_vendite_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "locker_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vending_macchine" ADD CONSTRAINT "vending_macchine_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "vending_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vending_vendite" ADD CONSTRAINT "vending_vendite_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "vending_strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vending_vendite" ADD CONSTRAINT "vending_vendite_macchinaId_fkey" FOREIGN KEY ("macchinaId") REFERENCES "vending_macchine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
