import { hasUserData, shouldShowPlusSurvey, markSurveyLater, markSurveyAnswered, REMIND_DELAY_MS } from './plusSurvey';

const NOW = 1_800_000_000_000;

const v2Data = (lessonIds, folderIds) => JSON.stringify({
  version: 2,
  currentLessonId: lessonIds[0],
  lessonsMeta: Object.fromEntries(lessonIds.map(id => [id, { name: id, cardCount: 3 }])),
  folders: Object.fromEntries(folderIds.map(id => [id, { name: id, lessonIds: [] }])),
});

const DEFAULT_ONLY = v2Data(['default'], ['uncategorized']);
const WITH_LESSON = v2Data(['default', 'lesson_1'], ['uncategorized']);

const show = (overrides) => shouldShowPlusSurvey({
  rawStudyQuestData: WITH_LESSON,
  rawSurveyState: null,
  now: NOW,
  isShareLink: false,
  ...overrides,
});

describe('hasUserData', () => {
  it('ignore les nouveaux utilisateurs et les données par défaut', () => {
    expect(hasUserData(null)).toBe(false);
    expect(hasUserData('pas du json')).toBe(false);
    expect(hasUserData(DEFAULT_ONLY)).toBe(false);
  });

  it('détecte une leçon ou un dossier créé par l\'utilisateur', () => {
    expect(hasUserData(WITH_LESSON)).toBe(true);
    expect(hasUserData(v2Data(['default'], ['uncategorized', 'folder_1']))).toBe(true);
    expect(hasUserData(v2Data([], ['folder_1']))).toBe(true);
  });

  it('gère l\'ancien format v1', () => {
    expect(hasUserData(JSON.stringify({ lessons: { default: {}, abc: {} } }))).toBe(true);
    expect(hasUserData(JSON.stringify({ lessons: { default: {} } }))).toBe(false);
  });
});

describe('shouldShowPlusSurvey', () => {
  it('s\'affiche pour un utilisateur qui a déjà des leçons', () => {
    expect(show()).toBe(true);
  });

  it('ne s\'affiche pas sans données ni sur un lien de partage', () => {
    expect(show({ rawStudyQuestData: null })).toBe(false);
    expect(show({ rawStudyQuestData: DEFAULT_ONLY })).toBe(false);
    expect(show({ isShareLink: true })).toBe(false);
  });

  it('ne s\'affiche plus une fois répondu', () => {
    expect(show({ rawSurveyState: JSON.stringify({ status: 'answered', answer: 'no' }) })).toBe(false);
  });

  it('revient 2 jours après « Plus tard »', () => {
    const later = JSON.stringify({ status: 'later', remindAt: NOW + REMIND_DELAY_MS, laterCount: 1 });
    expect(show({ rawSurveyState: later })).toBe(false);
    expect(show({ rawSurveyState: later, now: NOW + REMIND_DELAY_MS - 1 })).toBe(false);
    expect(show({ rawSurveyState: later, now: NOW + REMIND_DELAY_MS })).toBe(true);
  });
});

describe('mémorisation', () => {
  beforeEach(() => localStorage.clear());

  it('compte les reports successifs', () => {
    expect(markSurveyLater(NOW)).toBe(1);
    expect(markSurveyLater(NOW)).toBe(2);
    expect(JSON.parse(localStorage.getItem('flashmapPlusSurvey'))).toEqual({
      status: 'later', remindAt: NOW + REMIND_DELAY_MS, laterCount: 2,
    });
  });

  it('une réponse remplace le report', () => {
    markSurveyLater(NOW);
    markSurveyAnswered('yes_annual', NOW);
    const raw = localStorage.getItem('flashmapPlusSurvey');
    expect(JSON.parse(raw).status).toBe('answered');
    expect(show({ rawSurveyState: raw, now: NOW + 10 * REMIND_DELAY_MS })).toBe(false);
  });
});
