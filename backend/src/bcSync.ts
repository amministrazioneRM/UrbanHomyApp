import prisma from "./prisma.js";
import { bcQuery } from "./bc.js";

// Società di BC (nome come prefisso delle tabelle) in ordine di precedenza: a parità di codice vale la prima.
const SOCIETA: Array<[string, string]> = [
  ["urban-homy", "URBAN HOMY S_R_L_"],
  ["iter", "ITER IMPRESA SOCIALE S_R_L_"],
  ["progetto", "PROGETTO S_P_A_"],
  ["osteria", "OSTERIA DEL CAFFE_ S_R_L_"],
];
const APP_BASE = "437dbf0e-84ff-417a-965d-ed2bb9650972";
const APP_MEWS = "b23db379-8ee4-4339-8a5f-e7c1432221b0";

const tabella = (societa: string, nome: string, app: string) => `[${societa}$${nome}$${app}]`;

export interface EsitoSincronizzazione {
  strutture: number;
  tipiAttivita: number;
  categorieMews: number;
  categorieConCodice: number;
  errori: string[];
}

// Legge da BC le BU (dimensione BU), i tipi attività (dimensione TIPO-AT) e le categorie contabili Mews con il loro Codice attività.
export async function sincronizzaDaBC(): Promise<EsitoSincronizzazione> {
  const adesso = new Date();
  const esito: EsitoSincronizzazione = { strutture: 0, tipiAttivita: 0, categorieMews: 0, categorieConCodice: 0, errori: [] };
  const bu = new Map<string, string>();
  const tipi = new Map<string, string>();

  for (const [chiave, societa] of SOCIETA) {
    try {
      const valori = await bcQuery<{ dim: string; codice: string; nome: string }>(
        `SELECT [Dimension Code] AS dim, [Code] AS codice, [Name] AS nome FROM ${tabella(societa, "Dimension Value", APP_BASE)} WHERE [Dimension Code] IN ('BU','TIPO-AT')`,
      );
      for (const v of valori) {
        const mappa = v.dim === "BU" ? bu : tipi;
        if (!mappa.has(v.codice)) mappa.set(v.codice, (v.nome ?? "").trim());
      }
    } catch (e) {
      esito.errori.push(`${chiave}: dimensioni — ${(e as Error).message}`);
    }

    try {
      const categorie = await bcQuery<{ mewsId: string; nome: string; classificazione: string | null; codiceAttivita: string | null }>(
        `SELECT CAST([Mews Id] AS NVARCHAR(50)) AS mewsId, [Name] AS nome, [Classification] AS classificazione, [Activity Code] AS codiceAttivita FROM ${tabella(societa, "BKMEWS Category", APP_MEWS)}`,
      );
      for (const c of categorie) {
        const mewsId = (c.mewsId || "").toLowerCase();
        if (!mewsId) continue;
        const dati = {
          nome: (c.nome ?? "").trim(),
          classificazione: c.classificazione?.trim() || null,
          societa: chiave,
          codiceAttivita: c.codiceAttivita?.trim() || null,
          dataImport: adesso,
        };
        await prisma.forecastMewsCategoria.upsert({ where: { mewsId }, create: { id: `MCA-${mewsId}`, mewsId, ...dati }, update: dati });
        esito.categorieMews++;
        if (dati.codiceAttivita) esito.categorieConCodice++;
      }
    } catch (e) {
      esito.errori.push(`${chiave}: categorie Mews — ${(e as Error).message}`);
    }
  }

  for (const [codice, nome] of bu) {
    await prisma.forecastBCStruttura.upsert({
      where: { codice },
      create: { id: `BCS-${codice}`, codice, nome, dataImport: adesso },
      update: { nome, dataImport: adesso },
    });
  }
  for (const [codice, nome] of tipi) {
    await prisma.forecastBCTipoAttivita.upsert({
      where: { codice },
      create: { id: `BCT-${codice}`, codice, nome, dataImport: adesso },
      update: { nome, dataImport: adesso },
    });
  }
  esito.strutture = bu.size;
  esito.tipiAttivita = tipi.size;
  return esito;
}
