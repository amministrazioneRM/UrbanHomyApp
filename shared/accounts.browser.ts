// Browser bundle entry — spreads the default export directly as the global
import UHAccountsModule from "./accounts.js";
// @ts-ignore — assigning to globalThis for browser compatibility
(globalThis as Record<string, unknown>).UHAccounts = UHAccountsModule;
