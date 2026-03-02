// src/utils/db.js — Helpers IndexedDB pour FlashMap

const DB_NAME = 'flashmap-db';
const DB_VERSION = 1;
const STORE_NAME = 'lessons';

let dbInstance = null;

/**
 * Ouvre (ou réutilise) la connexion IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Sauvegarde une leçon complète dans IndexedDB.
 * @param {string} lessonId
 * @param {object} lessonData - { name, cards, stats, ... }
 */
export async function saveLessonToIDB(lessonId, lessonData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: lessonId, ...lessonData });
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Sauvegarde toutes les leçons d'un coup (migration, import complet).
 * @param {Object} lessonsObj - { lessonId: lessonData, ... }
 */
export async function saveAllLessonsToIDB(lessonsObj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [id, data] of Object.entries(lessonsObj)) {
      store.put({ id, ...data });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Charge toutes les leçons depuis IndexedDB.
 * @returns {Promise<Object>} { lessonId: lessonData, ... }
 */
export async function loadAllLessonsFromIDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const result = {};
      for (const entry of request.result) {
        const { id, ...data } = entry;
        result[id] = data;
      }
      resolve(result);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Supprime une leçon de IndexedDB.
 * @param {string} lessonId
 */
export async function deleteLessonFromIDB(lessonId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(lessonId);
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Vide toutes les leçons de IndexedDB (pour import complet / reset).
 */
export async function clearAllLessonsFromIDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Vérifie si IndexedDB est disponible et fonctionnel.
 * @returns {Promise<boolean>}
 */
export async function isIndexedDBAvailable() {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}
