// Auth
export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export type AppId = "manutenzioni" | "ticketIt" | "baggyLocker" | "vendingMachine";

export interface AccessoApp {
  abilitato: boolean;
  ruoloId: string;
}

export type AccessiMap = Partial<Record<AppId, AccessoApp>>;

export type PermessiEntry = {
  lettura: boolean;
  modifica: boolean;
  creazione: boolean;
  eliminazione: boolean;
};

export type PermessiMap = Record<string, PermessiEntry>;

export interface SafeAccount {
  id: string;
  nome: string;
  email: string;
  ruoloGlobale: string;
  accessi: AccessiMap;
}

// Express augmentation
declare global {
  namespace Express {
    interface Request {
      account: SafeAccount;
    }
  }
}
