import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { bcQuery, bcConfigurato } from "../bc.js";

export function vendingMagazzinoRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // ─── Magazzini ────────────────────────────────────────────────────────────

  router.get("/magazzini", async (_req, res, next) => {
    try {
      const rows = await prisma.vendingMagazzino.findMany({ orderBy: { nome: "asc" } });
      res.json(rows);
    } catch (err) { next(err); }
  });

  router.post("/magazzini", async (req, res, next) => {
    try {
      const { nome, sedeId, note, attivo = true } = req.body as {
        nome: string; sedeId: string; note?: string; attivo?: boolean;
      };
      const row = await prisma.vendingMagazzino.create({
        data: { id: `MAG-${randomUUID()}`, nome, sedeId, note, attivo },
      });
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  router.put("/magazzini/:id", async (req, res, next) => {
    try {
      const row = await prisma.vendingMagazzino.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(row);
    } catch (err) { next(err); }
  });

  router.delete("/magazzini/:id", async (req, res, next) => {
    try {
      await prisma.vendingMagazzino.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ─── Prodotti ─────────────────────────────────────────────────────────────

  router.get("/prodotti", async (_req, res, next) => {
    try {
      const rows = await prisma.vendingProdotto.findMany({ orderBy: { nome: "asc" } });
      res.json(rows);
    } catch (err) { next(err); }
  });

  router.get("/prodotti/barcode/:barcode", async (req, res, next) => {
    try {
      const row = await prisma.vendingProdotto.findUnique({
        where: { barcode: req.params.barcode },
      });
      if (!row) return res.status(404).json({ error: "Prodotto non trovato" });
      res.json(row);
    } catch (err) { next(err); }
  });

  router.post("/prodotti", async (req, res, next) => {
    try {
      const { barcode, nome, unita = "pz", note } = req.body as {
        barcode: string; nome: string; unita?: string; note?: string;
      };
      const row = await prisma.vendingProdotto.create({
        data: { id: `PRD-${randomUUID()}`, barcode, nome, unita, note },
      });
      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  router.put("/prodotti/:id", async (req, res, next) => {
    try {
      const row = await prisma.vendingProdotto.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(row);
    } catch (err) { next(err); }
  });

  // ─── Fornitori ────────────────────────────────────────────────────────────

  router.get("/fornitori", async (req, res, next) => {
    try {
      const soloAbilitati = req.query.soloAbilitati === "1";
      const rows = await prisma.vendingFornitore.findMany({
        where: soloAbilitati ? { abilitatoCarico: true } : undefined,
        orderBy: { ragioneSociale: "asc" },
      });
      res.json(rows);
    } catch (err) { next(err); }
  });

  router.put("/fornitori/:id", async (req, res, next) => {
    try {
      const row = await prisma.vendingFornitore.update({
        where: { id: req.params.id },
        data: { abilitatoCarico: req.body.abilitatoCarico },
      });
      res.json(row);
    } catch (err) { next(err); }
  });

  router.post("/fornitori/sincronizza-bc", async (_req, res, next) => {
    try {
      if (!bcConfigurato()) {
        return res.status(503).json({ error: "Connessione BC non configurata (mancano BC_DB_USER o BC_DB_PASSWORD)" });
      }
      const rows = await bcQuery<{ codice: string; ragioneSociale: string }>(`
        SELECT
          v.[No_]              AS codice,
          v.[Name]             AS ragioneSociale
        FROM [dbo].[URBAN HOMY$Vendor$437dbf0e-84ff-417a-965d-ed2bb9650718] v
        WHERE v.[Blocked] = 0
        ORDER BY v.[Name]
      `);
      let importati = 0;
      let aggiornati = 0;
      const errori: string[] = [];

      for (const r of rows) {
        try {
          const existing = await prisma.vendingFornitore.findUnique({
            where: { codiceBC: r.codice },
          });
          if (existing) {
            await prisma.vendingFornitore.update({
              where: { codiceBC: r.codice },
              data: { ragioneSociale: r.ragioneSociale, dataImport: new Date() },
            });
            aggiornati++;
          } else {
            await prisma.vendingFornitore.create({
              data: {
                id: `FOR-${randomUUID()}`,
                codiceBC: r.codice,
                ragioneSociale: r.ragioneSociale,
                abilitatoCarico: false,
                dataImport: new Date(),
              },
            });
            importati++;
          }
        } catch (e) {
          errori.push(`${r.codice}: ${(e as Error).message}`);
        }
      }

      res.json({ importati, aggiornati, errori });
    } catch (err) { next(err); }
  });

  // ─── Stock ────────────────────────────────────────────────────────────────

  router.get("/stock", async (req, res, next) => {
    try {
      const { magazzinoId } = req.query as { magazzinoId?: string };
      const rows = await prisma.vendingStock.findMany({
        where: magazzinoId ? { magazzinoId } : undefined,
        include: { prodotto: true },
        orderBy: { prodotto: { nome: "asc" } },
      });
      res.json(rows);
    } catch (err) { next(err); }
  });

  // ─── Movimenti ────────────────────────────────────────────────────────────

  router.get("/movimenti", async (req, res, next) => {
    try {
      const { tipo, magazzinoId, dal, al } = req.query as Record<string, string | undefined>;
      const rows = await prisma.vendingMovimento.findMany({
        where: {
          ...(tipo ? { tipo } : {}),
          ...(magazzinoId ? { magazzinoId } : {}),
          ...(dal || al ? {
            data: {
              ...(dal ? { gte: new Date(dal) } : {}),
              ...(al ? { lte: new Date(al) } : {}),
            },
          } : {}),
        },
        include: {
          righe: { include: { prodotto: true } },
          fornitore: true,
          macchinaDestinazione: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(rows);
    } catch (err) { next(err); }
  });

  router.post("/movimenti", async (req, res, next) => {
    try {
      const {
        tipo,
        magazzinoId,
        data,
        ddtNumero,
        ddtData,
        fornitoreId,
        macchinaDestinazioneId,
        note,
        operatoreNome,
        righe,
      } = req.body as {
        tipo: "CARICO" | "SCARICO" | "INVENTARIO";
        magazzinoId: string;
        data: string;
        ddtNumero?: string;
        ddtData?: string;
        fornitoreId?: string;
        macchinaDestinazioneId?: string;
        note?: string;
        operatoreNome?: string;
        righe: Array<{ prodottoId: string; quantita: number }>;
      };

      if (!["CARICO", "SCARICO", "INVENTARIO"].includes(tipo)) {
        return res.status(400).json({ error: "tipo non valido" });
      }
      if (!righe || righe.length === 0) {
        return res.status(400).json({ error: "righe vuote" });
      }

      // Verifica stock per SCARICO
      if (tipo === "SCARICO") {
        for (const riga of righe) {
          const stock = await prisma.vendingStock.findUnique({
            where: { magazzinoId_prodottoId: { magazzinoId, prodottoId: riga.prodottoId } },
          });
          const disponibile = stock?.quantita ?? 0;
          if (disponibile < riga.quantita) {
            const prodotto = await prisma.vendingProdotto.findUnique({ where: { id: riga.prodottoId } });
            return res.status(400).json({
              error: `Stock insufficiente per "${prodotto?.nome ?? riga.prodottoId}": disponibile ${disponibile}, richiesto ${riga.quantita}`,
            });
          }
        }
      }

      const movimentoId = `MOV-${randomUUID()}`;

      await prisma.$transaction(async (tx) => {
        // Crea movimento
        await tx.vendingMovimento.create({
          data: {
            id: movimentoId,
            tipo,
            magazzinoId,
            data: new Date(data),
            ddtNumero: ddtNumero || null,
            ddtData: ddtData ? new Date(ddtData) : null,
            fornitoreId: fornitoreId || null,
            macchinaDestinazioneId: macchinaDestinazioneId || null,
            note: note || null,
            operatoreNome: operatoreNome || null,
          },
        });

        // Crea righe + aggiorna stock
        for (const riga of righe) {
          let quantitaPrecedente: number | null = null;

          if (tipo === "INVENTARIO") {
            const stock = await tx.vendingStock.findUnique({
              where: { magazzinoId_prodottoId: { magazzinoId, prodottoId: riga.prodottoId } },
            });
            quantitaPrecedente = stock?.quantita ?? 0;
          }

          await tx.vendingMovimentoRiga.create({
            data: {
              id: `RIG-${randomUUID()}`,
              movimentoId,
              prodottoId: riga.prodottoId,
              quantita: riga.quantita,
              quantitaPrecedente,
            },
          });

          // Aggiorna stock
          const stockKey = { magazzinoId, prodottoId: riga.prodottoId };
          const existing = await tx.vendingStock.findUnique({
            where: { magazzinoId_prodottoId: stockKey },
          });

          if (tipo === "CARICO") {
            if (existing) {
              await tx.vendingStock.update({
                where: { magazzinoId_prodottoId: stockKey },
                data: { quantita: { increment: riga.quantita } },
              });
            } else {
              await tx.vendingStock.create({
                data: { magazzinoId, prodottoId: riga.prodottoId, quantita: riga.quantita },
              });
            }
          } else if (tipo === "SCARICO") {
            await tx.vendingStock.update({
              where: { magazzinoId_prodottoId: stockKey },
              data: { quantita: { decrement: riga.quantita } },
            });
          } else if (tipo === "INVENTARIO") {
            if (existing) {
              await tx.vendingStock.update({
                where: { magazzinoId_prodottoId: stockKey },
                data: { quantita: riga.quantita },
              });
            } else {
              await tx.vendingStock.create({
                data: { magazzinoId, prodottoId: riga.prodottoId, quantita: riga.quantita },
              });
            }
          }
        }
      });

      const movimento = await prisma.vendingMovimento.findUnique({
        where: { id: movimentoId },
        include: { righe: { include: { prodotto: true } }, fornitore: true, macchinaDestinazione: true },
      });

      res.status(201).json(movimento);
    } catch (err) { next(err); }
  });

  return router;
}
