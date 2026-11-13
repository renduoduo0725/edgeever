import { isDemoModeEnabled } from "./demo-mode";
import { createId, isoNow } from "./entity-utils";
import type { Bindings } from "./api-context";
import type {
  DatabaseAdapter,
  DatabaseQueryResult,
  PreparedStatementAdapter,
} from "./storage-contract";

export const OUTBOUND_WEBHOOK_TIMEOUT_MS = 10_000;
export const OUTBOUND_WEBHOOK_SUPPRESS_HEADER = "x-edgeever-webhook-suppress";

const RAW_STATEMENT = Symbol("edgeever.rawPreparedStatement");
const TRACKED_AUDIT = Symbol("edgeever.trackedAuditEvent");
const AUDIT_INSERT_PATTERN = /\bINSERT\s+INTO\s+audit_events\b/i;
const CONDITIONAL_NOTEBOOK_DELETE_PATTERN = /'notebook\.delete'\s*,\s*'notebook'/i;

export type OutboundWebhookActorType = "user" | "agent" | "system";

export type OutboundWebhookEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: OutboundWebhookActorType;
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type OutboundWebhookEnvelope = {
  id: string;
  timestamp: string;
  source: "edgeever";
  event: string;
  events: OutboundWebhookEvent[];
};

export type OutboundWebhookConfig = {
  url: string;
  secret: string | null;
  eventPatterns: string[] | null;
  ignoreActorIds: Set<string>;
};

type TrackedAuditRecord = {
  event: OutboundWebhookEvent;
  conditional: boolean;
};

type TrackedStatement = PreparedStatementAdapter & {
  [RAW_STATEMENT]: PreparedStatementAdapter;
  [TRACKED_AUDIT]?: TrackedAuditRecord;
};

const isTrackedStatement = (
  statement: PreparedStatementAdapter,
): statement is TrackedStatement => RAW_STATEMENT in statement;

const parseCsvSet = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseMetadataObject = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const normalizeActorType = (value: unknown): OutboundWebhookActorType =>
  value === "agent" || value === "system" ? value : "user";

const parseAuditStatementBindings = (
  sql: string,
  bindings: unknown[],
): TrackedAuditRecord | undefined => {
  if (bindings.length === 8) {
    const [id, actorType, actorId, action, entityType, entityId, metadataJson, createdAt] = bindings;
    if (
      typeof id !== "string"
      || typeof action !== "string"
      || typeof entityType !== "string"
      || typeof entityId !== "string"
    ) {
      return undefined;
    }
    return {
      conditional: false,
      event: {
        id,
        action,
        entityType,
        entityId,
        actorType: normalizeActorType(actorType),
        actorId: typeof actorId === "string" ? actorId : null,
        metadata: parseMetadataObject(metadataJson),
        occurredAt: typeof createdAt === "string" && createdAt ? createdAt : isoNow(),
      },
    };
  }

  if (bindings.length === 7 && CONDITIONAL_NOTEBOOK_DELETE_PATTERN.test(sql)) {
    const [id, actorType, actorId, entityId, metadataJson, createdAt] = bindings;
    if (typeof id !== "string" || typeof entityId !== "string") {
      return undefined;
    }
    return {
      conditional: true,
      event: {
        id,
        action: "notebook.delete",
        entityType: "notebook",
        entityId,
        actorType: normalizeActorType(actorType),
        actorId: typeof actorId === "string" ? actorId : null,
        metadata: parseMetadataObject(metadataJson),
        occurredAt: typeof createdAt === "string" && createdAt ? createdAt : isoNow(),
      },
    };
  }

  return undefined;
};

export const isDefaultContentWebhookAction = (action: string): boolean => {
  if (action.startsWith("memo.")) {
    return !action.startsWith("memo.share_");
  }
  if (action.startsWith("notebook.")) {
    return !action.startsWith("notebook.share_");
  }
  return (
    action.startsWith("tag.")
    || action.startsWith("resource.")
    || action === "backup.restore"
  );
};

const matchesSinglePattern = (action: string, pattern: string): boolean => {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) {
    return action.startsWith(pattern.slice(0, -1));
  }
  return action === pattern;
};

export const matchesOutboundWebhookAction = (
  action: string,
  patterns: string[] | null,
): boolean => {
  if (!patterns || patterns.length === 0) {
    return isDefaultContentWebhookAction(action);
  }

  let included = false;
  let hasPositiveRule = false;

  for (const rule of patterns) {
    if (rule.startsWith("!")) {
      const excludedPattern = rule.slice(1).trim();
      if (excludedPattern && matchesSinglePattern(action, excludedPattern)) {
        return false;
      }
      continue;
    }
    hasPositiveRule = true;
    if (matchesSinglePattern(action, rule)) {
      included = true;
    }
  }

  return hasPositiveRule ? included : isDefaultContentWebhookAction(action);
};

export const resolveOutboundWebhookConfig = (
  env: Pick<
    Bindings,
    | "EDGE_EVER_DEMO_MODE"
    | "EDGE_EVER_WEBHOOK_URL"
    | "EDGE_EVER_WEBHOOK_SECRET"
    | "EDGE_EVER_WEBHOOK_EVENTS"
    | "EDGE_EVER_WEBHOOK_IGNORE_ACTOR_IDS"
  >,
): OutboundWebhookConfig | null => {
  if (isDemoModeEnabled(env.EDGE_EVER_DEMO_MODE)) {
    return null;
  }

  const rawUrl = env.EDGE_EVER_WEBHOOK_URL?.trim();
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    console.warn("[outbound-webhook] ignoring invalid EDGE_EVER_WEBHOOK_URL");
    return null;
  }

  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    || parsed.username
    || parsed.password
    || parsed.hash
  ) {
    console.warn(
      "[outbound-webhook] EDGE_EVER_WEBHOOK_URL must use http(s) without embedded credentials or fragments",
    );
    return null;
  }

  const eventPatterns = parseCsvSet(env.EDGE_EVER_WEBHOOK_EVENTS);
  const secret = env.EDGE_EVER_WEBHOOK_SECRET?.trim() || null;

  return {
    url: parsed.href,
    secret,
    eventPatterns: eventPatterns.length > 0 ? eventPatterns : null,
    ignoreActorIds: new Set(parseCsvSet(env.EDGE_EVER_WEBHOOK_IGNORE_ACTOR_IDS)),
  };
};

const statementDidWriteRow = (
  tracked: TrackedAuditRecord,
  result: DatabaseQueryResult<unknown> | undefined,
): boolean => {
  if (!tracked.conditional) return true;
  const changes = result?.meta?.changes;
  return changes === undefined ? true : Number(changes) > 0;
};

const wrapAuditPreparedStatement = (
  inner: PreparedStatementAdapter,
  sql: string,
  onCommitted: (event: OutboundWebhookEvent) => void,
  tracked?: TrackedAuditRecord,
): TrackedStatement => ({
  [RAW_STATEMENT]: inner,
  ...(tracked ? { [TRACKED_AUDIT]: tracked } : {}),
  bind(...values: unknown[]) {
    const boundInner = inner.bind(...values);
    const parsed = parseAuditStatementBindings(sql, values);
    return wrapAuditPreparedStatement(boundInner, sql, onCommitted, parsed);
  },
  first: inner.first.bind(inner),
  all: inner.all.bind(inner),
  async run<T = Record<string, unknown>>() {
    const result = await inner.run<T>();
    if (tracked && statementDidWriteRow(tracked, result)) {
      onCommitted(tracked.event);
    }
    return result;
  },
});

export const wrapDatabaseForOutboundWebhook = (
  db: DatabaseAdapter,
  onCommitted: (event: OutboundWebhookEvent) => void,
): DatabaseAdapter => ({
  prepare(query: string) {
    const inner = db.prepare(query);
    if (!AUDIT_INSERT_PATTERN.test(query)) {
      return inner;
    }
    return wrapAuditPreparedStatement(inner, query, onCommitted);
  },
  async batch<T = unknown>(statements: PreparedStatementAdapter[]) {
    const rawStatements = statements.map((statement) =>
      isTrackedStatement(statement) ? statement[RAW_STATEMENT] : statement,
    );
    const results = await db.batch<T>(rawStatements);
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const tracked = isTrackedStatement(statement) ? statement[TRACKED_AUDIT] : undefined;
      if (tracked && statementDidWriteRow(tracked, results[index])) {
        onCommitted(tracked.event);
      }
    }
    return results;
  },
});

const toHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const signOutboundWebhookPayload = async (
  secret: string,
  timestampSeconds: string,
  rawBody: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestampSeconds}.${rawBody}`),
  );
  return `sha256=${toHex(signature)}`;
};

export const buildOutboundWebhookEnvelope = (
  events: OutboundWebhookEvent[],
  nowIso = isoNow(),
): OutboundWebhookEnvelope => {
  const distinctActions = new Set(events.map((event) => event.action));
  const summaryEvent = distinctActions.size === 1 ? events[0]!.action : "batch";
  return {
    id: createId("whk"),
    timestamp: nowIso,
    source: "edgeever",
    event: summaryEvent,
    events,
  };
};

export const deliverOutboundWebhook = async (
  config: OutboundWebhookConfig,
  events: OutboundWebhookEvent[],
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
  if (events.length === 0) return false;

  const nowMs = Date.now();
  const timestampSeconds = String(Math.floor(nowMs / 1000));
  const envelope = buildOutboundWebhookEnvelope(events, new Date(nowMs).toISOString());
  const rawBody = JSON.stringify(envelope);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "EdgeEver-Webhook/1.0",
    "X-EdgeEver-Delivery": envelope.id,
    "X-EdgeEver-Event": envelope.event,
    "X-EdgeEver-Timestamp": timestampSeconds,
  };

  if (config.secret) {
    headers["X-EdgeEver-Signature"] = await signOutboundWebhookPayload(
      config.secret,
      timestampSeconds,
      rawBody,
    );
  }

  try {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "manual",
      signal: AbortSignal.timeout(OUTBOUND_WEBHOOK_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    if (!response.ok) {
      console.warn(
        `[outbound-webhook] receiver responded with HTTP ${response.status} for ${envelope.event} (${events.length} event(s))`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[outbound-webhook] delivery failed", error);
    return false;
  }
};

export type WebhookExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

export const createOutboundWebhookSession = (
  request: Request,
  runtimeEnv: Bindings,
): {
  env: Bindings;
  flush: (ctx: WebhookExecutionContext, responseStatus: number) => void;
} => {
  const config = resolveOutboundWebhookConfig(runtimeEnv);
  if (!config) {
    return {
      env: runtimeEnv,
      flush: () => undefined,
    };
  }

  const committedEvents: OutboundWebhookEvent[] = [];
  const suppressAgentEvents =
    request.headers.get(OUTBOUND_WEBHOOK_SUPPRESS_HEADER)?.trim() === "1";

  const wrappedEnv: Bindings = {
    ...runtimeEnv,
    storage: {
      ...runtimeEnv.storage,
      db: wrapDatabaseForOutboundWebhook(runtimeEnv.storage.db, (event) => {
        committedEvents.push(event);
      }),
    },
  };

  return {
    env: wrappedEnv,
    flush(ctx, responseStatus) {
      if (responseStatus >= 400 || committedEvents.length === 0) {
        return;
      }

      const deliverable = committedEvents.filter((event) => {
        if (suppressAgentEvents && event.actorType === "agent") {
          return false;
        }
        if (event.actorId && config.ignoreActorIds.has(event.actorId)) {
          return false;
        }
        return matchesOutboundWebhookAction(event.action, config.eventPatterns);
      });

      if (deliverable.length === 0) {
        return;
      }

      ctx.waitUntil(
        deliverOutboundWebhook(config, deliverable, runtimeEnv.webhookFetch ?? fetch),
      );
    },
  };
};
