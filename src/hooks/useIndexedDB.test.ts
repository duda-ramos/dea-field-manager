import { describe, it, expect, beforeEach } from 'vitest';
import { useIndexedDB, type IDBDriver } from './useIndexedDB';

class FakeOpenRequest {
  onerror: ((this: IDBRequest, ev: Event) => unknown) | null = null;
  onsuccess: ((this: IDBRequest, ev: Event) => unknown) | null = null;
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null = null;
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null = null;
  readyState: IDBRequestReadyState = 'done';
  result: unknown;
  error: DOMException | null = null;
}

// Simple in-memory map to emulate an object store
class MemoryDB {
  stores = new Map<string, Map<string, Record<string, unknown>>>();
}

function createMemoryDriver() {
  const mem = new MemoryDB();

  const driver: IDBDriver = {
    open: (name: string, _version: number) => {
      const req = new FakeOpenRequest();
      const db = {
        name,
        objectStoreNames: { contains: (s: string) => mem.stores.has(s) },
        createObjectStore: (s: string, _opts: unknown) => { mem.stores.set(s, new Map()); return {}; },
        transaction: (storeName: string, _mode: IDBTransactionMode) => {
          const store = mem.stores.get(storeName)!;
          const tx = {
            objectStore: () => ({
              put: (record: Record<string, unknown> & { id: string }) => { store.set(record.id, record); },
              get: (id: string) => {
                const req: { result?: unknown; onsuccess?: ((ev: Event) => unknown) | null } = {};
                setTimeout(() => {
                  req.result = store.get(id);
                  req.onsuccess?.({} as Event);
                }, 0);
                return req;
              },
              count: () => {
                const req: { result?: unknown; onsuccess?: ((ev: Event) => unknown) | null } = {};
                setTimeout(() => {
                  req.result = store.size;
                  req.onsuccess?.({} as Event);
                }, 0);
                return req;
              },
            }),
            oncomplete: null as ((ev: Event) => unknown) | null,
            onerror: null as ((ev: Event) => unknown) | null,
          };
          setTimeout(() => tx.oncomplete && tx.oncomplete({} as Event), 0);
          return tx as IDBTransaction;
        },
      };
      // First open triggers upgrade
      if (!mem.stores.has('images')) {
        req.result = db;
        setTimeout(() => req.onupgradeneeded && req.onupgradeneeded.call(req as IDBOpenDBRequest, {} as IDBVersionChangeEvent));
        mem.stores.set('images', new Map());
      }
      req.result = db;
      setTimeout(() => req.onsuccess && req.onsuccess.call(req as IDBOpenDBRequest, {} as Event));
      return req as IDBOpenDBRequest;
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
