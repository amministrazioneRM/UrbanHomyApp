import { Router } from "express";
import type { Request } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

type AnyRecord = Record<string, unknown>;

interface PrismaDelegate {
  findMany(args?: { include?: AnyRecord; where?: AnyRecord }): Promise<AnyRecord[]>;
  findUnique(args: { where: { id: string }; include?: AnyRecord }): Promise<AnyRecord | null>;
  create(args: { data: AnyRecord }): Promise<AnyRecord>;
  update(args: { where: { id: string }; data: AnyRecord }): Promise<AnyRecord>;
  delete(args: { where: { id: string } }): Promise<AnyRecord>;
}

interface CrudOptions {
  idPrefix?: string;
  include?: AnyRecord;
  modelName?: string;
  omit?: string[];
  hashFields?: string[];
  /** Campi da rimuovere silenziosamente dall'input (POST/PUT/batch) prima del salvataggio */
  stripFields?: string[];
  filter?: (req: Request) => Promise<AnyRecord | undefined> | AnyRecord | undefined;
  preDelete?: (req: Request, id: string) => Promise<void>;
}

async function hashFieldsIn(data: AnyRecord, hashFields: string[]): Promise<AnyRecord> {
  const out = { ...data };
  for (const field of hashFields) {
    if (typeof out[field] === "string" && (out[field] as string).length > 0) {
      const rounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10) || 10;
      out[field] = await bcrypt.hash(out[field] as string, rounds);
    } else {
      delete out[field];
    }
  }
  return out;
}

function dateFieldsFor(modelName: string): string[] {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) return [];
  return model.fields.filter((f) => f.type === "DateTime").map((f) => f.name);
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerceDates(data: AnyRecord, dateFields: string[]): AnyRecord {
  const out = { ...data };
  for (const field of dateFields) {
    if (typeof out[field] === "string" && BARE_DATE.test(out[field] as string)) {
      out[field] = new Date(out[field] as string);
    }
  }
  return out;
}

// Serialize objects/arrays to JSON strings for NVarChar(Max) fields (SQL Server)
function serializeJsonFields(data: AnyRecord): AnyRecord {
  const out = { ...data };
  for (const [key, value] of Object.entries(out)) {
    if (value !== null && value !== undefined && typeof value === "object" && !(value instanceof Date)) {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value !== null && typeof value === "object" && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  // Deserialize JSON strings (SQL Server stores JSON as NVarChar)
  if (typeof value === "string") {
    const trimmed = value.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return JSON.parse(value); } catch { /* not JSON, return as-is */ }
    }
  }
  return value;
}

function serializeRecord(record: unknown, omit?: string[]): unknown {
  if (!record || typeof record !== "object") return record;
  const out: AnyRecord = {};
  for (const [key, value] of Object.entries(record as AnyRecord)) {
    if (omit?.includes(key)) continue;
    out[key] = Array.isArray(value) ? value : serializeValue(value);
  }
  return out;
}

function serialize(data: unknown, omit?: string[]): unknown {
  return Array.isArray(data)
    ? (data as unknown[]).map((r) => serializeRecord(r, omit))
    : serializeRecord(data, omit);
}

export function makeCrudRouter(delegate: PrismaDelegate, options: CrudOptions = {}): Router {
  const { idPrefix, include, modelName, omit, hashFields = [], stripFields = [], filter, preDelete } = options;

  function stripInputFields(data: AnyRecord): AnyRecord {
    if (stripFields.length === 0) return data;
    const out = { ...data };
    for (const field of stripFields) delete out[field];
    return out;
  }
  const router = Router();
  const dateFields = modelName ? dateFieldsFor(modelName) : [];

  router.get("/", async (req, res, next) => {
    try {
      const where = filter ? (await filter(req)) : undefined;
      const items = await delegate.findMany({ include, ...(where ? { where } : {}) });
      res.json(serialize(items, omit));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const item = await delegate.findUnique({ where: { id: req.params.id }, include });
      if (!item) { res.status(404).json({ error: "Non trovato" }); return; }
      res.json(serialize(item, omit));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const id = (req.body as AnyRecord).id ?? `${idPrefix}-${crypto.randomUUID()}`;
      const data = await hashFieldsIn(serializeJsonFields(coerceDates(stripInputFields({ ...(req.body as AnyRecord), id }), dateFields)), hashFields);
      const item = await delegate.create({ data });
      res.status(201).json(serialize(item, omit));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const { id: _id, ...rest } = req.body as AnyRecord;
      const data = await hashFieldsIn(serializeJsonFields(coerceDates(stripInputFields(rest), dateFields)), hashFields);
      const item = await delegate.update({ where: { id: req.params.id }, data });
      res.json(serialize(item, omit));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      if (preDelete) await preDelete(req, req.params.id);
      await delegate.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Salva un array di elementi in un'unica chiamata (upsert: create o update se esiste già)
  router.post("/batch", async (req, res, next) => {
    try {
      const items: AnyRecord[] = Array.isArray(req.body) ? req.body : [];
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const id = (item.id as string) ?? `${idPrefix}-${crypto.randomUUID()}`;
          const data = await hashFieldsIn(serializeJsonFields(coerceDates(stripInputFields({ ...item, id }), dateFields)), hashFields);
          try {
            return await delegate.create({ data });
          } catch {
            const { id: _id, ...rest } = data;
            return await delegate.update({ where: { id }, data: rest });
          }
        })
      );
      const saved = results
        .filter((r): r is PromiseFulfilledResult<AnyRecord> => r.status === "fulfilled")
        .map((r) => r.value);
      res.status(201).json(serialize(saved, omit));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
