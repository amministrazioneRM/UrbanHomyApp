import sql from "mssql";

// Connessione in sola lettura al database SQL di Business Central.
// Credenziali da .env: BC_DB_USER e BC_DB_PASSWORD. Con BC_DB_DOMAIN si usa l'accesso Windows (NTLM), altrimenti un utente SQL.
const server = () => process.env.BC_DB_SERVER || "srvdb.urbanhomy.local";
const database = () => process.env.BC_DB_NAME || "URBAN_LIVE";

export function bcConfigurato(): boolean {
  return !!process.env.BC_DB_USER && !!process.env.BC_DB_PASSWORD;
}

export async function bcQuery<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const domain = process.env.BC_DB_DOMAIN;
  const user = process.env.BC_DB_USER as string;
  const password = process.env.BC_DB_PASSWORD as string;
  const pool = new sql.ConnectionPool({
    server: server(),
    database: database(),
    port: 1433,
    connectionTimeout: 15000,
    requestTimeout: 120000,
    ...(domain
      ? { authentication: { type: "ntlm", options: { domain, userName: user, password } } }
      : { user, password }),
    options: { encrypt: false, trustServerCertificate: true, readOnlyIntent: true, appName: "UH-RevenueForecast" },
  } as sql.config);
  await pool.connect();
  try {
    const r = await pool.request().query(`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${query}`);
    return r.recordset as T[];
  } finally {
    await pool.close();
  }
}
