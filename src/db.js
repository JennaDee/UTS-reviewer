let connection;
export function openDB() {
  return (connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("uts-study-hub", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("profiles", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      connection = null;
      reject(req.error);
    };
  }));
}
async function transaction(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", mode);
    const req = action(tx.objectStore("profiles"));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("Storage transaction aborted"));
  });
}
export const listProfiles = () => transaction("readonly", (s) => s.getAll());
export const saveProfile = (p) => transaction("readwrite", (s) => s.put(p));
export const saveProfiles = (profiles) =>
  transaction("readwrite", (s) => {
    for (const p of profiles) s.put(p);
  });
