import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { signToken, requireAuth } from "../auth.js";
import type { SafeAccount } from "../types.js";

const router = Router();

interface MsGraphProfile {
  mail?: string;
  userPrincipalName?: string;
}

function omitPassword(account: { password: string } & Omit<SafeAccount, never>): SafeAccount {
  const { password: _pw, ...rest } = account as { password: string } & SafeAccount;
  return rest;
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) { res.status(400).json({ error: "Email e password richieste" }); return; }

    const account = await prisma.utentiAccount.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!account) { res.status(401).json({ error: "Credenziali non valide" }); return; }

    const ok = await bcrypt.compare(password, account.password);
    if (!ok) { res.status(401).json({ error: "Credenziali non valide" }); return; }

    const token = signToken(account.id);
    res.json({ token, account: omitPassword(account as Parameters<typeof omitPassword>[0]) });
  } catch (err) {
    next(err);
  }
});

router.post("/sso", async (req, res, next) => {
  try {
    const { msAccessToken } = req.body as { msAccessToken?: string };
    if (!msAccessToken) { res.status(400).json({ error: "Token Microsoft mancante" }); return; }

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${msAccessToken}` },
    });
    if (!graphRes.ok) { res.status(401).json({ error: "Token Microsoft non valido" }); return; }

    const profile = (await graphRes.json()) as MsGraphProfile;
    const email = (profile.mail ?? profile.userPrincipalName ?? "").toLowerCase();
    if (!email) { res.status(401).json({ error: "Impossibile determinare l'email dell'account Microsoft" }); return; }

    const account = await prisma.utentiAccount.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!account) {
      res.status(403).json({ error: "Account Microsoft non autorizzato su nessuna applicazione" });
      return;
    }

    const token = signToken(account.id);
    res.json({ token, account: omitPassword(account as Parameters<typeof omitPassword>[0]) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.account);
});

export default router;
