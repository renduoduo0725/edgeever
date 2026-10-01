const DATABASE_NAME = "edgeever-local-agent-images-v1";
const STORE_NAME = "images";
const TURN_INDEX = "turnId";

export type LocalAgentImage = {
  turnId: string;
  id: string;
  mediaType: string;
  base64: string;
};

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true });
  transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("Image storage transaction aborted.")), { once: true });
  transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Image storage transaction failed.")), { once: true });
});

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("Image storage request failed.")), { once: true });
});

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.addEventListener("upgradeneeded", () => {
    const store = request.result.createObjectStore(STORE_NAME, { keyPath: ["turnId", "id"] });
    store.createIndex(TURN_INDEX, "turnId");
  });
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error ?? new Error("Image storage is unavailable.")), { once: true });
});

export class LocalAgentImageStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private database() {
    this.databasePromise ??= openDatabase();
    return this.databasePromise;
  }

  async put(image: LocalAgentImage) {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(image);
    await transactionDone(transaction);
  }

  async list(turnIds: readonly string[]): Promise<LocalAgentImage[]> {
    if (!turnIds.length) return [];
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const index = transaction.objectStore(STORE_NAME).index(TURN_INDEX);
    const requests = turnIds.map((turnId) => requestResult(index.getAll(turnId) as IDBRequest<LocalAgentImage[]>));
    const results = await Promise.all(requests);
    await transactionDone(transaction);
    return results.flat();
  }

  async prune(keptTurnIds: readonly string[]) {
    const kept = new Set(keptTurnIds);
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const cursorRequest = store.openKeyCursor();
    cursorRequest.addEventListener("success", () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const [turnId] = cursor.key as [string, string];
      if (!kept.has(turnId)) store.delete(cursor.key);
      cursor.continue();
    });
    await transactionDone(transaction);
  }
}
