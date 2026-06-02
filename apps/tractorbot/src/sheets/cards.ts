import {
  defineTable,
  withOptional,
  type Row,
  type SheetsClient,
  type Table,
} from "@simios/sheets-client";
import { CardSchema, type Card } from "../domain/card.js";

export const TAB = "cards";
export const HEADER: Row = [
  "card_id",
  "user_id",
  "username",
  "first_name",
  "name",
  "card_type",
  "type_line",
  "cost",
  "rules_text",
  "flavor_text",
  "power",
  "toughness",
  "border",
  "surface",
  "theme",
  "file_id",
  "generated_at",
];

/**
 * Map a raw row to a Card by HEADER name (not positional index) so adding or
 * reordering a column can't silently transpose same-typed cells. `user_id` is
 * coerced from its string cell; `username` is dropped when empty; everything
 * else is validated by CardSchema — the single gate for the field caps.
 */
// Column index by name, built once — parseRow looks up cells by name (not
// positional index) so reordering/inserting a column can't transpose cells.
const COLUMN: Readonly<Record<string, number>> = Object.fromEntries(
  HEADER.map((name, i) => [name, i]),
);

function parseRow(raw: Row): Card {
  const cell = (name: string): string => {
    const i = COLUMN[name];
    return (i !== undefined ? raw[i] : undefined) ?? "";
  };
  const base = {
    card_id: cell("card_id"),
    user_id: Number(cell("user_id")),
    first_name: cell("first_name"),
    name: cell("name"),
    card_type: cell("card_type"),
    type_line: cell("type_line"),
    cost: cell("cost"),
    rules_text: cell("rules_text"),
    flavor_text: cell("flavor_text"),
    power: cell("power"),
    toughness: cell("toughness"),
    border: cell("border"),
    surface: cell("surface"),
    theme: cell("theme"),
    file_id: cell("file_id"),
    generated_at: cell("generated_at"),
  };
  return CardSchema.parse(withOptional(base, "username", cell("username")));
}

/**
 * Cards are append-only — a user can amass many — so the unique key is
 * `card_id`, the millisecond ISO timestamp of the generation. Commands use
 * `append`, never `upsert`; the key only matters for the rare lookup/remove.
 */
export interface CardKey {
  cardId: string;
}

export type CardsTable = Table<Card, CardKey>;

export function createTable(client: SheetsClient): CardsTable {
  return defineTable<Card, CardKey>(client, {
    tab: TAB,
    header: HEADER,
    parseRow(row, rowNumber) {
      try {
        return parseRow(row);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Invalid ${TAB} row at sheet row ${String(rowNumber)}: ${message}`,
        );
      }
    },
    rowFromEntry(c) {
      return [
        c.card_id,
        String(c.user_id),
        c.username ?? "",
        c.first_name,
        c.name,
        c.card_type,
        c.type_line,
        c.cost,
        c.rules_text,
        c.flavor_text,
        c.power,
        c.toughness,
        c.border,
        c.surface,
        c.theme,
        c.file_id,
        c.generated_at,
      ];
    },
    keyOf: (c) => ({ cardId: c.card_id }),
    keysEqual: (a, b) => a.cardId === b.cardId,
  });
}
