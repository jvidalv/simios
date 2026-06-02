import {
  createSheetsClient,
  type SheetsClient,
} from "@simios/sheets-client";
import type { Config } from "./config.js";
import {
  createTable as createCardsTable,
  type CardsTable,
} from "./sheets/cards.js";

export interface Services {
  readonly config: Config;
  readonly sheets: SheetsClient;
  readonly cards: CardsTable;
}

export function createServices(config: Config): Services {
  const sheets = createSheetsClient({
    credentials: config.serviceAccount,
    spreadsheetId: config.sheetId,
  });
  return {
    config,
    sheets,
    cards: createCardsTable(sheets),
  };
}

export async function ensureSheetsReady(services: Services): Promise<void> {
  await services.cards.ensure();
}
