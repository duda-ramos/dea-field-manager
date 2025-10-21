export interface IDBDriver {
  open(name: string, version: number): IDBOpenDBRequest;
}

const driver: IDBDriver = {
  open: (name, version) => indexedDB.open(name, version),
};

export interface ImageRecord {
  id: string;
  projectId: string;
  installationId?: string;
  size: number;
  type: string;
  data: Blob;
}

export function useIndexedDB(dbName = 'dea_manager_test', version = 1, dbDriver: IDBDriver = driver) {
  async function putImage(record: ImageRecord): Promise<void> {
    const req = dbDriver.open(dbName, version);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      const store = tx.objectStore('images');
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getImage(id: string): Promise<ImageRecord | undefined> {
    const req = dbDriver.open(dbName, version);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

    return await new Promise<ImageRecord | undefined>((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const store = tx.objectStore('images');
      const getReq = store.get(id);
      getReq.onsuccess = () => resolve(getReq.result as ImageRecord | undefined);
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async function count(): Promise<number> {
    const req = dbDriver.open(dbName, version);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const store = tx.objectStore('images');
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    });
  }

  return { putImage, getImage, count } as const;
}
