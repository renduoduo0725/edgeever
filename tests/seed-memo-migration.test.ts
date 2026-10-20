import { createHash } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { MemoUpdateSchema } from "../packages/shared/src/schemas";

describe("seed memo migrations", () => {
  test("repairs the legacy placeholder when an existing database upgrades", () => {
    const db = new Database(":memory:");
    const migrations = globSync("migrations/*.sql").sort();

    for (const migration of migrations.filter((path) => path < "migrations/0014_repair_seed_memo_content_hash.sql")) {
      db.exec(readFileSync(migration, "utf8"));
    }

    expect(
      db.query(`SELECT content_hash FROM memo_contents WHERE memo_id = 'memo_welcome'`).get(),
    ).toEqual({ content_hash: "seed" });

    db.exec(readFileSync("migrations/0014_repair_seed_memo_content_hash.sql", "utf8"));

    expect(
      db.query(`SELECT length(content_hash) AS length FROM memo_contents WHERE memo_id = 'memo_welcome'`).get(),
    ).toEqual({ length: 64 });
  });

  test("backfills a valid content hash for the bundled welcome memo", () => {
    const db = new Database(":memory:");

    for (const migration of globSync("migrations/*.sql").sort()) {
      db.exec(readFileSync(migration, "utf8"));
    }

    const memo = db
      .query(
        `SELECT content_json, content_markdown, content_hash, revision
         FROM memo_contents
         WHERE memo_id = 'memo_welcome'`,
      )
      .get() as {
        content_json: string;
        content_markdown: string;
        content_hash: string;
        revision: number;
      };
    const expectedHash = createHash("sha256")
      .update(memo.content_markdown + memo.content_json)
      .digest("hex");

    expect(memo.content_hash).toBe(expectedHash);
    expect(
      MemoUpdateSchema.safeParse({
        expectedRevision: memo.revision,
        expectedContentHash: memo.content_hash,
      }).success,
    ).toBe(true);
  });
});
