const DB_NAME = "oneulmoipji-images";
const STORE_NAME = "garments";
const DB_VERSION = 1;

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export const loadStoredImage = (id: string) => runStore<Blob | undefined>("readonly", store => store.get(id));
export const saveStoredImage = (id: string, blob: Blob) => runStore<IDBValidKey>("readwrite", store => store.put(blob, id));
export const deleteStoredImage = (id: string) => runStore<undefined>("readwrite", store => store.delete(id));
