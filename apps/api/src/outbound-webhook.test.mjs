import { describe, expect, test } from "bun:test";
import { audit, auditStatement } from "./audit";
import {
  createOutboundWebhookSession,
  matchesOutboundWebhookAction,
  OUTBOUND_WEBHOOK_SUPPRESS_HEADER,
  resolveOutboundWebhookConfig,
  signOutboundWebhookPayload,
} from "./outbound-webhook";

class FakeNativeStatement {
  constructor(sql, bindings = [], metaChanges = 1) {
    this.sql = sql;
    this.bindings = bindings;
    this.metaChanges = metaChanges;
  }

  bind(...values) {
    return new FakeNativeStatement(this.sql, values, this.metaChanges);
  }

  async first() {
    return null;
  }

  async all() {
    return { results: [], success: true, meta: { changes: 0 } };
  }

  async run() {
    return { results: [], success: true, meta: { changes: this.metaChanges } };
  }
}

const createFakeStorage = ({ shouldFailBatch = false, batchMetaChanges } = {}) => {
  const executed = [];
  const db = {
    prepare(sql) {
      return new FakeNativeStatement(sql);
    },
    async batch(statements) {
      for (const stmt of statements) {
        if (!(stmt instanceof FakeNativeStatement)) {
          throw new TypeError("Batch must receive unwrapped native statements");
        }
      }
      if (shouldFailBatch) {
        throw new Error("Simulated D1 batch failure");
      }
      executed.push(...statements);
      return statements.map((_, index) => ({
        results: [],
        success: true,
        meta: { changes: batchMetaChanges?.[index] ?? 1 },
      }));
    },
  };

  return {
    executed,
    storage: {
      db,
      resources: {
        get: async () => null,
        put: async () => undefined,
        createMultipartUpload: async () => {
          throw new Error("unused");
        },
        resumeMultipartUpload: () => {
          throw new Error("unused");
        },
        delete: async () => undefined,
      },
      diagnostics: {
        database: "sqlite",
        resources: "filesystem",
        migrationTable: "_edgeever_migrations",
      },
    },
  };
};

describe("outbound webhook", () => {
  test("stays a zero-overhead no-op when unconfigured or in demo mode", () => {
    const { storage } = createFakeStorage();
    expect(resolveOutboundWebhookConfig({})).toBeNull();
    expect(
      resolveOutboundWebhookConfig({
        EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/hook",
        EDGE_EVER_DEMO_MODE: "true",
      }),
    ).toBeNull();

    const runtimeEnv = { storage };
    const session = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/memos", { method: "POST" }),
      runtimeEnv,
    );
    expect(session.env).toBe(runtimeEnv);
  });

  test("delivers signed HMAC-SHA256 batch payload for committed content mutations and unwraps native statements", async () => {
    const { storage } = createFakeStorage();
    const deliveries = [];
    const waitUntilPromises = [];

    const session = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/memos", { method: "POST" }),
      {
        storage,
        EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/webhook/edgeever",
        EDGE_EVER_WEBHOOK_SECRET: "top-secret-key",
        webhookFetch: async (url, init) => {
          deliveries.push({ url: String(url), init });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      },
    );

    const db = session.env.storage.db;
    await db.batch([
      db.prepare("INSERT INTO memos (id) VALUES (?)").bind("memo_1"),
      auditStatement(db, "user", "usr_1", "memo.create", "memo", "memo_1", {
        notebookId: "nb_1",
      }),
      auditStatement(db, "user", "usr_1", "auth.session_last_seen", "session", "sess_1", {}),
    ]);

    session.flush({ waitUntil: (promise) => waitUntilPromises.push(promise) }, 201);
    await Promise.all(waitUntilPromises);

    expect(deliveries.length).toBe(1);
    const { url, init } = deliveries[0];
    expect(url).toBe("https://sync.example.net/webhook/edgeever");
    expect(init.method).toBe("POST");

    const headers = new Headers(init.headers);
    const rawBody = String(init.body);
    const timestamp = headers.get("x-edgeever-timestamp");
    const signature = headers.get("x-edgeever-signature");
    expect(timestamp).toBeTruthy();
    expect(signature).toBe(
      await signOutboundWebhookPayload("top-secret-key", timestamp, rawBody),
    );
    expect(headers.get("x-edgeever-event")).toBe("memo.create");

    const parsed = JSON.parse(rawBody);
    expect(parsed.source).toBe("edgeever");
    expect(parsed.event).toBe("memo.create");
    expect(parsed.events.length).toBe(1);
    expect(parsed.events[0]).toMatchObject({
      action: "memo.create",
      entityType: "memo",
      entityId: "memo_1",
      actorType: "user",
      actorId: "usr_1",
      metadata: { notebookId: "nb_1" },
    });
  });

  test("does not fire on failed HTTP status, failed DB batch, or zero-row conditional notebook delete", async () => {
    const deliveries = [];
    const webhookFetch = async (url, init) => {
      deliveries.push({ url, init });
      return new Response(null, { status: 204 });
    };

    // 1. Failed DB batch
    const failing = createFakeStorage({ shouldFailBatch: true });
    const s1 = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/memos", { method: "POST" }),
      { storage: failing.storage, EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/hook", webhookFetch },
    );
    await expect(
      s1.env.storage.db.batch([
        auditStatement(s1.env.storage.db, "user", "usr_1", "memo.create", "memo", "memo_1", {}),
      ]),
    ).rejects.toThrow("Simulated D1 batch failure");
    const waits = [];
    s1.flush({ waitUntil: (p) => waits.push(p) }, 200);

    // 2. HTTP >= 400
    const okStorage = createFakeStorage();
    const s2 = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/memos", { method: "POST" }),
      { storage: okStorage.storage, EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/hook", webhookFetch },
    );
    await audit(s2.env.storage.db, "user", "usr_1", "memo.update", "memo", "memo_1", {});
    s2.flush({ waitUntil: (p) => waits.push(p) }, 409);

    // 3. Conditional notebook.delete with changes === 0
    const zeroChanges = createFakeStorage({ batchMetaChanges: [0, 0] });
    const s3 = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/notebooks/nb_1", { method: "DELETE" }),
      { storage: zeroChanges.storage, EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/hook", webhookFetch },
    );
    const conditionalDelete = s3.env.storage.db
      .prepare(
        `INSERT INTO audit_events (id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at)
         SELECT ?, ?, ?, 'notebook.delete', 'notebook', ?, ?, ? WHERE changes() = ?`,
      )
      .bind("aud_1", "user", "usr_1", "nb_1", "{}", "2026-11-13T00:00:00.000Z", 1);
    await s3.env.storage.db.batch([
      s3.env.storage.db.prepare("UPDATE notebooks SET is_deleted = 1 WHERE id = ?").bind("nb_1"),
      conditionalDelete,
    ]);
    s3.flush({ waitUntil: (p) => waits.push(p) }, 200);

    await Promise.all(waits);
    expect(deliveries.length).toBe(0);
  });

  test("prevents sync loops via EDGE_EVER_WEBHOOK_IGNORE_ACTOR_IDS and agent suppress header", async () => {
    const deliveries = [];
    const webhookFetch = async (url, init) => {
      deliveries.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    };
    const waits = [];

    // 1. Ignored by actor ID
    const { storage: st1 } = createFakeStorage();
    const s1 = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/memos", { method: "POST" }),
      {
        storage: st1,
        EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/hook",
        EDGE_EVER_WEBHOOK_IGNORE_ACTOR_IDS: "tok_notion_sync, tok_other",
        webhookFetch,
      },
    );
    await audit(s1.env.storage.db, "agent", "tok_notion_sync", "memo.update", "memo", "memo_1", {});
    s1.flush({ waitUntil: (p) => waits.push(p) }, 200);

    // 2. Ignored by suppress header for agent, NOT ignored for interactive/public user actor
    const { storage: st2 } = createFakeStorage();
    const s2 = createOutboundWebhookSession(
      new Request("https://notes.example.net/api/v1/memos", {
        method: "POST",
        headers: { [OUTBOUND_WEBHOOK_SUPPRESS_HEADER]: "1" },
      }),
      {
        storage: st2,
        EDGE_EVER_WEBHOOK_URL: "https://sync.example.net/hook",
        webhookFetch,
      },
    );
    await audit(s2.env.storage.db, "agent", "tok_any", "memo.create", "memo", "memo_agent", {});
    await audit(s2.env.storage.db, "user", "usr_1", "memo.create", "memo", "memo_user", {});
    s2.flush({ waitUntil: (p) => waits.push(p) }, 200);

    await Promise.all(waits);
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].events.map((e) => e.entityId)).toEqual(["memo_user"]);
  });

  test("supports custom event wildcard and negation patterns", () => {
    expect(matchesOutboundWebhookAction("memo.update", null)).toBe(true);
    expect(matchesOutboundWebhookAction("memo.share_create", null)).toBe(false);
    expect(matchesOutboundWebhookAction("auth.login", null)).toBe(false);
    expect(matchesOutboundWebhookAction("memo.update", ["memo.*", "!memo.pin"])).toBe(true);
    expect(matchesOutboundWebhookAction("memo.pin", ["memo.*", "!memo.pin"])).toBe(false);
    expect(matchesOutboundWebhookAction("auth.login", ["*"])).toBe(true);
  });
});
