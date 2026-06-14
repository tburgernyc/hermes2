/**
 * Schema contract: the live database has EXACTLY the expected tables, columns (name + type +
 * nullability), and enums (exact labels). Set-equality, not vacuous "contains" — accidental drift
 * fails here. Read-only catalog introspection; no transaction needed.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { HAS_DB, getTestPool } from "./helpers/db.js";
import { EXPECTED_COLUMNS, EXPECTED_ENUMS, EXPECTED_TABLES } from "./helpers/expected-schema.js";

const d = HAS_DB ? describe : describe.skip;

interface ColRow {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: string;
}
interface EnumRow {
  typname: string;
  labels: string[];
}

d("schema contract", () => {
  const columnsByTable = new Map<string, Map<string, { udt: string; nullable: boolean }>>();
  const enums = new Map<string, string[]>();
  let tableNames: string[] = [];

  beforeAll(async () => {
    const client = await getTestPool().connect();
    try {
      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      tableNames = tables.rows.map((r) => r.table_name);

      const cols = await client.query<ColRow>(
        `SELECT table_name, column_name, udt_name, is_nullable
         FROM information_schema.columns WHERE table_schema = 'public'`,
      );
      for (const row of cols.rows) {
        let m = columnsByTable.get(row.table_name);
        if (!m) {
          m = new Map();
          columnsByTable.set(row.table_name, m);
        }
        m.set(row.column_name, { udt: row.udt_name, nullable: row.is_nullable === "YES" });
      }

      const enumRows = await client.query<EnumRow>(
        `SELECT t.typname AS typname,
                array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
         GROUP BY t.typname`,
      );
      for (const row of enumRows.rows) enums.set(row.typname, row.labels);
    } finally {
      client.release();
    }
  });

  it("has exactly the expected base tables", () => {
    expect([...tableNames].sort()).toEqual([...EXPECTED_TABLES].sort());
  });

  for (const [table, specs] of Object.entries(EXPECTED_COLUMNS)) {
    describe(`table ${table}`, () => {
      it("has exactly the expected column set", () => {
        const actual = columnsByTable.get(table);
        expect(actual, `table ${table} is missing`).toBeDefined();
        const actualNames = [...(actual?.keys() ?? [])].sort();
        const expectedNames = specs.map((s) => s.name).sort();
        expect(actualNames).toEqual(expectedNames);
      });

      it("matches expected type + nullability on every column", () => {
        const actual = columnsByTable.get(table);
        for (const spec of specs) {
          const col = actual?.get(spec.name);
          expect(col, `${table}.${spec.name} missing`).toEqual({
            udt: spec.udt,
            nullable: spec.nullable,
          });
        }
      });
    });
  }

  it("has exactly the expected enums with exact labels", () => {
    expect([...enums.keys()].sort()).toEqual(Object.keys(EXPECTED_ENUMS).sort());
    for (const [name, labels] of Object.entries(EXPECTED_ENUMS)) {
      expect(enums.get(name), `enum ${name}`).toEqual(labels);
    }
  });
});
