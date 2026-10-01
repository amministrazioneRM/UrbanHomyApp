-- CreateTable
CREATE TABLE "strutture" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "citta" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "eliminato" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "strutture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camere" (
    "id" TEXT NOT NULL,
    "zonaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "camere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oggetti" (
    "id" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "zonaId" TEXT,
    "camereId" TEXT,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "codiceCespite" TEXT NOT NULL,
    "condizione" TEXT NOT NULL,
    "ultimaVerifica" TIMESTAMP(3),

    CONSTRAINT "oggetti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manutenzioni" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "strutturaId" TEXT NOT NULL,
    "zonaId" TEXT,
    "camereId" TEXT,
    "oggettoId" TEXT,
    "titolo" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "priorita" TEXT NOT NULL,
    "stato" TEXT NOT NULL,
    "dataCreazione" TIMESTAMP(3) NOT NULL,
    "scadenza" TIMESTAMP(3) NOT NULL,
    "dataApprovazione" TIMESTAMP(3),
    "assegnatoId" TEXT,
    "assegnatoLibero" TEXT,
    "ricorrenza" JSONB,
    "note" TEXT,
    "notaChiusura" TEXT,
    "foto" TEXT[],

    CONSTRAINT "manutenzioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tempi_registrati" (
    "id" TEXT NOT NULL,
    "manutenzioneId" TEXT NOT NULL,
    "manutentoreId" TEXT NOT NULL,
    "minuti" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "tempi_registrati_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiali" (
    "id" TEXT NOT NULL,
    "manutenzioneId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantita" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "stato" TEXT NOT NULL,

    CONSTRAINT "materiali_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storico_modifiche" (
    "id" TEXT NOT NULL,
    "manutenzioneId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "utenteId" TEXT NOT NULL,
    "dettagli" TEXT[],

    CONSTRAINT "storico_modifiche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ditte" (
    "id" TEXT NOT NULL,
    "ragioneSociale" TEXT NOT NULL,
    "piva" TEXT NOT NULL,
    "indirizzo" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "referente" TEXT,
    "specializzazioni" TEXT[],
    "strutture" TEXT[],
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "dataFineContratto" TIMESTAMP(3),
    "approvatoreId" TEXT,
    "note" TEXT,

    CONSTRAINT "ditte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffe" (
    "id" TEXT NOT NULL,
    "dittaId" TEXT NOT NULL,
    "figuraProfessionaleId" TEXT NOT NULL,
    "tariffaOraria" DECIMAL(10,2) NOT NULL,
    "scadenza" TIMESTAMP(3),

    CONSTRAINT "tariffe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manutentori" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dittaId" TEXT,
    "visibilita" TEXT NOT NULL,
    "figuraProfessionaleId" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "strutture" TEXT[],
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "sostitutoId" TEXT,

    CONSTRAINT "manutentori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "figure_professionali" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "figure_professionali_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zone_strutturaId_idx" ON "zone"("strutturaId");

-- CreateIndex
CREATE INDEX "camere_zonaId_idx" ON "camere"("zonaId");

-- CreateIndex
CREATE INDEX "oggetti_strutturaId_idx" ON "oggetti"("strutturaId");

-- CreateIndex
CREATE INDEX "oggetti_zonaId_idx" ON "oggetti"("zonaId");

-- CreateIndex
CREATE INDEX "oggetti_camereId_idx" ON "oggetti"("camereId");

-- CreateIndex
CREATE INDEX "manutenzioni_strutturaId_idx" ON "manutenzioni"("strutturaId");

-- CreateIndex
CREATE INDEX "manutenzioni_stato_idx" ON "manutenzioni"("stato");

-- CreateIndex
CREATE INDEX "tempi_registrati_manutenzioneId_idx" ON "tempi_registrati"("manutenzioneId");

-- CreateIndex
CREATE INDEX "materiali_manutenzioneId_idx" ON "materiali"("manutenzioneId");

-- CreateIndex
CREATE INDEX "storico_modifiche_manutenzioneId_idx" ON "storico_modifiche"("manutenzioneId");

-- CreateIndex
CREATE INDEX "tariffe_dittaId_idx" ON "tariffe"("dittaId");

-- CreateIndex
CREATE INDEX "manutentori_dittaId_idx" ON "manutentori"("dittaId");

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camere" ADD CONSTRAINT "camere_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oggetti" ADD CONSTRAINT "oggetti_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oggetti" ADD CONSTRAINT "oggetti_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oggetti" ADD CONSTRAINT "oggetti_camereId_fkey" FOREIGN KEY ("camereId") REFERENCES "camere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutenzioni" ADD CONSTRAINT "manutenzioni_strutturaId_fkey" FOREIGN KEY ("strutturaId") REFERENCES "strutture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutenzioni" ADD CONSTRAINT "manutenzioni_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutenzioni" ADD CONSTRAINT "manutenzioni_camereId_fkey" FOREIGN KEY ("camereId") REFERENCES "camere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutenzioni" ADD CONSTRAINT "manutenzioni_oggettoId_fkey" FOREIGN KEY ("oggettoId") REFERENCES "oggetti"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tempi_registrati" ADD CONSTRAINT "tempi_registrati_manutenzioneId_fkey" FOREIGN KEY ("manutenzioneId") REFERENCES "manutenzioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiali" ADD CONSTRAINT "materiali_manutenzioneId_fkey" FOREIGN KEY ("manutenzioneId") REFERENCES "manutenzioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storico_modifiche" ADD CONSTRAINT "storico_modifiche_manutenzioneId_fkey" FOREIGN KEY ("manutenzioneId") REFERENCES "manutenzioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffe" ADD CONSTRAINT "tariffe_dittaId_fkey" FOREIGN KEY ("dittaId") REFERENCES "ditte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffe" ADD CONSTRAINT "tariffe_figuraProfessionaleId_fkey" FOREIGN KEY ("figuraProfessionaleId") REFERENCES "figure_professionali"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutentori" ADD CONSTRAINT "manutentori_dittaId_fkey" FOREIGN KEY ("dittaId") REFERENCES "ditte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutentori" ADD CONSTRAINT "manutentori_figuraProfessionaleId_fkey" FOREIGN KEY ("figuraProfessionaleId") REFERENCES "figure_professionali"("id") ON DELETE SET NULL ON UPDATE CASCADE;
