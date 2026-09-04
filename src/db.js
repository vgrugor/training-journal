const DB_NAME = "personal-day-journal";
const DB_VERSION = 1;

const STORES = [
  "days",
  "strengthWorkouts",
  "cyclingWorkouts",
  "exercises",
  "bands",
  "supplements",
  "supplementIntakes"
];

let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("days")) {
        db.createObjectStore("days", { keyPath: "date" });
      }

      for (const name of STORES.filter((store) => store !== "days")) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          if (["strengthWorkouts", "cyclingWorkouts", "supplementIntakes"].includes(name)) {
            store.createIndex("date", "date", { unique: false });
          }
          if (name === "strengthWorkouts") {
            store.createIndex("exerciseId", "exerciseId", { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getByKey(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

export async function remove(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getByDate(storeName, date) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const index = db.transaction(storeName).objectStore(storeName).index("date");
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function exportAll() {
  const entries = await Promise.all(STORES.map(async (store) => [store, await getAll(store)]));
  return Object.fromEntries(entries);
}

export async function importAll(payload) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, "readwrite");
    for (const storeName of STORES) {
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of payload[storeName] || []) {
        store.put(item);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function seedDefaults() {
  const [exercises, bands, supplements] = await Promise.all([
    getAll("exercises"),
    getAll("bands"),
    getAll("supplements")
  ]);

  await Promise.all(["pullups", "dips"].map((id) => remove("exercises", id)));
  if (exercises.length === 0) {
    await Promise.all(DEFAULT_EXERCISES.map((item) => put("exercises", item)));
  }

  await Promise.all(["light", "medium", "strong"].map((id) => remove("bands", id)));
  if (bands.length === 0) {
    await Promise.all(DEFAULT_BANDS.map((item) => put("bands", item)));
  }

  if (supplements.length === 0) {
    await put("supplements", { id: "supplement-example", name: "Приклад добавки", defaultDose: "", notes: "" });
  }
}

const DEFAULT_EXERCISES = [
  { id: "pullups-reverse-grip", name: "Підтягування зворотним хватом", category: "Тяга", lowerRepTarget: 5, upperRepTarget: 10, defaultSets: 5, loadMode: "band" },
  { id: "ring-pullups", name: "Підтягування на кільцях", category: "Тяга", lowerRepTarget: 5, upperRepTarget: 10, defaultSets: 5, loadMode: "band" },
  { id: "horizontal-pullups", name: "Горизонтальні підтягування", category: "Тяга", lowerRepTarget: 5, upperRepTarget: 10, defaultSets: 5, loadMode: "band" },
  { id: "handstand-pushups", name: "Віджимання у стійці", category: "Жим", lowerRepTarget: 5, upperRepTarget: 10, defaultSets: 5, loadMode: "band" },
  { id: "ring-dips", name: "Брусья на кільцях", category: "Жим", lowerRepTarget: 5, upperRepTarget: 10, defaultSets: 5, loadMode: "band" },
  { id: "squats", name: "Присідання", category: "Ноги", lowerRepTarget: 10, upperRepTarget: 15, defaultSets: 5, loadMode: "weight" },
  { id: "leg-raises", name: "Підйоми ніг", category: "Прес", lowerRepTarget: 5, upperRepTarget: 10, defaultSets: 5, loadMode: "technical_step", defaultTechnique: "Зігнуті в колінах до паралелі" },
  { id: "skip", name: "Пропуск", category: "Пропуск", lowerRepTarget: null, upperRepTarget: null, defaultSets: 0, loadMode: "skip" }
];

const DEFAULT_BANDS = [
  { id: "none", name: "Без резинки", assistanceLevel: 0, notes: "" },
  { id: "green", name: "Зелена", assistanceLevel: 1, notes: "" },
  { id: "purple", name: "Фіолетова", assistanceLevel: 2, notes: "" },
  { id: "black", name: "Чорна", assistanceLevel: 3, notes: "" },
  { id: "red", name: "Червона", assistanceLevel: 4, notes: "" },
  { id: "yellow", name: "Жовта", assistanceLevel: 5, notes: "" }
];
