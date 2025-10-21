import { describe, it, expect, beforeEach } from 'vitest';
import { useIndexedDB, type IDBDriver } from './useIndexedDB';

class FakeOpenRequest {
  onerror: ((this: IDBRequest, ev: Event) => any) | null = null;
  onsuccess: ((this: IDBRequest, ev: Event) => any) | null = null;
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any) | null = null;
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => any) | null = null;
  readyState: IDBRequestReadyState = 'done';
  result: any;
  error: DOMException | null = null;
}

// Simple in-memory map to emulate an object store
class MemoryDB {
  stores = new Map<string, Map<string, any>>();
}

function createMemoryDriver() {
  const mem = new MemoryDB();

  const driver: IDBDriver = {
    open: (name: string, _version: number) => {
      const req = new FakeOpenRequest();
      const db: any = {
        name,
        objectStoreNames: { contains: (s: string) => mem.stores.has(s) },
        createObjectStore: (s: string, _opts: any) => { mem.stores.set(s, new Map()); return {}; },
        transaction: (storeName: string, _mode: IDBTransactionMode) => {
          const store = mem.stores.get(storeName)!;
          const tx: any = {
            objectStore: () => ({
              put: (record: any) => { store.set(record.id, record); },
              get: (id: string) => {
                const req: any = {};
                setTimeout(() => {
                  req.result = store.get(id);
                  req.onsuccess && req.onsuccess({} as any);
                }, 0);
                return req;
              },
              count: () => {
                const req: any = {};
                setTimeout(() => {
                  req.result = store.size;
                  req.onsuccess && req.onsuccess({} as any);
                }, 0);
                return req;
              },
            }),
            oncomplete: null,
            onerror: null,
          };
          setTimeout(() => tx.oncomplete && tx.oncomplete({} as any), 0);
          return tx as any;
        },
      };
      // First open triggers upgrade
      if (!mem.stores.has('images')) {
        req.result = db;
        setTimeout(() => req.onupgradeneeded && req.onupgradeneeded.call(req as any, {} as any));
        mem.stores.set('images', new Map());
      }
      req.result = db;
      setTimeout(() => req.onsuccess && req.onsuccess.call(req as any, {} as any));
      return req as any;
    },
  };

  return driver;
}

describe('useIndexedDB', () => {
  let driver: IDBDriver;
  beforeEach(() => {
    driver = createMemoryDriver();
  });

  it('stores and retrieves image records', async () => {
    const { putImage, getImage, count } = useIndexedDB('db', 1, driver);
    await putImage({ id: '1', projectId: 'p', size: 10, type: 'image/jpeg', data: new Blob() });
    expect(await count()).toBe(1);
    const img = await getImage('1');
    expect(img?.projectId).toBe('p');
  });
});
