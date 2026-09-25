// src/utils/plusSurvey.js — Sondage FlashMap Plus : quand l'afficher, et mémorisation de la réponse

const SURVEY_STORAGE_KEY = 'flashmapPlusSurvey';
const DATA_STORAGE_KEY = 'studyQuestData';

// « Plus tard » : le modal revient au démarrage, 2 jours après
export const REMIND_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

// Données créées automatiquement au premier lancement : elles ne comptent pas
// comme une utilisation de FlashMap
const DEFAULT_LESSON_ID = 'default';
const DEFAULT_FOLDER_ID = 'uncategorized';

export const ANSWERS = {
  yesMonthly: 'yes_monthly',
  yesAnnual: 'yes_annual',
  no: 'no',
};

export const NO_REASONS = [
  { id: 'too_expensive', label: 'C\'est trop cher' },
  { id: 'free_is_enough', label: 'La version gratuite me suffit' },
  { id: 'cant_pay_online', label: 'Je ne peux pas payer en ligne' },
  { id: 'not_interested', label: 'Les fonctionnalités ne m\'intéressent pas' },
  { id: 'other', label: 'Autre' },
];

export const COMMENT_MAX_LENGTH = 500;

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Vrai si les données sauvegardées contiennent au moins une leçon ou un dossier
 * créé par l'utilisateur (la Leçon Exemple et « Sans dossier » ne comptent pas).
 * Gère le format v2 (lessonsMeta) et l'ancien format v1 (lessons).
 */
export function hasUserData(rawStudyQuestData) {
  const data = parseJson(rawStudyQuestData);
  if (!data || typeof data !== 'object') return false;

  const lessons = data.version === 2 ? data.lessonsMeta : data.lessons;
  const lessonIds = Object.keys(lessons || {});
  const folderIds = Object.keys(data.folders || {});

  return lessonIds.some(id => id !== DEFAULT_LESSON_ID) || folderIds.some(id => id !== DEFAULT_FOLDER_ID);
}

/**
 * Décide si le sondage doit s'ouvrir au démarrage.
 * À appeler avec le contenu du localStorage lu AVANT la première sauvegarde de l'app.
 */
export function shouldShowPlusSurvey({ rawStudyQuestData, rawSurveyState, now, isShareLink }) {
  if (isShareLink) return false;
  if (!hasUserData(rawStudyQuestData)) return false;

  const state = parseJson(rawSurveyState);
  if (state?.status === 'answered') return false;
  if (state?.status === 'later' && now < state.remindAt) return false;

  return true;
}

function readSurveyState() {
  try {
    return parseJson(localStorage.getItem(SURVEY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeSurveyState(state) {
  try {
    localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible : le sondage reviendra au prochain démarrage
  }
}

/**
 * Lit le localStorage au démarrage et dit si le sondage doit s'ouvrir.
 */
export function shouldShowPlusSurveyOnStartup() {
  try {
    return shouldShowPlusSurvey({
      rawStudyQuestData: localStorage.getItem(DATA_STORAGE_KEY),
      rawSurveyState: localStorage.getItem(SURVEY_STORAGE_KEY),
      now: Date.now(),
      isShareLink: new URLSearchParams(window.location.search).has('share'),
    });
  } catch {
    return false;
  }
}

export function markSurveyAnswered(answer, now = Date.now()) {
  writeSurveyState({ status: 'answered', answer, answeredAt: now });
}

/**
 * Reporte le sondage de 2 jours. Retourne le nombre de reports (celui-ci compris).
 */
export function markSurveyLater(now = Date.now()) {
  const previous = readSurveyState();
  const laterCount = (previous?.status === 'later' ? previous.laterCount || 0 : 0) + 1;
  writeSurveyState({ status: 'later', remindAt: now + REMIND_DELAY_MS, laterCount });
  return laterCount;
}
