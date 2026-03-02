// src/utils/migration.js — Migration localStorage v1 → v2 (IndexedDB)

import { saveAllLessonsToIDB, isIndexedDBAvailable } from './db';

const STORAGE_KEY = 'studyQuestData';
export const CURRENT_VERSION = 2;

/**
 * Extrait les métadonnées légères depuis un objet lessons complet.
 * @param {Object} lessons - { lessonId: { name, cards, stats, ... } }
 * @returns {Object} { lessonId: { name, cardCount, stats } }
 */
export function extractLessonsMeta(lessons) {
  const meta = {};
  for (const [id, lesson] of Object.entries(lessons)) {
    meta[id] = {
      name: lesson.name,
      cardCount: lesson.cards ? lesson.cards.length : 0,
      stats: lesson.stats || { studied: 0, correct: 0, incorrect: 0 },
    };
  }
  return meta;
}

/**
 * Sauvegarde les métadonnées au format v2 dans localStorage.
 */
export function saveMetaToLocalStorage(currentLessonId, folders, lessonsMeta) {
  const metaData = {
    version: CURRENT_VERSION,
    currentLessonId,
    folders,
    lessonsMeta,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metaData));
}

/**
 * Vérifie si une migration est nécessaire.
 * Retourne true si les données sont en ancien format (pas de version 2).
 */
export function needsMigration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.version !== CURRENT_VERSION && data.lessons !== undefined;
  } catch {
    return false;
  }
}

/**
 * Effectue la migration v1 → v2 :
 * 1. Lit les données complètes depuis localStorage
 * 2. Les écrit dans IndexedDB
 * 3. Remplace localStorage par le format v2 (métadonnées uniquement)
 * 4. Retourne les données complètes pour utilisation immédiate dans le state
 *
 * @param {function} onProgress - callback optionnel (current, total)
 * @returns {Promise<{ lessons, currentLessonId, folders }>}
 */
export async function migrateToV2(onProgress) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = JSON.parse(raw);

  // Assurer que les dossiers existent (compat pré-dossiers)
  if (!data.folders) {
    const lessonIds = Object.keys(data.lessons);
    data.folders = {
      uncategorized: {
        name: 'Sans dossier',
        color: '#6B7280',
        lessonIds,
        isExpanded: true,
      },
    };
  }

  const lessonCount = Object.keys(data.lessons).length;
  if (onProgress) onProgress(0, lessonCount);

  const idbAvailable = await isIndexedDBAvailable();

  if (idbAvailable) {
    // Écrire toutes les leçons dans IndexedDB
    await saveAllLessonsToIDB(data.lessons);
    if (onProgress) onProgress(lessonCount, lessonCount);

    // Remplacer localStorage par le format v2 (métadonnées uniquement)
    const meta = extractLessonsMeta(data.lessons);
    saveMetaToLocalStorage(data.currentLessonId, data.folders, meta);
  }
  // Si IDB indisponible, on laisse localStorage tel quel (fallback gracieux)

  return {
    lessons: data.lessons,
    currentLessonId: data.currentLessonId,
    folders: data.folders,
  };
}
