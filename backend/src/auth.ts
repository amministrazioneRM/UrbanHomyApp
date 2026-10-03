import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import prisma from "./prisma.js";
import type { JwtPayload, SafeAccount } from "./types.js";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET missing in .env");

const TOKEN_TTL = "7d";

export function signToken(accountId: string): string {
  return jwt.sign({ sub: accountId }, SECRET!, { expiresIn: TOKEN_TTL });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ error: "Missing or invalid token" });
      return;
    }
    const payload = jwt.verify(token, SECRET!) as JwtPayload;
    const account = await prisma.utentiAccount.findUnique({ where: { id: payload.sub } });
    if (!account) {
      res.status(401).json({ error: "Account non trovato" });
      return;
    }
    const { password: _pw, ...safeAccount } = account;
    req.account = {
      ...safeAccount,
      accessi: typeof safeAccount.accessi === "string"
        ? JSON.parse(safeAccount.accessi)
        : safeAccount.accessi,
    } as SafeAccount;
    next();
  } catch {
    res.status(401).json({ error: "Token non valido o scaduto" });
  }
}
