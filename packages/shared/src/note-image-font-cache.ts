// A disposable cache, separate from notebooks and account data. Pinned URLs are its keys.
// IndexedDB also works outside secure contexts, unlike CacheStorage in file-based WebViews.
let opening: Promise<IDBDatabase | undefined> | undefined;
const database = () => opening ??= new Promise<IDBDatabase | undefined>(resolve => {
  let settled = false;
  const finish = (db?: IDBDatabase) => {
    if (settled) { db?.close(); return; }
    settled = true;
    clearTimeout(timer);
    resolve(db);
  };
  const timer = setTimeout(() => finish(), 1_500);
  try {
    const request = indexedDB.open("edgeever-share-font-cache", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("resources");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      finish(db);
    };
    request.onerror = request.onblocked = () => finish();
  } catch { finish(); }
});

export const readFontCache = async (key: string): Promise<ArrayBuffer | undefined> => {
  const db = await database();
  if (!db) return;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(undefined), 1_500);
    const finish = (value?: ArrayBuffer) => { clearTimeout(timer); resolve(value); };
    try {
      const request = db.transaction("resources", "readonly").objectStore("resources").get(key);
      request.onsuccess = () => finish(request.result instanceof ArrayBuffer ? request.result : undefined);
      request.onerror = () => finish();
    } catch { finish(); }
  });
};

export const writeFontCache = async (key: string, value: ArrayBuffer): Promise<void> => {
  const db = await database();
  if (!db) return;
  return new Promise(resolve => {
    const timer = setTimeout(resolve, 1_500);
    const finish = () => { clearTimeout(timer); resolve(); };
    try {
      const transaction = db.transaction("resources", "readwrite");
      transaction.objectStore("resources").put(value, key);
      transaction.oncomplete = transaction.onerror = transaction.onabort = finish;
    } catch { finish(); }
  });
};
