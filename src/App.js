import React, { useState, useEffect, useRef } from 'react';
import { Brain, Plus, RotateCcw, CheckCircle, Trophy, Zap, Target, Gamepad2, Edit, Sparkles, BookOpen, Trash2, Download, Upload, MoreVertical, Folder, FolderPlus, Coffee, Heart, Share2, X, Settings, ArrowLeftRight, Copy, Globe, ExternalLink, Loader, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import analytics from './utils/analytics';

// Helper : ajuste la luminosité d'une couleur hex (factor > 1 = plus clair, < 1 = plus sombre)
function adjustColor(hex, factor) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

// Cache module-level : lucide-react est importé dynamiquement une seule fois
let lucideModulePromise = null;
let lucideModuleCache = null;

// Convertit kebab-case en PascalCase : "alarm-clock" → "AlarmClock"
function toPascalCase(str) {
  return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// Helper : détecte si l'icon est une URL d'image, un nom Lucide (PascalCase/kebab) ou un emoji/texte
function ModeIcon({ icon, size = 'md', className = '' }) {
  const sizeMap    = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-10 h-10', xl: 'w-12 h-12' };
  const imgSizeMap = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9',  xl: 'w-12 h-12' };
  const emojiSize  = { sm: '', md: '', lg: 'text-2xl', xl: 'text-5xl leading-none' };
  const isUrl = typeof icon === 'string' && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:') || icon.startsWith('/'));
  // Traite comme nom d'icône si la string ne contient que des lettres ASCII, chiffres et tirets
  const isPotentialIconName = typeof icon === 'string' && !isUrl && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(icon);
  const iconKey = isPotentialIconName ? toPascalCase(icon) : null;

  // Initialise depuis le cache si déjà chargé (évite le flash au re-render)
  const [DynamicIcon, setDynamicIcon] = useState(() =>
    iconKey && lucideModuleCache ? (lucideModuleCache[iconKey] || null) : null
  );

  useEffect(() => {
    if (!iconKey) { setDynamicIcon(null); return; }
    // Déjà en cache → synchrone
    if (lucideModuleCache) {
      setDynamicIcon(() => lucideModuleCache[iconKey] || null);
      return;
    }
    // Import dynamique unique : crée la promesse une seule fois
    if (!lucideModulePromise) {
      lucideModulePromise = import('lucide-react');
    }
    lucideModulePromise.then(mod => {
      lucideModuleCache = mod;
      setDynamicIcon(() => mod[iconKey] || null);
    });
  }, [iconKey]);

  if (isUrl) {
    return <img src={icon} alt="" className={`${imgSizeMap[size] || imgSizeMap.md} object-contain rounded ${className}`} />;
  }
  if (DynamicIcon) {
    return <DynamicIcon className={`${sizeMap[size] || sizeMap.md} ${className}`} />;
  }
  return <span className={`${emojiSize[size] || ''} ${className}`}>{icon || '🧩'}</span>;
}

export default function FlashcardApp() {
  const defaultCards = [
    { id: 1, front: 'Quelle est la capitale de la France ?', back: 'Paris', nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 },
    { id: 2, front: 'Combien font 15 × 12 ?', back: '180', nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 },
    { id: 3, front: 'Qui a écrit "Roméo et Juliette" ?', back: 'William Shakespeare', nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 },
    { id: 4, front: 'Quel est le symbole chimique de l\'or ?', back: 'Au', nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 },
    { id: 5, front: 'Combien y a-t-il de continents ?', back: '7', nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 },
    { id: 6, front: 'Quelle est la plus grande planète du système solaire ?', back: 'Jupiter', nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 }
  ];

  const defaultLessons = {
    'default': {
      name: 'Leçon Exemple',
      cards: defaultCards,
      stats: { studied: 0, correct: 0, incorrect: 0 }
    }
  };
  const defaultFolders = {
    'uncategorized': {
      name: 'Sans dossier',
      color: '#6B7280',
      lessonIds: ['default'],
      isExpanded: true
    }
  };

  const loadInitialData = () => {
    try {
      const savedData = localStorage.getItem('studyQuestData');
      if (savedData) {
        const data = JSON.parse(savedData);

        // Format v2 : métadonnées uniquement, les cartes viendront de IndexedDB
        if (data.version === 2) {
          const skeletonLessons = {};
          for (const [id, meta] of Object.entries(data.lessonsMeta || {})) {
            skeletonLessons[id] = {
              name: meta.name,
              cards: [],
              stats: meta.stats || { studied: 0, correct: 0, incorrect: 0 },
            };
          }
          return {
            lessons: skeletonLessons,
            currentLessonId: data.currentLessonId,
            folders: data.folders,
            isV2: true,
          };
        }

        // Ancien format (v1) : données complètes dans localStorage
        if (!data.folders) {
          const lessonIds = Object.keys(data.lessons);
          data.folders = {
            'uncategorized': {
              name: 'Sans dossier',
              color: '#6B7280',
              lessonIds: lessonIds,
              isExpanded: true
            }
          };
        }
        return { ...data, isV2: false };
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
    return null; // Nouvel utilisateur
  };

  const initialData = loadInitialData();
  const startData = initialData || {
    lessons: defaultLessons,
    currentLessonId: 'default',
    folders: defaultFolders,
    isV2: false,
  };

  const [lessons, setLessons] = useState(startData.lessons);
  const [currentLessonId, setCurrentLessonId] = useState(startData.currentLessonId);
  const [cards, setCards] = useState(startData.lessons[startData.currentLessonId]?.cards || []);
  const [stats, setStats] = useState(startData.lessons[startData.currentLessonId]?.stats || { studied: 0, correct: 0, incorrect: 0 });
  const [folders, setFolders] = useState(startData.folders);
  const [isHydrating, setIsHydrating] = useState(true);
  const [migrationProgress, setMigrationProgress] = useState(null);
  const useIDBRef = useRef(true);
  
  const [mode, setMode] = useState('menu');
  const [prevMode, setPrevMode] = useState('menu');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionQueue, setSessionQueue] = useState([]); // File de cartes pour la session en cours (IDs)
  const [isFlipped, setIsFlipped] = useState(false);
  const [reversedCards, setReversedCards] = useState(false);
  const [showReversedLabel, setShowReversedLabel] = useState(false);
  const [showFlipLabel, setShowFlipLabel] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newCardFrontImage, setNewCardFrontImage] = useState(null);
  const [newCardBackImage, setNewCardBackImage] = useState(null);
  const [newWrongAnswers, setNewWrongAnswers] = useState(['', '', '']);
  const [showNewWrongAnswers, setShowNewWrongAnswers] = useState(false);
  const [showEditingWrongAnswers, setShowEditingWrongAnswers] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editingCardFront, setEditingCardFront] = useState('');
  const [editingCardBack, setEditingCardBack] = useState('');
  const [editingCardFrontImage, setEditingCardFrontImage] = useState(null);
  const [editingCardBackImage, setEditingCardBackImage] = useState(null);
  const [editingWrongAnswers, setEditingWrongAnswers] = useState(['', '', '']);

  const [newLessonName, setNewLessonName] = useState('');
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showLessonTypeModal, setShowLessonTypeModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingLessonName, setEditingLessonName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState(null);
  
  const [matchCards, setMatchCards] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  
  const [mcqQuestion, setMcqQuestion] = useState(null);
  const [mcqOptions, setMcqOptions] = useState([]);
  const [mcqAnswer, setMcqAnswer] = useState(null);
  const [mcqScore, setMcqScore] = useState(0);
  const [mcqTotal, setMcqTotal] = useState(0);
  
  const [typeQuestion, setTypeQuestion] = useState(null);
  const [typeInput, setTypeInput] = useState('');
  const [typeResult, setTypeResult] = useState(null);
  const [typeScore, setTypeScore] = useState(0);
  const [typeTotal, setTypeTotal] = useState(0);
  const [typeOptions, setTypeOptions] = useState([]);
  const [typeSelectedOption, setTypeSelectedOption] = useState(null);
  
  const [magicLessonName, setMagicLessonName] = useState('');
  const [magicInstructions, setMagicInstructions] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // 🔑 Clé API Gemini hardcodée (laisser vide pour utiliser la clé saisie par l'utilisateur)
  const HARDCODED_GEMINI_KEY = process.env.REACT_APP_GEMINI_API_KEY || ''; // <- Coller la clé ici si besoin
  const [geminiApiKey, setGeminiApiKey] = useState(HARDCODED_GEMINI_KEY || localStorage.getItem('geminiApiKey') || '');

  // 🏪 URL du registre de modes communautaires (changer pour la prod)
  const REGISTRY_URL = '/modes-registry.json';
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(false);
  const [showMagicPreviewModal, setShowMagicPreviewModal] = useState(false);
  // TODO: retirer avant déploiement
  window.__showMagicPreview = () => setShowMagicPreviewModal(true);
  window.__showLoadingOverlay = () => { setIsHydrating(true); setTimeout(() => setIsHydrating(false), 3000); };
  window.__showMigrationOverlay = () => { setMigrationProgress({ current: 0, total: 5 }); let i = 0; const t = setInterval(() => { i++; setMigrationProgress({ current: i, total: 5 }); if (i >= 5) { clearInterval(t); setTimeout(() => setMigrationProgress(null), 500); } }, 600); };
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [toastAction, setToastAction] = useState(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMagicMenu, setShowMagicMenu] = useState(false);
  const [showAltModelModal, setShowAltModelModal] = useState(false);
  const [showPromptExample, setShowPromptExample] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportValue, setJsonImportValue] = useState('');
  const [jsonImportName, setJsonImportName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366F1');
  const [draggedLesson, setDraggedLesson] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);

  // États pour le partage de leçons
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDuration, setShareDuration] = useState('24h');
  const [shareOneTime, setShareOneTime] = useState(false);
  const [shareCode, setShareCode] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // États pour l'import de leçons
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importedLesson, setImportedLesson] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);

  // États pour l'import Quizlet
  const [showQuizletModal, setShowQuizletModal] = useState(false);
  const [quizletUrl, setQuizletUrl] = useState('');
  const [quizletLoading, setQuizletLoading] = useState(false);
  const [quizletError, setQuizletError] = useState(null);
  const [quizletData, setQuizletData] = useState(null);

  // États pour "Mes partages"
  const [showMySharesModal, setShowMySharesModal] = useState(false);
  const [myShares, setMyShares] = useState([]);
  const [shareToDelete, setShareToDelete] = useState(null);
  const [menuColumns, setMenuColumns] = useState(2);

  // États pour l'aperçu de partage via URL
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [sharePreviewData, setSharePreviewData] = useState(null);
  const [sharePreviewLoading, setSharePreviewLoading] = useState(false);
  const [sharePreviewError, setSharePreviewError] = useState(null);

  // États pour le drag-and-drop mobile
  const [touchLongPressTimer, setTouchLongPressTimer] = useState(null);
  const [isDraggingTouch, setIsDraggingTouch] = useState(false);
  const [touchCurrentPos, setTouchCurrentPos] = useState({ x: 0, y: 0 });
  const [touchHoverFolderId, setTouchHoverFolderId] = useState(null);
  const [lastHoveredFolderId, setLastHoveredFolderId] = useState(null);

  // Modes de jeu externes
  const [installedModes, setInstalledModes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flashmapExternalModes') || '{}'); }
    catch { return {}; }
  });
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState('');
  const [registryModes, setRegistryModes] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState('');
  const [registrySearch, setRegistrySearch] = useState('');
  const [installingModeId, setInstallingModeId] = useState(null);
  const [selectedRegistryMode, setSelectedRegistryMode] = useState(null);
  const [hoveredModeId, setHoveredModeId] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [manageTab, setManageTab] = useState('cards');
  const [confirmUninstallMode, setConfirmUninstallMode] = useState(null);
  const [confirmResetProgress, setConfirmResetProgress] = useState(false);
  const [showInstalledModesModal, setShowInstalledModesModal] = useState(false);
  const [activeExternalModeId, setActiveExternalModeId] = useState(null);
  const [activeExternalModeName, setActiveExternalModeName] = useState('');
  const [externalModeLoadingId, setExternalModeLoadingId] = useState(null);
  const [showExternalEditModal, setShowExternalEditModal] = useState(false);
  const [externalEditModeId, setExternalEditModeId] = useState(null);
  const externalModeContainerRef = useRef(null);
  const externalEditContainerRef = useRef(null);
  const loadedModulesRef = useRef(new Map());

  const fileInputRef = useRef(null);
  const magicFileInputRef = useRef(null);
  const gameModesRef = useRef(null);
  const typeInputRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Analytics: Track game session
  const gameStartTimeRef = useRef(null);
  const gameStartModeRef = useRef(null);

  const dueCards = cards.filter(card => card.nextReview <= Date.now());
  const currentCard = sessionQueue.length > 0 ? (cards.find(c => c.id === sessionQueue[0]) || null) : null;

  // Hydratation : charger les données depuis IndexedDB au mount
  useEffect(() => {
    const hydrate = async () => {
      // Nouvel utilisateur : sauvegarder les données par défaut dans IDB
      if (!initialData) {
        try {
          const { isIndexedDBAvailable, saveAllLessonsToIDB } = await import('./utils/db');
          const idbOk = await isIndexedDBAvailable();
          useIDBRef.current = idbOk;
          if (idbOk) {
            await saveAllLessonsToIDB(defaultLessons);
            const { saveMetaToLocalStorage, extractLessonsMeta } = await import('./utils/migration');
            saveMetaToLocalStorage('default', defaultFolders, extractLessonsMeta(defaultLessons));
          }
        } catch (error) {
          console.error('Erreur init IndexedDB:', error);
          useIDBRef.current = false;
        }
        setIsHydrating(false);
        return;
      }

      // Ancien format (v1) : lancer la migration
      if (!initialData.isV2) {
        try {
          const { isIndexedDBAvailable } = await import('./utils/db');
          const idbOk = await isIndexedDBAvailable();
          useIDBRef.current = idbOk;
          if (idbOk) {
            setMigrationProgress({ current: 0, total: Object.keys(initialData.lessons).length });
            const { migrateToV2 } = await import('./utils/migration');
            await migrateToV2((current, total) => {
              setMigrationProgress({ current, total });
            });
            setMigrationProgress(null);
            setToastMessage('Stockage amélioré ! Vous pouvez désormais créer plus de leçons avec plus de contenu.');
            setToastType('success');
            setShowToast(true);
          }
        } catch (error) {
          console.error('Erreur migration:', error);
          useIDBRef.current = false;
        }
        // Les données v1 sont déjà en mémoire depuis loadInitialData
        setIsHydrating(false);
        return;
      }

      // Format v2 : charger les données complètes depuis IndexedDB
      try {
        const { loadAllLessonsFromIDB, isIndexedDBAvailable } = await import('./utils/db');
        const idbOk = await isIndexedDBAvailable();
        useIDBRef.current = idbOk;
        if (idbOk) {
          const fullLessons = await loadAllLessonsFromIDB();
          setLessons(prev => {
            const merged = { ...prev };
            for (const [id, idbData] of Object.entries(fullLessons)) {
              merged[id] = { ...prev[id], ...idbData };
            }
            return merged;
          });
          const currentFull = fullLessons[startData.currentLessonId];
          if (currentFull) {
            setCards(currentFull.cards || []);
            setStats(currentFull.stats || { studied: 0, correct: 0, incorrect: 0 });
          }
        }
      } catch (error) {
        console.error('Erreur chargement IndexedDB:', error);
        useIDBRef.current = false;
      }
      setIsHydrating(false);
    };

    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bloquer le scroll pendant le drag mobile
  useEffect(() => {
    if (isDraggingTouch) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isDraggingTouch]);

  // Sauvegarde hybride : métadonnées dans localStorage, données complètes dans IndexedDB
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (isHydrating) return;

    // 1. Métadonnées dans localStorage (sync, toujours petit)
    try {
      const { extractLessonsMeta, saveMetaToLocalStorage } = require('./utils/migration');
      const meta = extractLessonsMeta(lessons);
      saveMetaToLocalStorage(currentLessonId, folders, meta);
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error);
    }

    // 2. Données complètes dans IndexedDB (async, debounced 500ms)
    if (useIDBRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const { saveAllLessonsToIDB } = await import('./utils/db');
          await saveAllLessonsToIDB(lessons);
        } catch (error) {
          console.error('Erreur sauvegarde IndexedDB:', error);
          // Fallback : tenter localStorage complet
          try {
            const dataToSave = { lessons, currentLessonId, folders };
            localStorage.setItem('studyQuestData', JSON.stringify(dataToSave));
          } catch (lsError) {
            if (lsError.name === 'QuotaExceededError' || lsError.name === 'NS_ERROR_DOM_QUOTA_REACHED' || lsError.code === 22) {
              setToastMessage('Stockage plein : vos données n\'ont pas pu être sauvegardées. Supprimez des images pour libérer de l\'espace.');
              setToastType('error');
              setShowToast(true);
            }
          }
        }
      }, 500);
    }

    return () => clearTimeout(saveTimerRef.current);
  }, [lessons, currentLessonId, folders, isHydrating]);

  // Sauvegarder les modes externes installés
  useEffect(() => {
    localStorage.setItem('flashmapExternalModes', JSON.stringify(installedModes));
  }, [installedModes]);

  // Charger les partages depuis localStorage et nettoyer les anciens
  useEffect(() => {
    try {
      const savedShares = localStorage.getItem('myShares');
      if (savedShares) {
        const shares = JSON.parse(savedShares);
        // Nettoyer les partages expirés depuis plus de 24h
        const now = new Date().getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const cleanedShares = shares.filter(share => {
          if (!share.expiresAt) return true; // Garder les partages illimités
          const expiresAt = new Date(share.expiresAt).getTime();
          return expiresAt + oneDayInMs > now; // Garder si pas expiré ou expiré depuis moins de 24h
        });
        setMyShares(cleanedShares);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des partages:', error);
    }
  }, []);

  // Sauvegarder les partages dans localStorage
  useEffect(() => {
    try {
      localStorage.setItem('myShares', JSON.stringify(myShares));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des partages:', error);
    }
  }, [myShares]);

  // Détecter le paramètre ?share= dans l'URL au chargement
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareCode = urlParams.get('share');

    if (shareCode) {
      // Récupérer les données de la leçon partagée
      setSharePreviewLoading(true);
      setSharePreviewError(null);
      setShowSharePreview(true);

      fetch(`${API_URL}/retrieve/${shareCode}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSharePreviewData({
              code: shareCode,
              lesson: typeof data.lesson === 'string' ? JSON.parse(data.lesson) : data.lesson,
              expiresAt: data.expiresAt,
              remainingUses: data.remainingUses
            });
          } else {
            setSharePreviewError(data.error || 'Code introuvable');
          }
        })
        .catch(error => {
          console.error('Erreur lors de la récupération:', error);
          setSharePreviewError('Erreur de connexion au serveur');
        })
        .finally(() => {
          setSharePreviewLoading(false);
        });
    }
  }, []);

  // Focus automatique sur le champ de texte en mode type
  useEffect(() => {
    if (mode === 'type' && typeInputRef.current && typeResult === null) {
      typeInputRef.current.focus();
    }
  }, [typeQuestion, mode, typeResult]);

  // Entrée pour passer à la question suivante après feedback
  useEffect(() => {
    if (mode !== 'type' || typeResult === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') nextTypeQuestion();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, typeResult]);

  // Entrée pour passer à la question suivante en QCM
  useEffect(() => {
    if (mode !== 'mcq' || mcqAnswer === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        setMcqAnswer(null);
        nextMcqQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, mcqAnswer]);

  useEffect(() => {
    if (lessons[currentLessonId]) {
      setLessons(prev => ({
        ...prev,
        [currentLessonId]: {
          ...prev[currentLessonId],
          cards: [...cards],
          stats: {...stats}
        }
      }));
    }
  }, [cards, stats, currentLessonId]);

  useEffect(() => {
    if (mode !== prevMode) {
      setAnimationKey(prev => prev + 1);

      // Analytics: Track game start/complete
      const gameModes = ['flashcards', 'mcq', 'type', 'match'];
      const isStartingGame = gameModes.includes(mode) && !gameModes.includes(prevMode);
      const isEndingGame = !gameModes.includes(mode) && gameModes.includes(prevMode);

      if (isStartingGame) {
        // Début d'un jeu
        gameStartTimeRef.current = Date.now();
        gameStartModeRef.current = mode;
        analytics.trackGameStarted(mode, currentLessonId);
      } else if (isEndingGame && gameStartTimeRef.current && gameStartModeRef.current) {
        // Fin d'un jeu
        const duration = Math.floor((Date.now() - gameStartTimeRef.current) / 1000); // en secondes
        const gameMode = gameStartModeRef.current;

        // Récupérer le score selon le mode
        let score = 0;
        let cardsPlayed = 0;

        if (gameMode === 'mcq') {
          score = mcqScore;
          cardsPlayed = mcqTotal;
        } else if (gameMode === 'type') {
          score = typeScore;
          cardsPlayed = typeTotal;
        } else if (gameMode === 'match') {
          score = matchedPairs.length;
          cardsPlayed = matchCards.length / 2;
        } else if (gameMode === 'flashcards') {
          cardsPlayed = currentIndex;
        }

        analytics.trackGameCompleted(gameMode, currentLessonId, {
          duration,
          score,
          cardsPlayed
        });

        // Reset
        gameStartTimeRef.current = null;
        gameStartModeRef.current = null;
      }

      setPrevMode(mode);
      window.scrollTo(0, 0);
    }
  }, [mode, prevMode, currentLessonId, mcqScore, mcqTotal, typeScore, typeTotal, matchedPairs, matchCards, currentIndex]);

  // Nettoyer les styles des cartes de leçons quand la leçon sélectionnée change
  useEffect(() => {
    // Nettoyer tous les styles inline des cartes de leçons
    const lessonCards = document.querySelectorAll('.cursor-move');
    lessonCards.forEach(card => {
      card.style.borderColor = '';
      card.style.backgroundColor = '';
    });
  }, [currentLessonId]);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Forcer le déblocage du scroll au chargement
  useEffect(() => {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  // Analytics : Track session start
  useEffect(() => {
    analytics.trackSessionStart();
  }, []);

  const exportData = () => {
    const data = {
      lessons: lessons,
      currentLessonId: currentLessonId,
      folders: folders,
      exportDate: new Date().toISOString()
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-quest-backup-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.lessons && data.currentLessonId) {
          setLessons(data.lessons);
          setCurrentLessonId(data.currentLessonId);
          setCards(data.lessons[data.currentLessonId].cards);
          setStats(data.lessons[data.currentLessonId].stats);
          // Importer les dossiers s'ils existent, sinon utiliser un tableau vide
          if (data.folders) {
            setFolders(data.folders);
          } else {
            setFolders([]);
          }
          setMode('menu');
          setToastMessage('Données importées avec succès !');
          setToastType('success');
          setShowToast(true);

          // Synchroniser IndexedDB avec l'import complet
          if (useIDBRef.current) {
            import('./utils/db').then(({ clearAllLessonsFromIDB, saveAllLessonsToIDB }) => {
              clearAllLessonsFromIDB()
                .then(() => saveAllLessonsToIDB(data.lessons))
                .catch(console.error);
            });
          }
        }
      } catch (error) {
        alert('Erreur de chargement du fichier. Veuillez vous assurer qu\'il s\'agit d\'un fichier de sauvegarde Study Quest valide.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Fonctions pour le partage de leçons via API
  const API_URL = 'https://api.flashmap.app/api';

  const shareLesson = async () => {
    setShareLoading(true);
    setShareError(null);

    try {
      const currentLesson = lessons[currentLessonId];

      const response = await fetch(`${API_URL}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lesson: currentLesson,
          duration: shareDuration,
          oneTime: shareOneTime
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du partage');
      }

      const data = await response.json();
      setShareCode(data.code);

      // Enregistrer le partage dans l'historique
      const newShare = {
        code: data.code,
        lessonName: currentLesson.name,
        lessonId: currentLessonId,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt,
        duration: shareDuration,
        oneTime: shareOneTime
      };
      setMyShares(prev => [newShare, ...prev]);

      setToastMessage('Leçon partagée avec succès !');
      setToastType('success');

    } catch (error) {
      console.error('Erreur partage:', error);
      setShareError(error.message);
      setToastMessage('Erreur lors du partage de la leçon');
      setToastType('error');
    } finally {
      setShareLoading(false);
    }
  };

  const retrieveLesson = async () => {
    if (!importCode.trim() || importCode.length !== 5) {
      setImportError('Le code doit contenir exactement 5 caractères');
      return;
    }

    setImportLoading(true);
    setImportError(null);

    try {
      const response = await fetch(`${API_URL}/retrieve/${importCode.toUpperCase()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Code introuvable');
      }

      const data = await response.json();
      setImportedLesson(data.lesson);

    } catch (error) {
      console.error('Erreur récupération:', error);
      setImportError(error.message);
      setToastMessage(error.message);
      setToastType('error');
    } finally {
      setImportLoading(false);
    }
  };

  const addImportedLesson = () => {
    if (!importedLesson) return;

    // Créer un nouvel ID pour la leçon
    const newLessonId = Date.now().toString();

    // Ajouter la leçon aux leçons existantes
    const newLessons = {
      ...lessons,
      [newLessonId]: {
        ...importedLesson,
        id: newLessonId
      }
    };

    setLessons(newLessons);

    // Ajouter la leçon dans "Sans dossier"
    const newFolders = { ...folders };
    if (!newFolders.uncategorized) {
      newFolders.uncategorized = { lessonIds: [] };
    }
    newFolders.uncategorized.lessonIds.push(newLessonId);
    setFolders(newFolders);

    // Analytics: Track lesson import (via code or URL)
    analytics.trackLessonImported('code');

    // Réinitialiser et fermer
    setShowImportModal(false);
    setImportCode('');
    setImportedLesson(null);
    setImportError(null);

    setToastMessage(`Leçon "${importedLesson.name}" importée avec succès !`);
    setToastType('success');
  };

  const resetShareModal = () => {
    setShowShareModal(false);
    setShareCode(null);
    setShareDuration('24h');
    setShareOneTime(false);
    setShareError(null);
    setCodeCopied(false);
    setLinkCopied(false);
  };

  const confirmDeleteShare = () => {
    if (shareToDelete !== null) {
      setMyShares(prev => prev.filter((_, i) => i !== shareToDelete));
      setToastMessage('Partage supprimé');
      setToastType('success');
      setShowToast(true);
      setShareToDelete(null);
    }
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportCode('');
    setImportedLesson(null);
    setImportError(null);
  };

  // Fonctions pour l'import Quizlet
  const importFromQuizlet = async () => {
    if (!quizletUrl.trim() || !quizletUrl.includes('quizlet.com')) {
      setQuizletError('Veuillez entrer une URL Quizlet valide');
      return;
    }

    setQuizletLoading(true);
    setQuizletError(null);

    try {
      const response = await fetch(`${API_URL}/quizlet/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: quizletUrl })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Erreur lors de l\'importation');
      }

      const data = await response.json();
      setQuizletData(data.data);

    } catch (error) {
      console.error('Erreur import Quizlet:', error);
      setQuizletError(error.message);
      setToastMessage(error.message);
      setToastType('error');
    } finally {
      setQuizletLoading(false);
    }
  };

  const addQuizletLesson = () => {
    if (!quizletData) return;

    // Créer un nouvel ID pour la leçon
    const newLessonId = Date.now().toString();

    // Convertir les cartes Quizlet au format FlashMap
    const flashmapCards = quizletData.cards.map((card, index) => ({
      id: Date.now() + index,
      front: card.term,
      back: card.definition,
      image: card.imageUrl || null,
      mastered: false
    }));

    // Créer la leçon
    const newLesson = {
      id: newLessonId,
      name: quizletData.title,
      cards: flashmapCards,
      stats: {
        flashcardsCompleted: 0,
        quizScore: 0,
        writeScore: 0,
        matchTime: null
      }
    };

    // Ajouter la leçon aux leçons existantes
    const newLessons = {
      ...lessons,
      [newLessonId]: newLesson
    };

    setLessons(newLessons);

    // Ajouter la leçon dans "Sans dossier"
    const newFolders = { ...folders };
    if (!newFolders.uncategorized) {
      newFolders.uncategorized = { lessonIds: [] };
    }
    newFolders.uncategorized.lessonIds.push(newLessonId);
    setFolders(newFolders);

    // Analytics: Track lesson import from Quizlet
    analytics.trackLessonImported('quizlet');

    // Réinitialiser et fermer
    resetQuizletModal();

    setToastMessage(`Leçon "${quizletData.title}" importée depuis Quizlet avec succès !`);
    setToastType('success');
  };

  const resetQuizletModal = () => {
    setShowQuizletModal(false);
    setQuizletUrl('');
    setQuizletData(null);
    setQuizletError(null);
  };

  const switchLesson = (lessonId) => {
    const lesson = lessons[lessonId];
    setCurrentLessonId(lessonId);
    setCards([...lesson.cards]);
    setStats({...lesson.stats});
    setCurrentIndex(0);
    setSessionQueue([]);
    setIsFlipped(false);
    setMode('menu');

    // Scroll vers les modes de jeu après un court délai
    setTimeout(() => {
      if (gameModesRef.current) {
        gameModesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const createNewLesson = () => {
    if (!newLessonName.trim()) return;

    const newId = Date.now().toString();
    const newLesson = {
      name: newLessonName,
      cards: [],
      stats: { studied: 0, correct: 0, incorrect: 0 }
    };

    setLessons(prev => ({
      ...prev,
      [newId]: newLesson
    }));

    // Ajouter la leçon au dossier "Sans dossier"
    setFolders(prev => ({
      ...prev,
      uncategorized: {
        ...prev.uncategorized,
        lessonIds: [...prev.uncategorized.lessonIds, newId]
      }
    }));

    setNewLessonName('');
    setShowLessonTypeModal(false);

    setCurrentLessonId(newId);
    setCards([]);
    setStats({ studied: 0, correct: 0, incorrect: 0 });
    setCurrentIndex(0);
    setSessionQueue([]);
    setIsFlipped(false);
    setMode('manage');

    // Analytics: Track lesson creation
    analytics.trackLessonCreated(newId, 0);
  };

  const deleteLesson = (lessonId) => {
    if (Object.keys(lessons).length <= 1) return;

    // Analytics: Track lesson deletion
    analytics.trackLessonDeleted(lessonId);

    const newLessons = { ...lessons };
    delete newLessons[lessonId];
    setLessons(newLessons);

    // Supprimer de IndexedDB
    if (useIDBRef.current) {
      import('./utils/db').then(({ deleteLessonFromIDB }) => {
        deleteLessonFromIDB(lessonId).catch(console.error);
      });
    }

    // Supprimer la leçon de tous les dossiers
    const newFolders = { ...folders };
    Object.keys(newFolders).forEach(folderId => {
      newFolders[folderId].lessonIds = newFolders[folderId].lessonIds.filter(id => id !== lessonId);
    });
    setFolders(newFolders);

    if (currentLessonId === lessonId) {
      const firstLessonId = Object.keys(newLessons)[0];
      switchLesson(firstLessonId);
    }
  };

  const startEditingLesson = (lessonId, lessonName) => {
    setEditingLessonId(lessonId);
    setEditingLessonName(lessonName);
  };

  const saveEditingLesson = () => {
    if (!editingLessonName.trim() || !editingLessonId) return;

    setLessons(prev => ({
      ...prev,
      [editingLessonId]: {
        ...prev[editingLessonId],
        name: editingLessonName
      }
    }));

    // Analytics: Track lesson edit
    analytics.trackLessonEdited(editingLessonId);

    setEditingLessonId(null);
    setEditingLessonName('');
  };

  const cancelEditingLesson = () => {
    setEditingLessonId(null);
    setEditingLessonName('');
  };

  // Fonctions de gestion des dossiers
  const createFolder = () => {
    if (!newFolderName.trim()) return;

    const newId = Date.now().toString();
    const newFolder = {
      name: newFolderName,
      color: newFolderColor,
      lessonIds: [],
      isExpanded: true
    };

    setFolders(prev => ({
      ...prev,
      [newId]: newFolder
    }));

    setShowFolderModal(false);
    setNewFolderName('');
    setNewFolderColor('#6366F1');
  };

  const updateFolder = () => {
    if (!newFolderName.trim() || !editingFolderId) return;

    setFolders(prev => ({
      ...prev,
      [editingFolderId]: {
        ...prev[editingFolderId],
        name: newFolderName,
        color: newFolderColor
      }
    }));

    setShowFolderModal(false);
    setEditingFolderId(null);
    setNewFolderName('');
    setNewFolderColor('#6366F1');
  };

  const deleteFolder = (folderId) => {
    if (folderId === 'uncategorized') return; // Ne pas supprimer le dossier par défaut

    const folder = folders[folderId];
    const newFolders = { ...folders };
    delete newFolders[folderId];

    // Déplacer les leçons vers le dossier "Sans dossier"
    if (folder.lessonIds && folder.lessonIds.length > 0) {
      newFolders['uncategorized'] = {
        ...newFolders['uncategorized'],
        lessonIds: [...newFolders['uncategorized'].lessonIds, ...folder.lessonIds]
      };
    }

    setFolders(newFolders);
  };

  const toggleFolderExpand = (folderId) => {
    setFolders(prev => ({
      ...prev,
      [folderId]: {
        ...prev[folderId],
        isExpanded: !prev[folderId].isExpanded
      }
    }));
  };

  const moveLessonToFolder = (lessonId, targetFolderId) => {
    // Retirer la leçon de tous les dossiers
    const newFolders = { ...folders };
    Object.keys(newFolders).forEach(folderId => {
      newFolders[folderId].lessonIds = newFolders[folderId].lessonIds.filter(id => id !== lessonId);
    });

    // Ajouter la leçon au dossier cible
    if (newFolders[targetFolderId]) {
      newFolders[targetFolderId].lessonIds.push(lessonId);
    }

    setFolders(newFolders);
  };

  // Gestion du drag-and-drop mobile
  const handleTouchStart = (e, lessonId) => {
    const touch = e.touches[0];
    const timer = setTimeout(() => {
      // Après 500ms, on démarre le drag
      setDraggedLesson(lessonId);
      setIsDraggingTouch(true);
      setTouchCurrentPos({ x: touch.clientX, y: touch.clientY });
      // Feedback haptique si disponible
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
    setTouchLongPressTimer(timer);
  };

  const handleTouchMove = (e) => {
    if (isDraggingTouch) {
      e.preventDefault();
      const touch = e.touches[0];
      setTouchCurrentPos({ x: touch.clientX, y: touch.clientY });

      // Détecter le dossier sous le doigt
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      let folderElement = elementBelow;
      let foundFolderId = null;

      while (folderElement && !foundFolderId) {
        if (folderElement.dataset && folderElement.dataset.folderId) {
          foundFolderId = folderElement.dataset.folderId;
        }
        folderElement = folderElement.parentElement;
      }

      // Feedback haptique si on entre dans un nouveau dossier
      if (foundFolderId && foundFolderId !== lastHoveredFolderId) {
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        setLastHoveredFolderId(foundFolderId);
      } else if (!foundFolderId && lastHoveredFolderId) {
        // Réinitialiser quand on quitte tous les dossiers
        setLastHoveredFolderId(null);
      }

      setTouchHoverFolderId(foundFolderId);
    }
  };

  const handleTouchEnd = (e) => {
    // Annuler le timer si le doigt est levé avant 500ms
    if (touchLongPressTimer) {
      clearTimeout(touchLongPressTimer);
      setTouchLongPressTimer(null);
    }

    if (isDraggingTouch && draggedLesson) {
      // Trouver l'élément sous le doigt
      const touch = e.changedTouches[0];
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

      // Chercher si on est au-dessus d'un dossier
      let folderElement = elementBelow;
      let targetFolderId = null;

      while (folderElement && !targetFolderId) {
        if (folderElement.dataset && folderElement.dataset.folderId) {
          targetFolderId = folderElement.dataset.folderId;
        }
        folderElement = folderElement.parentElement;
      }

      if (targetFolderId) {
        moveLessonToFolder(draggedLesson, targetFolderId);
      }

      // Réinitialiser l'état
      setDraggedLesson(null);
      setIsDraggingTouch(false);
      setTouchHoverFolderId(null);
      setLastHoveredFolderId(null);
    }
  };

  const handleTouchCancel = () => {
    // Annuler complètement le drag en cas d'interruption (notification, appel, etc.)
    if (touchLongPressTimer) {
      clearTimeout(touchLongPressTimer);
      setTouchLongPressTimer(null);
    }
    setDraggedLesson(null);
    setIsDraggingTouch(false);
    setTouchHoverFolderId(null);
    setLastHoveredFolderId(null);
  };


  const startMatchGame = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, 6);
    const matchPairs = [];
    shuffled.forEach(card => {
      matchPairs.push({ id: `${card.id}-front`, text: card.front, image: card.frontImage, pairId: card.id, type: 'front' });
      matchPairs.push({ id: `${card.id}-back`, text: card.back, image: card.backImage, pairId: card.id, type: 'back' });
    });
    setMatchCards(matchPairs.sort(() => Math.random() - 0.5));
    setSelectedMatch([]);
    setMatchedPairs([]);
    setMode('match');
  };

  const handleMatchClick = (card) => {
    if (matchedPairs.includes(card.pairId)) return;
    if (selectedMatch.find(s => s.id === card.id)) return;
    
    const newSelected = [...selectedMatch, card];
    setSelectedMatch(newSelected);
    
    if (newSelected.length === 2) {
      if (newSelected[0].pairId === newSelected[1].pairId) {
        setMatchedPairs([...matchedPairs, newSelected[0].pairId]);
        setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
        if (matchedPairs.length + 1 === matchCards.length / 2) {
          setShowConfetti(true);
        }
        setTimeout(() => setSelectedMatch([]), 500);
      } else {
        setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
        setTimeout(() => setSelectedMatch([]), 1000);
      }
    }
  };

  const startMcqGame = () => {
    setMcqScore(0);
    setMcqTotal(0);
    setMode('mcq');
    nextMcqQuestion();
  };

  const nextMcqQuestion = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const question = shuffled[0];

    let wrongAnswers = [];
    if (question.wrongAnswers && question.wrongAnswers.length > 0) {
      // Utiliser les faux choix custom
      wrongAnswers = question.wrongAnswers.map((wa, i) => ({ text: wa, image: null, id: `wrong-${i}` }));
      // Compléter avec des réponses aléatoires si moins de 3 faux choix
      if (wrongAnswers.length < 3) {
        const otherCards = shuffled.filter(c => c.id !== question.id);
        const extraNeeded = 3 - wrongAnswers.length;
        const extra = otherCards.slice(0, extraNeeded).map(c => ({ text: c.back, image: c.backImage, id: c.id }));
        wrongAnswers = [...wrongAnswers, ...extra];
      }
    } else {
      // Comportement par défaut : piocher dans les autres cartes
      wrongAnswers = shuffled.slice(1, 4).map(c => ({ text: c.back, image: c.backImage, id: c.id }));
    }

    const allOptions = [{ text: question.back, image: question.backImage, id: question.id, isCorrect: true }, ...wrongAnswers].sort(() => Math.random() - 0.5);

    setMcqQuestion(question);
    setMcqOptions(allOptions);
    setMcqAnswer(null);
  };

  const handleMcqAnswer = (answer) => {
    setMcqAnswer(answer);
    setMcqTotal(mcqTotal + 1);

    if (answer.isCorrect) {
      setMcqScore(mcqScore + 1);
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
  };

  const startTypeGame = () => {
    setTypeScore(0);
    setTypeTotal(0);
    setMode('type');
    nextTypeQuestion();
  };

  const nextTypeQuestion = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const question = shuffled[0];
    setTypeQuestion(question);
    setTypeInput('');
    setTypeResult(null);
    setTypeSelectedOption(null);

    // Afficher toutes les réponses image-seulement de la leçon
    const imageOnlyAnswers = cards.filter(c => !c.back.trim() && c.backImage);
    if (imageOnlyAnswers.length > 0) {
      const options = imageOnlyAnswers.map(c => ({
        text: c.back,
        image: c.backImage,
        id: c.id,
        isCorrect: c.id === question.id
      }));
      setTypeOptions(options);
    } else {
      setTypeOptions([]);
    }
  };

  const levenshteinDistance = (a, b) => {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  };

  const handleTypeSubmit = () => {
    if (!typeInput.trim()) return;

    const input = typeInput.trim().toLowerCase();
    const answer = typeQuestion.back.toLowerCase();
    const distance = levenshteinDistance(input, answer);

    // Seuils proportionnels à la longueur de la réponse
    // correctTolerance : compte comme juste (vert)
    // almostTolerance : état neutre "presque" (orange, ni +1 ni -1)
    const correctTolerance = answer.length <= 3 ? 0 : answer.length <= 6 ? 1 : 2;
    const almostTolerance = answer.length <= 3 ? 1 : answer.length <= 6 ? 2 : 3;

    let result;
    if (distance <= correctTolerance) {
      result = 'correct';
    } else if (distance <= almostTolerance) {
      result = 'almost';
    } else {
      result = 'incorrect';
    }

    setTypeTotal(typeTotal + 1);
    setTypeResult(result);

    if (result === 'correct') {
      setTypeScore(typeScore + 1);
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else if (result === 'incorrect') {
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
  };

  const handleTypeImageAnswer = (option) => {
    setTypeSelectedOption(option);
    setTypeResult(option.isCorrect ? 'correct' : 'incorrect');
    setTypeTotal(typeTotal + 1);

    if (option.isCorrect) {
      setTypeScore(typeScore + 1);
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
  };

  const handleMagicFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (validTypes.includes(file.type)) {
        setUploadedFile(file);
      } else {
        alert('Type de fichier non supporté. Veuillez uploader une image (PNG, JPG) ou un PDF.');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (validTypes.includes(file.type)) {
        setUploadedFile(file);
      } else {
        alert('Type de fichier non supporté. Veuillez uploader une image (PNG, JPG) ou un PDF.');
      }
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (magicFileInputRef.current) {
      magicFileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const importFlashcardsFromJson = (jsonString, lessonName) => {
    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON invalide');
    const flashcards = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(flashcards) || flashcards.length === 0) throw new Error('Le JSON doit contenir au moins une carte');

    const newId = Date.now().toString();
    const newCards = flashcards.map((card, index) => ({
      id: Date.now() + index,
      front: card.question,
      back: card.answer,
      wrongAnswers: Array.isArray(card.wrongAnswers) ? card.wrongAnswers.filter(a => a && a.trim()) : [],
      nextReview: Date.now(),
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0
    }));

    const newLesson = {
      name: lessonName,
      cards: newCards,
      stats: { studied: 0, correct: 0, incorrect: 0 }
    };

    setLessons(prev => ({ ...prev, [newId]: newLesson }));
    setFolders(prev => ({
      ...prev,
      uncategorized: {
        ...prev.uncategorized,
        lessonIds: [...prev.uncategorized.lessonIds, newId]
      }
    }));
    setCurrentLessonId(newId);
    setCards(newCards);
    setStats({ studied: 0, correct: 0, incorrect: 0 });
    setCurrentIndex(0);
    setIsFlipped(false);
    setMagicLessonName('');
    setMagicInstructions('');
    setUploadedFile(null);
    setMode('menu');
    setShowMagicPreviewModal(true);

    return newCards;
  };

  const generateMagicLesson = async () => {
    if (!magicLessonName.trim() || !uploadedFile) return;

    setIsGenerating(true);

    try {
      const base64File = await fileToBase64(uploadedFile);
      const mimeType = uploadedFile.type;

      const prompt = `Analyse ce document et génère le MAXIMUM de flashcards possible pour apprendre son contenu de manière exhaustive.${magicInstructions.trim() ? `\n\nInstructions spécifiques de l'utilisateur : ${magicInstructions.trim()}` : ''}

IMPORTANT: Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, dans ce format exact:
[
  {"question": "Question 1", "answer": "Réponse 1", "wrongAnswers": ["Faux choix 1", "Faux choix 2", "Faux choix 3"]},
  {"question": "Question 2", "answer": "Réponse 2", "wrongAnswers": ["Faux choix 1", "Faux choix 2", "Faux choix 3"]}
]

Règles STRICTES:
- Génère AU MOINS 20 flashcards, et jusqu'à 50 si le document le permet
- Couvre TOUS les concepts, détails, définitions, dates, noms, chiffres importants
- Questions claires, précises et directes (sans fioriture)
- Réponses ULTRA-COURTES : 1 à 5 mots maximum, ou une phrase très courte (max 10 mots)
- Élimine tout mot superflu : pas de "c'est", "il s'agit de", "on peut dire que"
- Réponds de façon directe et factuelle uniquement
- Questions variées : définitions, dates, personnes, formules, concepts clés, relations cause-effet
- Pour chaque carte, génère EXACTEMENT 3 faux choix (wrongAnswers) qui sont plausibles mais incorrects
- Les faux choix doivent être du même type/format que la bonne réponse (même longueur approximative, même catégorie)
- Les faux choix doivent être crédibles pour rendre le QCM challengeant
- Retourne UNIQUEMENT le JSON, rien d'autre

Exemples de réponses COURTES (à suivre) :
❌ MAUVAIS : "Il s'agit de la capitale de la France qui est située au nord du pays"
✅ BON : "Paris" avec wrongAnswers: ["Lyon", "Marseille", "Bordeaux"]

❌ MAUVAIS : "C'est le processus par lequel les plantes convertissent la lumière en énergie"
✅ BON : "Photosynthèse" avec wrongAnswers: ["Respiration", "Fermentation", "Osmose"]

❌ MAUVAIS : "On peut dire que c'est environ 9,81 mètres par seconde au carré"
✅ BON : "9,81 m/s²" avec wrongAnswers: ["6,67 m/s²", "3,14 m/s²", "1,62 m/s²"]`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64File
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error && errorData.error.code === 503 && errorData.error.status === 'UNAVAILABLE') {
          setToastMessage('Le modèle est surchargé. Veuillez réessayer dans quelques instants.');
          setToastType('error');
          setToastAction(() => generateMagicLesson);
          setShowToast(true);
          return;
        }
        throw new Error('Erreur lors de la génération');
      }

      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;

      const newCards = importFlashcardsFromJson(textResponse, magicLessonName);

      setToastMessage(`Magic Lesson créée avec succès ! ${newCards.length} cartes générées.`);
      setToastType('success');
      setToastAction(null);
      setShowToast(true);

      // Analytics: Track Magic Lesson usage
      const source = mimeType.startsWith('image/') ? 'image' : 'text';
      analytics.trackMagicLessonUsed(source, newCards.length);

    } catch (error) {
      console.error('Erreur:', error);
      setToastMessage('Erreur lors de la génération des cartes. Vérifiez votre clé API et réessayez.');
      setToastType('error');
      setToastAction(null);
      setShowToast(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // ===== MODES DE JEU EXTERNES =====

  // Setup global FlashMap SDK
  useEffect(() => {
    if (!window.FlashMap) window.FlashMap = {};
    window.FlashMap.registerMode = () => {
      console.warn('FlashMap.registerMode appelé en dehors du contexte d\'installation');
    };
    window.FlashMap.version = '1.0.0';
    // Icônes Lucide disponibles pour les modes externes (chargées dynamiquement)
    // Usage : const { Zap, Trophy, AlarmClock } = await window.FlashMap.icons
    if (!lucideModulePromise) {
      lucideModulePromise = import('lucide-react');
    }
    lucideModulePromise.then(mod => {
      lucideModuleCache = mod;
      window.FlashMap.icons = mod;
    });
  }, []);

  // Retourne la liste des modes actifs pour la leçon courante
  const getActiveGameModes = () => {
    const lesson = lessons[currentLessonId];
    const gm = lesson?.gameModes;

    const builtinModes = [
      { id: 'flashcards', name: 'Cartes Classiques', description: 'Apprentissage par répétition espacée', icon: 'Zap', colorFrom: 'blue-500', colorTo: 'blue-600', always: true },
      { id: 'match', name: "Jeu d'Association", description: 'Associez les questions aux réponses', icon: 'Target', colorFrom: 'purple-500', colorTo: 'purple-600' },
      { id: 'mcq', name: 'Choix Multiple', description: 'Choisissez la bonne réponse rapidement', icon: 'CheckCircle', colorFrom: 'green-500', colorTo: 'green-600' },
      { id: 'type', name: 'Défi de Frappe', description: 'Tapez la bonne réponse de mémoire', icon: 'Gamepad2', colorFrom: 'orange-500', colorTo: 'orange-600' },
    ];

    const activeModes = builtinModes.filter(m =>
      m.always || !gm || gm[m.id] !== false
    );

    // Ajouter les modes externes activés POUR CETTE LEÇON uniquement
    Object.values(installedModes).forEach(ext => {
      if (gm && gm[ext.id] === true) {
        activeModes.push({
          id: ext.id,
          name: ext.name,
          description: ext.description || '',
          icon: ext.icon || 'puzzle',
          color: ext.color || '#6366F1',
          isExternal: true,
        });
      }
    });

    return activeModes;
  };

  // Toggle un mode de jeu pour la leçon courante
  const toggleGameMode = (modeId, enabled) => {
    setLessons(prev => ({
      ...prev,
      [currentLessonId]: {
        ...prev[currentLessonId],
        gameModes: {
          ...prev[currentLessonId].gameModes,
          [modeId]: enabled
        }
      }
    }));
  };

  // Chargement dynamique d'un script externe
  const loadExternalMode = async (url) => {
    // Vérifier que l'URL retourne bien du JavaScript
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erreur HTTP ${res.status} pour ${url}`);
    const text = await res.text();
    const trimmed = text.trimStart().toLowerCase();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      throw new Error('L\'URL ne retourne pas un fichier JavaScript valide');
    }

    return new Promise((resolve, reject) => {
      const previousRegister = window.FlashMap.registerMode;
      window.FlashMap.registerMode = (modeDef) => {
        window.FlashMap.registerMode = previousRegister;
        clearTimeout(timeout);
        resolve(modeDef);
      };
      const blob = new Blob([text], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.src = blobUrl;
      script.onerror = () => {
        window.FlashMap.registerMode = previousRegister;
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Erreur d'exécution du script`));
      };
      const timeout = setTimeout(() => {
        window.FlashMap.registerMode = previousRegister;
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Timeout : le mode n\'a pas appelé registerMode()'));
      }, 10000);
      script.onload = () => URL.revokeObjectURL(blobUrl);
      document.body.appendChild(script);
    });
  };

  // Lancer un mode externe
  const startExternalMode = async (modeId) => {
    const modeMeta = installedModes[modeId];
    if (!modeMeta) return;

    // Charger le module si pas encore en mémoire (après refresh)
    if (!loadedModulesRef.current.has(modeId)) {
      setExternalModeLoadingId(modeId);
      try {
        const moduleDef = await loadExternalMode(modeMeta.url);
        loadedModulesRef.current.set(modeId, moduleDef);
        // Mettre à jour les métadonnées si elles ont changé dans le script
        setInstalledModes(prev => ({
          ...prev,
          [modeId]: {
            ...prev[modeId],
            name: moduleDef.name || prev[modeId].name,
            icon: moduleDef.icon || prev[modeId].icon,
            color: moduleDef.color || prev[modeId].color,
            version: moduleDef.version || prev[modeId].version,
            hasEditMode: !!moduleDef.onEdit,
          }
        }));
      } catch (err) {
        setToastMessage('Erreur de chargement : ' + err.message);
        setToastType('error');
        setShowToast(true);
        setExternalModeLoadingId(null);
        return;
      } finally {
        setExternalModeLoadingId(null);
      }
    }

    // Module prêt → on switch la page
    setActiveExternalModeId(modeId);
    setActiveExternalModeName(modeMeta.name);
    setMode('external-play');
  };

  // useEffect pour appeler onPlay quand le container est prêt
  useEffect(() => {
    if (mode !== 'external-play' || !externalModeContainerRef.current || !activeExternalModeId) return;

    const moduleDef = loadedModulesRef.current.get(activeExternalModeId);
    if (!moduleDef) return;

    const lesson = lessons[currentLessonId];
    const cardsCopy = cards.map(c => ({
      id: c.id, front: c.front, back: c.back,
      frontImage: c.frontImage || null, backImage: c.backImage || null,
      wrongAnswers: c.wrongAnswers || []
    }));

    try {
      moduleDef.onPlay({
        container: externalModeContainerRef.current,
        cards: cardsCopy,
        lessonName: lesson?.name || '',
        customData: lesson?.externalModeData?.[activeExternalModeId] || null,
        onComplete: ({ correct, incorrect, studied }) => {
          setStats(prev => ({
            ...prev,
            correct: prev.correct + (correct || 0),
            incorrect: prev.incorrect + (incorrect || 0),
            studied: prev.studied + (studied || 0)
          }));
          if (correct > 0) setShowConfetti(true);
        },
        onExit: () => exitExternalMode(),
      });
    } catch (err) {
      console.error('Erreur dans onPlay:', err);
      setToastMessage('Erreur dans le mode de jeu externe');
      setToastType('error');
      setShowToast(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeExternalModeId]);

  // Quitter un mode externe
  const exitExternalMode = () => {
    const moduleDef = loadedModulesRef.current.get(activeExternalModeId);
    if (moduleDef?.onDestroy) {
      try { moduleDef.onDestroy(); } catch (e) { console.error('onDestroy error:', e); }
    }
    if (externalModeContainerRef.current) externalModeContainerRef.current.innerHTML = '';
    setActiveExternalModeId(null);
    setActiveExternalModeName('');
    setMode('menu');
  };

  // Ouvrir le mode édition d'un mode externe
  const startExternalEdit = async (modeId) => {
    let moduleDef = loadedModulesRef.current.get(modeId);

    // Si le module n'est pas chargé en mémoire, le recharger
    if (!moduleDef && installedModes[modeId]?.url) {
      try {
        moduleDef = await loadExternalMode(installedModes[modeId].url);
        loadedModulesRef.current.set(modeId, moduleDef);
      } catch (err) {
        setToastMessage(`Erreur de chargement du mode: ${err.message}`);
        setToastType('error');
        setShowToast(true);
        return;
      }
    }

    if (!moduleDef?.onEdit) {
      setToastMessage('Ce mode ne supporte pas la configuration');
      setToastType('error');
      setShowToast(true);
      return;
    }

    setExternalEditModeId(modeId);
    setShowExternalEditModal(true);
  };

  // useEffect pour lancer onEdit quand la modal est prête
  useEffect(() => {
    if (!showExternalEditModal || !externalEditContainerRef.current || !externalEditModeId) return;

    const moduleDef = loadedModulesRef.current.get(externalEditModeId);
    if (!moduleDef?.onEdit) return;

    const lesson = lessons[currentLessonId];
    const cardsCopy = cards.map(c => ({
      id: c.id, front: c.front, back: c.back,
      frontImage: c.frontImage || null, backImage: c.backImage || null,
      wrongAnswers: c.wrongAnswers || []
    }));

    try {
      moduleDef.onEdit({
        container: externalEditContainerRef.current,
        cards: cardsCopy,
        lessonName: lesson?.name || '',
        getData: () => lesson?.externalModeData?.[externalEditModeId] || null,
        setData: (data) => {
          setLessons(prev => ({
            ...prev,
            [currentLessonId]: {
              ...prev[currentLessonId],
              externalModeData: {
                ...(prev[currentLessonId].externalModeData || {}),
                [externalEditModeId]: data
              }
            }
          }));
        },
        onClose: () => exitExternalEdit(),
      });
    } catch (err) {
      console.error('Erreur dans onEdit:', err);
      setToastMessage('Erreur lors du chargement de la configuration');
      setToastType('error');
      setShowToast(true);
      exitExternalEdit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExternalEditModal, externalEditModeId]);

  // Fermer le mode édition
  const exitExternalEdit = () => {
    if (externalEditContainerRef.current) externalEditContainerRef.current.innerHTML = '';
    setShowExternalEditModal(false);
    setExternalEditModeId(null);
  };

  // Charger le registre communautaire de modes
  const fetchRegistry = async (forceRefresh = false) => {
    if (registryModes.length > 0 && !forceRefresh) return;
    setRegistryLoading(true);
    setRegistryError('');
    try {
      const res = await fetch(REGISTRY_URL);
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
      const data = await res.json();
      setRegistryModes(data.modes || []);
    } catch (err) {
      setRegistryError('Impossible de charger le catalogue. Vérifiez votre connexion.');
    } finally {
      setRegistryLoading(false);
    }
  };

  // Installer un mode depuis le registre communautaire
  const installFromRegistry = async (registryMode) => {
    setInstallingModeId(registryMode.id);
    try {
      const moduleDef = await loadExternalMode(registryMode.scriptUrl);
      if (!moduleDef.id || !moduleDef.name || !moduleDef.onPlay || !moduleDef.onDestroy) {
        throw new Error('Le mode est invalide');
      }
      const meta = {
        id: moduleDef.id,
        name: moduleDef.name,
        description: moduleDef.description || registryMode.description || '',
        author: moduleDef.author || registryMode.author || 'Inconnu',
        version: moduleDef.version || registryMode.version || '1.0.0',
        url: registryMode.scriptUrl,
        icon: moduleDef.icon || registryMode.icon || '🧩',
        color: moduleDef.color || registryMode.color || '#6366F1',
        installedAt: Date.now(),
        hasEditMode: !!moduleDef.onEdit,
      };
      setInstalledModes(prev => ({ ...prev, [meta.id]: meta }));
      loadedModulesRef.current.set(meta.id, moduleDef);
      // Activer le mode pour la leçon courante uniquement
      setLessons(prev => ({
        ...prev,
        [currentLessonId]: {
          ...prev[currentLessonId],
          gameModes: {
            ...prev[currentLessonId].gameModes,
            [meta.id]: true
          }
        }
      }));
      setToastMessage(`Mode "${meta.name}" installé et ajouté à cette leçon !`);
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      setToastMessage(err.message);
      setToastType('error');
      setShowToast(true);
    } finally {
      setInstallingModeId(null);
    }
  };

  // Installer un mode externe via URL
  const installExternalMode = async (url) => {
    setStoreLoading(true);
    try {
      const moduleDef = await loadExternalMode(url);
      if (!moduleDef.id || !moduleDef.name || !moduleDef.onPlay || !moduleDef.onDestroy) {
        throw new Error('Le mode doit implémenter id, name, onPlay et onDestroy');
      }
      const meta = {
        id: moduleDef.id,
        name: moduleDef.name,
        description: moduleDef.description || '',
        author: moduleDef.author || 'Inconnu',
        version: moduleDef.version || '1.0.0',
        url: url,
        icon: moduleDef.icon || 'puzzle',
        color: moduleDef.color || '#6366F1',
        installedAt: Date.now(),
        hasEditMode: !!moduleDef.onEdit,
      };
      setInstalledModes(prev => ({ ...prev, [meta.id]: meta }));
      loadedModulesRef.current.set(meta.id, moduleDef);
      // Activer le mode pour la leçon courante uniquement
      setLessons(prev => ({
        ...prev,
        [currentLessonId]: {
          ...prev[currentLessonId],
          gameModes: {
            ...prev[currentLessonId].gameModes,
            [meta.id]: true
          }
        }
      }));
      setShowStoreModal(false);
      setStoreUrl('');
      setToastMessage(`Mode "${meta.name}" installé et ajouté à cette leçon !`);
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      setToastMessage(err.message);
      setToastType('error');
      setShowToast(true);
    } finally {
      setStoreLoading(false);
    }
  };

  // Désinstaller un mode externe
  const uninstallExternalMode = (modeId) => {
    setInstalledModes(prev => {
      const next = { ...prev };
      delete next[modeId];
      return next;
    });
    loadedModulesRef.current.delete(modeId);
    // Retirer de toutes les leçons
    setLessons(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(lid => {
        if (next[lid].gameModes?.[modeId] !== undefined) {
          const newGM = { ...next[lid].gameModes };
          delete newGM[modeId];
          next[lid] = { ...next[lid], gameModes: newGM };
        }
        if (next[lid].externalModeData?.[modeId]) {
          const newED = { ...next[lid].externalModeData };
          delete newED[modeId];
          next[lid] = { ...next[lid], externalModeData: newED };
        }
      });
      return next;
    });
  };

  // ===== FIN MODES EXTERNES =====

  const flipCard = () => setIsFlipped(!isFlipped);

  const rateCard = (quality) => {
    if (!currentCard) return;

    const card = currentCard;
    const repetitions = card.repetitions ?? 0;
    let newInterval = card.interval ?? 1;
    let newEaseFactor = card.easeFactor ?? 2.5;

    if (quality >= 3) {
      // Mise à jour du facteur de facilité (formule SM-2)
      newEaseFactor = Math.max(1.3, newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

      // Intervalles SM-2 corrects : 1j → 6j → interval × easeFactor
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(newInterval * newEaseFactor);
      }

      const nextReview = Date.now() + newInterval * 24 * 60 * 60 * 1000;
      setCards(cards.map(c => c.id === card.id
        ? { ...c, interval: newInterval, easeFactor: newEaseFactor, repetitions: repetitions + 1, nextReview }
        : c
      ));
      setStats(prev => ({ ...prev, studied: prev.studied + 1, correct: prev.correct + 1 }));

      // Carte réussie → retirer de la file
      setSessionQueue(prev => prev.slice(1));
    } else {
      // Réponse incorrecte : réinitialiser SM-2, remettre en fin de file pour revoir dans la session
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
      setCards(cards.map(c => c.id === card.id
        ? { ...c, repetitions: 0, easeFactor: newEaseFactor }
        : c
      ));
      setStats(prev => ({ ...prev, studied: prev.studied + 1, incorrect: prev.incorrect + 1 }));

      // Déplacer en fin de file pour revoir plus tard dans la session
      setSessionQueue(prev => [...prev.slice(1), prev[0]]);
    }

    setIsFlipped(false);
  };

  // Compresse une image via canvas (max 1200px, JPEG 75%) pour économiser le stockage
  const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Le fichier doit être une image'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file, side, isEditing = false) => {
    try {
      const base64 = await compressImage(file);
      if (isEditing) {
        if (side === 'front') {
          setEditingCardFrontImage(base64);
        } else {
          setEditingCardBackImage(base64);
        }
      } else {
        if (side === 'front') {
          setNewCardFrontImage(base64);
        } else {
          setNewCardBackImage(base64);
        }
      }
    } catch (error) {
      setToastMessage('Erreur lors du chargement de l\'image');
      setToastType('error');
    }
  };

  const addCard = () => {
    // Au moins un contenu (texte ou image) pour la question ET la réponse
    const hasFront = newFront.trim() || newCardFrontImage;
    const hasBack = newBack.trim() || newCardBackImage;

    if (hasFront && hasBack) {
      const newCard = {
        id: Date.now(),
        front: newFront,
        back: newBack,
        frontImage: newCardFrontImage || null,
        backImage: newCardBackImage || null,
        wrongAnswers: newWrongAnswers.filter(a => a.trim()),
        nextReview: Date.now(),
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0
      };
      setCards([...cards, newCard]);
      setNewFront('');
      setNewBack('');
      setNewCardFrontImage(null);
      setNewCardBackImage(null);
      setNewWrongAnswers(['', '', '']);
      setShowNewWrongAnswers(false);
    }
  };

  const deleteCard = (id) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const startEditingCard = (card) => {
    setEditingCardId(card.id);
    setEditingCardFront(card.front);
    setEditingCardBack(card.back);
    setEditingCardFrontImage(card.frontImage || null);
    setEditingCardBackImage(card.backImage || null);
    const wa = card.wrongAnswers || [];
    setEditingWrongAnswers([wa[0] || '', wa[1] || '', wa[2] || '']);
    setShowEditingWrongAnswers(wa.length > 0);
  };

  const saveEditingCard = () => {
    // Au moins un contenu (texte ou image) pour la question ET la réponse
    const hasFront = editingCardFront.trim() || editingCardFrontImage;
    const hasBack = editingCardBack.trim() || editingCardBackImage;

    if (!hasFront || !hasBack) return;

    setCards(cards.map(c =>
      c.id === editingCardId
        ? { ...c, front: editingCardFront, back: editingCardBack, frontImage: editingCardFrontImage, backImage: editingCardBackImage, wrongAnswers: editingWrongAnswers.filter(a => a.trim()) }
        : c
    ));

    setEditingCardId(null);
    setEditingCardFront('');
    setEditingCardBack('');
    setEditingCardFrontImage(null);
    setEditingCardBackImage(null);
    setEditingWrongAnswers(['', '', '']);
  };

  const cancelEditingCard = () => {
    setEditingCardId(null);
    setEditingCardFront('');
    setEditingCardBack('');
    setEditingCardFrontImage(null);
    setEditingCardBackImage(null);
    setEditingWrongAnswers(['', '', '']);
    setShowEditingWrongAnswers(false);
  };

  const resetProgress = () => {
    const resetCards = cards.map(c => ({ ...c, nextReview: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0 }));
    setCards(resetCards);
    setStats({ studied: 0, correct: 0, incorrect: 0 });
    setCurrentIndex(0);
    setSessionQueue(resetCards.map(c => c.id));
    setIsFlipped(false);
  };

  const flipLesson = () => {
    const currentlyFlipped = !!lessons[currentLessonId]?.flipped;
    const newCards = cards.map(card => {
      const swapped = {
        ...card,
        front: card.back,
        back: card.front,
        frontImage: card.backImage,
        backImage: card.frontImage,
      };
      if (currentlyFlipped) {
        // Restauration : on remet les wrongAnswers sauvegardées
        swapped.wrongAnswers = card._savedWrongAnswers || [];
        delete swapped._savedWrongAnswers;
      } else {
        // Inversion : on sauvegarde les wrongAnswers et on les vide
        swapped._savedWrongAnswers = card.wrongAnswers || [];
        swapped.wrongAnswers = [];
      }
      return swapped;
    });
    setCards(newCards);
    setLessons(prev => ({
      ...prev,
      [currentLessonId]: {
        ...prev[currentLessonId],
        flipped: !currentlyFlipped
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-8 relative">
      {/* Overlay de chargement / migration */}
      {(isHydrating || migrationProgress) && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
            <BookOpen className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
            {migrationProgress ? (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Mise à jour du stockage...
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Vos données sont en cours de migration vers un stockage amélioré. Cela ne prendra qu'un instant.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${migrationProgress.total > 0 ? (migrationProgress.current / migrationProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {migrationProgress.current} / {migrationProgress.total} leçons
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Chargement...
                </h3>
                <p className="text-gray-600 text-sm">
                  Préparation de vos leçons
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute -bottom-32 left-1/2 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 1}s`
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)]
                }}
              />
            </div>
          ))}
        </div>
      )}

      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex flex-col gap-3 px-6 py-4 rounded-xl shadow-2xl ${
            toastType === 'success'
              ? 'bg-gradient-to-r from-green-500 to-green-600'
              : 'bg-gradient-to-r from-red-500 to-red-600'
          } text-white min-w-[320px]`}>
            <div className="flex items-center gap-3">
              {toastType === 'success' ? (
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-xl">!</div>
              )}
              <p className="flex-1 font-medium">{toastMessage}</p>
              <button
                onClick={() => setShowToast(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
            {toastAction && (
              <button
                onClick={() => {
                  setShowToast(false);
                  toastAction();
                }}
                className="w-full px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium transition-all transform hover:scale-105"
              >
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}

      {showLessonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full animate-bounce-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Créer une Nouvelle Leçon</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setShowLessonTypeModal(true);
                }}
                className="group relative p-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-2xl"
              >
                <div className="text-center">
                  <Plus className="w-16 h-16 text-white mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Leçon Classique</h3>
                  <p className="text-indigo-100 text-sm">Créez vos propres cartes manuellement</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setMode('magic-lesson');
                  if (!geminiApiKey.trim()) {
                    setShowApiKeyModal(true);
                  }
                }}
                className="group relative p-8 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-xl hover:from-purple-600 hover:via-pink-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-2xl"
              >
                <div className="absolute top-2 right-2">
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">NEW</span>
                </div>
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-white mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Magic Lesson ✨</h3>
                  <p className="text-purple-100 text-sm">Générez des cartes automatiquement depuis vos documents</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowLessonModal(false);
                setShowImportModal(true);
              }}
              className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl font-semibold flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Importer via code
            </button>

            <button
              onClick={() => setShowLessonModal(false)}
              className="mt-3 w-full px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Configuration API Gemini</h2>
              <button
                onClick={() => setShowApiKeyInfo(!showApiKeyInfo)}
                className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm italic flex items-center justify-center transition-colors flex-shrink-0"
                style={{ fontFamily: 'Georgia, serif' }}
                title="Infos développeur"
              >
                i
              </button>
            </div>
            {showApiKeyInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4 text-xs text-gray-600">
                Vous pouvez hardcoder une clé API directement dans le code source.<br />
                Ouvrez <span className="font-mono bg-gray-200 px-1 rounded">src/App.js</span> à la ligne <span className="font-mono bg-gray-200 px-1 rounded">119</span> et collez votre clé dans <span className="font-mono bg-gray-200 px-1 rounded">HARDCODED_GEMINI_KEY</span>.
              </div>
            )}
            <p className="text-sm text-gray-600 mb-4">
              Pour utiliser les Magic Lessons, vous devez configurer votre clé API Gemini.
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline ml-1">
                Obtenir une clé API
              </a>
            </p>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Entrez votre clé API Gemini..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (geminiApiKey.trim()) {
                    localStorage.setItem('geminiApiKey', geminiApiKey.trim());
                  }
                  setShowApiKeyModal(false);
                  if (geminiApiKey.trim()) {
                    generateMagicLesson();
                  }
                }}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium"
              >
                Enregistrer
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && lessonToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Supprimer la leçon ?</h2>
            <p className="text-gray-600 mb-2 text-center">
              Êtes-vous sûr de vouloir supprimer la leçon
            </p>
            <p className="text-lg font-bold text-gray-800 mb-4 text-center">
              "{lessonToDelete.name}" ?
            </p>
            <p className="text-sm text-red-600 mb-6 text-center">
              Cette action est irréversible. Toutes les cartes seront définitivement perdues.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setLessonToDelete(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  deleteLesson(lessonToDelete.id);
                  setShowDeleteConfirm(false);
                  setLessonToDelete(null);
                }}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all transform hover:scale-105 font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteFolderConfirm && folderToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <Folder className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Supprimer le dossier ?</h2>
            <p className="text-gray-600 mb-2 text-center">
              Êtes-vous sûr de vouloir supprimer le dossier
            </p>
            <p className="text-lg font-bold text-gray-800 mb-4 text-center">
              "{folderToDelete.name}" ?
            </p>
            <p className="text-sm text-blue-600 mb-2 text-center">
              {folderToDelete.lessonCount > 0
                ? `Les ${folderToDelete.lessonCount} leçon${folderToDelete.lessonCount > 1 ? 's' : ''} qu'il contient seront déplacées vers "Sans dossier".`
                : 'Le dossier est vide.'
              }
            </p>
            <p className="text-sm text-red-600 mb-6 text-center">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteFolderConfirm(false);
                  setFolderToDelete(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  deleteFolder(folderToDelete.id);
                  setShowDeleteFolderConfirm(false);
                  setFolderToDelete(null);
                }}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all transform hover:scale-105 font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExportConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
              <Download className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Exporter vos données ?</h2>
            <p className="text-gray-600 mb-4 text-center">
              Cette action va exporter <span className="font-bold text-gray-800">toutes vos données de sauvegarde</span> :
            </p>
            <ul className="text-sm text-gray-700 mb-4 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                Toutes les leçons (pas seulement la leçon active)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                Tous les dossiers et leur organisation
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                Toutes les cartes avec leurs images
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                Toutes vos statistiques de progression
              </li>
            </ul>
            <p className="text-sm text-green-600 mb-6 text-center font-medium">
              Un fichier JSON sera téléchargé sur votre appareil.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportConfirm(false)}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  exportData();
                  setShowExportConfirm(false);
                }}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 font-medium"
              >
                Exporter
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImportConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full">
              <Upload className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Importer des données ?</h2>
            <p className="text-gray-600 mb-4 text-center">
              <span className="font-bold text-red-600">Attention !</span> Cette action va <span className="font-bold text-gray-800">écraser toutes vos données actuelles</span> et les remplacer par les données du fichier importé.
            </p>
            <ul className="text-sm text-gray-700 mb-4 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                Toutes vos leçons actuelles seront supprimées
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                Tous vos dossiers actuels seront supprimés
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                Toutes vos cartes et images seront supprimées
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                Toutes vos statistiques seront supprimées
              </li>
            </ul>
            <p className="text-sm text-orange-600 mb-6 text-center font-medium bg-orange-50 p-3 rounded-lg border border-orange-200">
              Conseil : Exportez vos données actuelles avant d'importer pour éviter toute perte.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportConfirm(false)}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowImportConfirm(false);
                }}
                className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 font-medium"
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !shareCode && resetShareModal()}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            {!shareCode ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full">
                  <Share2 className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Partager la leçon</h2>
                <p className="text-gray-600 mb-4 text-center">
                  Partagez <span className="font-bold text-gray-800">"{lessons[currentLessonId]?.name}"</span> avec un code unique
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Durée de validité
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['1h', '5h', '24h', '7d', 'unlimited'].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setShareDuration(dur)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            shareDuration === dur
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {dur === 'unlimited' ? 'Illimité' : dur.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="oneTime"
                      checked={shareOneTime}
                      onChange={(e) => setShareOneTime(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="oneTime" className="text-sm text-gray-700">
                      Usage unique (suppression après récupération)
                    </label>
                  </div>
                </div>

                {shareError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                    {shareError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetShareModal}
                    disabled={shareLoading}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={shareLesson}
                    disabled={shareLoading}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium disabled:opacity-50"
                  >
                    {shareLoading ? 'Génération...' : 'Générer le code'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Leçon partagée !</h2>
                <p className="text-gray-600 mb-4 text-center">
                  Votre code de partage :
                </p>

                <div className="bg-gray-100 rounded-lg p-6 mb-4 text-center">
                  <div className="text-4xl font-bold text-purple-600 tracking-widest mb-3">
                    {shareCode}
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareCode);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium min-w-[120px]"
                    >
                      {codeCopied ? '✓ Copié !' : '📋 Copier le code'}
                    </button>
                    <button
                      onClick={() => {
                        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareCode}`;
                        navigator.clipboard.writeText(shareUrl);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium min-w-[120px]"
                    >
                      {linkCopied ? '✓ Copié !' : '🔗 Copier le lien'}
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-6 space-y-1">
                  <p>• Durée : <span className="font-medium">{shareDuration === 'unlimited' ? 'Illimité' : shareDuration.toUpperCase()}</span></p>
                  <p>• Type : <span className="font-medium">{shareOneTime ? 'Usage unique' : 'Multi-usages'}</span></p>
                </div>

                <button
                  onClick={resetShareModal}
                  className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium"
                >
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showImportModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !importedLesson && resetImportModal()}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            {!importedLesson ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full">
                  <Upload className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Importer via code</h2>
                <p className="text-gray-600 mb-6 text-center">
                  Entrez le code de partage à 5 caractères
                </p>

                <div className="mb-4">
                  <input
                    type="text"
                    value={importCode}
                    onChange={(e) => {
                      const value = e.target.value;

                      // Détecter si c'est une URL avec le paramètre ?share=
                      try {
                        const url = new URL(value);
                        const shareParam = url.searchParams.get('share');
                        if (shareParam) {
                          setImportCode(shareParam.toUpperCase().slice(0, 5));
                          return;
                        }
                      } catch (err) {
                        // Pas une URL valide, traiter comme un code normal
                      }

                      setImportCode(value.toUpperCase().slice(0, 5));
                    }}
                    onPaste={(e) => {
                      const pastedText = e.clipboardData.getData('text');

                      // Détecter si c'est une URL avec le paramètre ?share=
                      try {
                        const url = new URL(pastedText);
                        const shareParam = url.searchParams.get('share');
                        if (shareParam) {
                          e.preventDefault();
                          setImportCode(shareParam.toUpperCase().slice(0, 5));
                          return;
                        }
                      } catch (err) {
                        // Pas une URL valide, laisser le comportement par défaut
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && retrieveLesson()}
                    placeholder="Code"
                    className="w-full px-6 py-4 text-2xl font-bold text-center tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all uppercase"
                    autoFocus
                  />
                </div>

                {importError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                    {importError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetImportModal}
                    disabled={importLoading}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={retrieveLesson}
                    disabled={importLoading || importCode.length !== 5}
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 font-medium disabled:opacity-50"
                  >
                    {importLoading ? 'Récupération...' : 'Récupérer'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Leçon trouvée !</h2>

                <div className="p-4 rounded-lg border-2 border-indigo-600 bg-indigo-50 mb-6">
                  <h3 className="font-bold text-gray-800 mb-1">{importedLesson.name}</h3>
                  <p className="text-sm text-gray-600">{importedLesson.cards?.length || 0} cartes</p>
                </div>

                <p className="text-sm text-gray-600 mb-6 text-center">
                  Cette leçon sera ajoutée à vos leçons sans dossier
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={resetImportModal}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={addImportedLesson}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 font-medium"
                  >
                    Ajouter à mes leçons
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Quizlet Import */}
      {showQuizletModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !quizletData && resetQuizletModal()}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            {!quizletData ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
                  <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.5 3h-17A1.5 1.5 0 002 4.5v15A1.5 1.5 0 003.5 21h17a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0020.5 3zM9 17H5v-2h4v2zm0-3H5v-2h4v2zm0-3H5V9h4v2zm0-3H5V6h4v2zm10 9h-8v-2h8v2zm0-3h-8v-2h8v2zm0-3h-8V9h8v2zm0-3h-8V6h8v2z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Importer depuis Quizlet</h2>
                <p className="text-gray-600 mb-6 text-center">
                  Collez l'URL d'un set Quizlet public
                </p>

                <div className="mb-4">
                  <input
                    type="url"
                    value={quizletUrl}
                    onChange={(e) => setQuizletUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && importFromQuizlet()}
                    placeholder="https://quizlet.com/..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ Seuls les sets publics peuvent être importés
                  </p>
                </div>

                {quizletError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                    {quizletError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetQuizletModal}
                    disabled={quizletLoading}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={importFromQuizlet}
                    disabled={quizletLoading || !quizletUrl.includes('quizlet.com')}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 font-medium disabled:opacity-50"
                  >
                    {quizletLoading ? 'Import en cours...' : 'Importer'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Set Quizlet trouvé !</h2>

                <div className="p-4 rounded-lg border-2 border-blue-600 bg-blue-50 mb-6">
                  <h3 className="font-bold text-gray-800 mb-1">{quizletData.title}</h3>
                  <p className="text-sm text-gray-600">{quizletData.cardCount} cartes</p>
                </div>

                <p className="text-sm text-gray-600 mb-6 text-center">
                  Cette leçon sera ajoutée à vos leçons sans dossier
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={resetQuizletModal}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={addQuizletLesson}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 font-medium"
                  >
                    Ajouter à mes leçons
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showMySharesModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMySharesModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Mes partages</h2>

            {myShares.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Vous n'avez pas encore partagé de leçons</p>
                <p className="text-sm text-gray-500 mt-2">Vos partages apparaîtront ici</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myShares.map((share, index) => {
                  const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
                  const expiresDate = share.expiresAt ? new Date(share.expiresAt) : null;

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isExpired ? 'border-gray-300 bg-gray-50 opacity-60' : 'border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 mb-1">{share.lessonName}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <span className="font-mono font-bold text-lg text-indigo-600">{share.code}</span>
                            {share.oneTime && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                Usage unique
                              </span>
                            )}
                            {isExpired && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                Expiré
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {expiresDate ? (
                              <p>Expire le {expiresDate.toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</p>
                            ) : (
                              <p>Sans limite de temps</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!isExpired && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(share.code);
                                setToastMessage('Code copié !');
                                setToastType('success');
                                setShowToast(true);
                              }}
                              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-medium"
                            >
                              Copier
                            </button>
                          )}
                          <button
                            onClick={() => setShareToDelete(index)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium flex items-center gap-1"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Barre de progression sur toute la largeur */}
                      {expiresDate && (
                        (() => {
                          const now = new Date().getTime();
                          const created = new Date(share.createdAt).getTime();
                          const expires = new Date(share.expiresAt).getTime();
                          const totalDuration = expires - created;
                          const elapsed = now - created;
                          const percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

                          return (
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  percentage >= 90 ? 'bg-red-500' :
                                  percentage >= 70 ? 'bg-orange-500' :
                                  percentage >= 50 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowMySharesModal(false)}
              className="w-full mt-6 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {shareToDelete !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Supprimer ce partage ?</h2>
            <p className="text-gray-600 mb-6 text-center">
              Cette action est irréversible. Le code ne sera plus valide.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShareToDelete(null)}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteShare}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all transform hover:scale-105 font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <div className="mb-6">
              <img
                src="/flashmapce-logo.png"
                alt="FlashMap Logo"
                className="h-20 w-auto"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">À Propos</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Made with love by <span className="font-semibold text-indigo-600">tomyfak</span>, helped by <span className="font-semibold text-purple-600">Claude.ai</span>
            </p>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Project 100% Open Source made to simplify learning at school
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAboutModal(false);
                    setShowChangelogModal(true);
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium"
                >
                  Historique des mises à jour
                </button>
                <a
                  href="mailto:tom.fakhreddine@flashmap.app"
                  className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 font-medium text-center flex items-center justify-center"
                >
                  Contact
                </a>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105 font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangelogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-bounce-in">
            <div className="px-8 py-5 border-b border-gray-200 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-800">Historique des mises à jour</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-6">
              {/* Version 1.4.1 */}
              <div className="border-l-4 border-emerald-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.4.1</h3>
                  <span className="text-sm text-gray-500">• 02/03/2026</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span><strong>Stockage amélioré (IndexedDB) :</strong> Les leçons sont désormais stockées dans IndexedDB au lieu du localStorage, permettant de stocker beaucoup plus de contenu et d'images sans perte de données</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span><strong>Migration automatique :</strong> Les utilisateurs existants sont automatiquement migrés vers le nouveau stockage avec un écran de progression</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span><strong>Compression d'images :</strong> Les images uploadées sont automatiquement compressées pour optimiser l'espace de stockage</span>
                  </li>
                </ul>
              </div>

              {/* Version 1.4.0 */}
              <div className="border-l-4 border-orange-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.4.0</h3>
                  <span className="text-sm text-gray-500">• 24/02/2026 → 27/02/2026</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">•</span>
                    <span><strong>Modes de jeu externes :</strong> Il est maintenant possible d'installer des modes de jeu créés par la communauté depuis la boutique, ou d'en installer un via son lien. Chaque mode s'active indépendamment par leçon</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">•</span>
                    <span><strong>Boutique de modes de jeu :</strong> Nouvelle page dédiée pour découvrir et installer des modes communautaires, avec galerie de captures d'écran par mode</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">•</span>
                    <span><strong>Correction de la répétition espacée :</strong> Plusieurs bugs dans le système d'apprentissage ont été corrigés — les cartes ratées sont maintenant bien représentées dans la même session, et les intervalles de révision sont correctement calculés</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">•</span>
                    <span><strong>Aperçu Magic Lesson :</strong> Une prévisualisation des cartes générées s'affiche après la création d'une leçon par l'IA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">•</span>
                    <span><strong>Inverser une leçon :</strong> Nouveau bouton dans la page Gérer pour inverser le sens Question→Réponse de toutes les cartes d'une leçon</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">•</span>
                    <span>Corrections et petites améliorations : titre de leçon éditable depuis la page d'édition, bouton "Importer via code" dans la création de leçon, confirmation avant réinitialisation de la progression, correction d'un bug d'affichage sur mobile</span>
                  </li>
                </ul>
              </div>

              {/* Version 1.3.0 */}
              <div className="border-l-4 border-indigo-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.3.0</h3>
                  <span className="text-sm text-gray-500">• 07/02/2026 - 08/02/2026</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Faux choix personnalisés :</strong> Ajoutez jusqu'à 3 mauvaises réponses par carte pour le mode QCM</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Magic Lesson améliorée :</strong> Les faux choix sont maintenant générés automatiquement par l'IA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Import IA externe :</strong> Utilisez ChatGPT, Claude ou tout autre modèle IA pour générer vos flashcards avec un prompt dédié</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Tolérance de frappe :</strong> Le Défi de Frappe tolère les petites fautes grâce à la distance de Levenshtein</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Contrôle du rythme :</strong> En QCM et Défi de Frappe, un bouton "Suivant" remplace le passage automatique</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Inversion des cartes :</strong> Nouveau bouton pour inverser le sens Question/Réponse en mode Cartes Classiques</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Gérer les données :</strong> Export et Import déplacés dans une modal dédiée pour un menu plus épuré</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span>Améliorations d'interface et corrections diverses</span>
                  </li>
                </ul>
              </div>

              {/* Version 1.2.1 */}
              <div className="border-l-4 border-green-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.2.1</h3>
                  <span className="text-sm text-gray-500">• 15/11/2025</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>Nouvelle fonctionnalité :</strong> Instructions personnalisées pour la génération de Magic Lessons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>Bug corrigé :</strong> Les leçons importées via lien de partage s'ajoutent maintenant correctement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong>Amélioration :</strong> Feedback visuel sur les boutons de copie (code/lien)</span>
                  </li>
                </ul>
              </div>

              {/* Version 1.2.0 */}
              <div className="border-l-4 border-purple-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.2.0</h3>
                  <span className="text-sm text-gray-500">• 08/11/2025</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span><strong>Partage de leçons par code :</strong> Système de codes à 5 caractères</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span><strong>Partage par lien :</strong> Partagez vos leçons via une URL directe</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span><strong>Aperçu avant import :</strong> Visualisez les leçons partagées avant de les importer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span><strong>Menu adaptatif :</strong> Le menu s'adapte automatiquement selon l'espace disponible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span><strong>Détection automatique :</strong> Collez un lien de partage et le code est extrait automatiquement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Correction de bugs et ajouts minimes</span>
                  </li>
                </ul>
              </div>

              {/* Version 1.1.0 */}
              <div className="border-l-4 border-blue-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.1.0</h3>
                  <span className="text-sm text-gray-500">• 29/10/2025</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Support d'images :</strong> Ajout d'images sur les cartes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Organisation par dossiers :</strong> Système de tri et gestion des leçons par dossiers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Correction de bugs et ajouts minimes</span>
                  </li>
                </ul>
              </div>

              {/* Version 1.0.0 */}
              <div className="border-l-4 border-indigo-600 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">Version 1.0.0</h3>
                  <span className="text-sm text-gray-500">• 28/10/2025 - Lancement initial</span>
                </div>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Système de flashcards :</strong> Apprentissage par répétition espacée</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Modes de jeu :</strong> Flashcards, Match, QCM et Type</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Gestion de leçons :</strong> Création et édition de leçons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span><strong>Import/Export :</strong> Sauvegarde locale et export de leçons</span>
                  </li>
                </ul>
              </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-gray-200 shadow-sm">
              <button
                onClick={() => setShowChangelogModal(false)}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showDonateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full">
              <Coffee className="w-8 h-8 text-pink-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Soutenez FlashMap</h2>
            <p className="text-gray-700 mb-6 text-center text-lg">
              Achetez-moi un café et soutenez-moi
            </p>
            <a
              href="https://buymeacoffee.com/tomyfak"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 mb-4 shadow-lg"
            >
              <Coffee className="w-5 h-5" />
              Acheter un café
            </a>
            <p className="text-sm text-gray-500 mb-3 text-center">
              Les dons serviront d'abord et surtout à payer les frais d'hébergement et de nom de domaine
            </p>
            <p className="text-sm text-gray-600 mb-6 text-center font-medium">
              N'oubliez pas que FlashMap est un projet 100% Open-Source, sans pubs et gratuit pour toujours
            </p>
            <button
              onClick={() => setShowDonateModal(false)}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all transform hover:scale-105 font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showDataModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDataModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full">
              <Settings className="w-8 h-8 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Gérer les données</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => {
                  setShowDataModal(false);
                  setShowExportConfirm(true);
                }}
                className="p-5 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-2xl"
              >
                <Download className="w-10 h-10 mx-auto mb-2" />
                <h3 className="text-lg font-bold mb-1">Exporter</h3>
                <p className="text-green-100 text-sm">Télécharger une sauvegarde complète</p>
              </button>
              <button
                onClick={() => {
                  setShowDataModal(false);
                  setShowImportConfirm(true);
                }}
                className="p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-2xl"
              >
                <Upload className="w-10 h-10 mx-auto mb-2" />
                <h3 className="text-lg font-bold mb-1">Importer</h3>
                <p className="text-orange-100 text-sm">Restaurer depuis un fichier de sauvegarde</p>
              </button>
            </div>

            <button
              onClick={() => setShowDataModal(false)}
              className="w-full px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modal "Utiliser un autre modèle IA" */}
      {showAltModelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAltModelModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full animate-bounce-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-yellow-50 rounded-full">
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Utiliser un autre modèle IA</h2>
            <p className="text-sm text-gray-500 text-center mb-6">Vous pouvez utiliser n'importe quel modèle IA (ChatGPT, Claude, Mistral...) pour générer vos flashcards. Il suffit de respecter le format JSON ci-dessous.</p>

            <div
              className="overflow-hidden transition-all duration-300 ease-in-out mb-4"
              style={{ maxHeight: showJsonImport ? '0px' : '400px', opacity: showJsonImport ? 0 : 1 }}
            >
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Format JSON requis :</h3>
                <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto"><code>{`[
  {
    "question": "Votre question",
    "answer": "La réponse",
    "wrongAnswers": ["Faux 1", "Faux 2", "Faux 3"]
  }
]`}</code></pre>
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">question</span> — La question de la flashcard</p>
                  <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">answer</span> — La bonne réponse (courte, 1-10 mots)</p>
                  <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">wrongAnswers</span> — 3 faux choix pour le QCM (optionnel)</p>
                </div>
              </div>
            </div>

            {/* Zone d'import JSON rétractable */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => setShowJsonImport(!showJsonImport)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-all text-sm font-medium text-gray-700"
              >
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Importer un JSON
                </span>
                <span className={`transition-transform duration-300 ${showJsonImport ? 'rotate-180' : ''}`}>▼</span>
              </button>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: showJsonImport ? '500px' : '0px', opacity: showJsonImport ? 1 : 0 }}
              >
                <div className="px-4 pb-4 space-y-3">
                  <input
                    type="text"
                    value={jsonImportName}
                    onChange={(e) => setJsonImportName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-white"
                    placeholder="Nom de la leçon"
                  />
                  <textarea
                    value={jsonImportValue}
                    onChange={(e) => setJsonImportValue(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-mono bg-white"
                    rows="6"
                    placeholder='Collez votre JSON ici...'
                  />
                  <button
                    onClick={() => {
                      try {
                        const lessonName = jsonImportName.trim() || `Import IA ${new Date().toLocaleDateString()}`;
                        const newCards = importFlashcardsFromJson(jsonImportValue, lessonName);
                        setJsonImportValue('');
                        setJsonImportName('');
                        setShowJsonImport(false);
                        setShowAltModelModal(false);

                        setToastMessage(`Import réussi ! ${newCards.length} cartes générées.`);
                        setToastType('success');
                        setToastAction(null);
                        setShowToast(true);
                      } catch (error) {
                        setToastMessage('JSON invalide. Vérifiez le format et réessayez.');
                        setToastType('error');
                        setToastAction(null);
                        setShowToast(true);
                      }
                    }}
                    disabled={!jsonImportValue.trim()}
                    className={`w-full px-4 py-2.5 rounded-lg transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 ${jsonImportValue.trim() ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    <Download className="w-4 h-4" />
                    Importer les cartes
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowPromptExample(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 shadow-lg"
              >
                Voir un exemple de prompt
              </button>
              <button
                onClick={() => { setShowAltModelModal(false); setShowJsonImport(false); setJsonImportValue(''); setJsonImportName(''); }}
                className="w-full px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal exemple de prompt */}
      {showPromptExample && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => setShowPromptExample(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full animate-bounce-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-purple-50 rounded-full">
              <Sparkles className="w-8 h-8 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Exemple de prompt</h2>
            <p className="text-sm text-gray-500 text-center mb-6">Copiez ce prompt et collez-le dans votre modèle IA préféré avec votre document.</p>

            <div className="bg-gray-900 rounded-xl p-5 mb-4 relative">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{`Analyse ce document et génère le MAXIMUM de flashcards possible pour apprendre son contenu de manière exhaustive.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, dans ce format exact:
[
  {"question": "Question", "answer": "Réponse", "wrongAnswers": ["Faux 1", "Faux 2", "Faux 3"]}
]

Règles :
- Génère au moins 20 flashcards, jusqu'à 50 si possible
- Couvre TOUS les concepts, définitions, dates, noms importants
- Questions claires et directes
- Réponses ULTRA-COURTES : 1 à 5 mots maximum
- Pour chaque carte, génère 3 faux choix plausibles mais incorrects
- Les faux choix doivent être crédibles et du même type que la réponse
- Retourne UNIQUEMENT le JSON`}</pre>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Analyse ce document et génère le MAXIMUM de flashcards possible pour apprendre son contenu de manière exhaustive.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, dans ce format exact:
[
  {"question": "Question", "answer": "Réponse", "wrongAnswers": ["Faux 1", "Faux 2", "Faux 3"]}
]

Règles :
- Génère au moins 20 flashcards, jusqu'à 50 si possible
- Couvre TOUS les concepts, définitions, dates, noms importants
- Questions claires et directes
- Réponses ULTRA-COURTES : 1 à 5 mots maximum
- Pour chaque carte, génère 3 faux choix plausibles mais incorrects
- Les faux choix doivent être crédibles et du même type que la réponse
- Retourne UNIQUEMENT le JSON`);
                  setPromptCopied(true);
                  setTimeout(() => setPromptCopied(false), 2000);
                }}
                className={`w-full px-4 py-3 rounded-lg transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 shadow-lg ${promptCopied ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600'}`}
              >
                {promptCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copier le prompt
                  </>
                )}
              </button>
              <button
                onClick={() => setShowPromptExample(false)}
                className="w-full px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              {editingFolderId ? 'Modifier le dossier' : 'Nouveau dossier'}
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom du dossier</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Cours de maths"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Couleur</label>
              <div className="grid grid-cols-5 gap-3">
                {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6', '#F97316'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`w-12 h-12 rounded-lg transition-all transform hover:scale-110 ${
                      newFolderColor === color ? 'ring-4 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setEditingFolderId(null);
                  setNewFolderName('');
                  setNewFolderColor('#6366F1');
                }}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (editingFolderId) {
                    updateFolder();
                  } else {
                    createFolder();
                  }
                }}
                disabled={!newFolderName.trim()}
                className={`flex-1 px-6 py-3 rounded-lg transition-all transform hover:scale-105 font-medium ${
                  newFolderName.trim()
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {editingFolderId ? 'Sauvegarder' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLessonTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Créer une Leçon Classique</h2>
            <input
              type="text"
              value={newLessonName}
              onChange={(e) => setNewLessonName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createNewLesson()}
              placeholder="Nom de la leçon..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={createNewLesson}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105 font-medium"
              >
                Créer
              </button>
              <button
                onClick={() => {
                  setShowLessonTypeModal(false);
                  setNewLessonName('');
                }}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={importData}
        style={{ display: 'none' }}
      />

      <input
        ref={magicFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={handleMagicFileSelect}
        style={{ display: 'none' }}
      />

      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          opacity: 0;
          animation: slideIn 0.3s ease-out forwards;
        }
        .flip-card {
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }
        .flip-card.flipped {
          transform: rotateY(180deg);
        }
        .flip-card-content {
          backface-visibility: hidden;
        }
        .flip-card-back {
          transform: rotateY(180deg);
        }
        @keyframes bounce-in {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          opacity: 0;
          animation: bounce-in 0.4s ease-out forwards;
        }
        @keyframes gradient-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-rotate {
          animation: gradient-rotate 6s ease infinite;
        }
      `}</style>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex items-center justify-between gap-4 mb-8 animate-slide-in">
          <div className="flex items-center gap-3">
            {mode !== 'menu' && (
              <button
                onClick={() => { if (mode === 'store') { setSelectedRegistryMode(null); setMode('manage'); } else { setMode('menu'); } }}
                className="px-3 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-all transform hover:scale-105 font-medium shadow flex items-center gap-2"
              >
                <span>←</span>
                <span className="hidden sm:inline">{mode === 'store' ? 'Édition' : 'Menu'}</span>
              </button>
            )}
            <img
              src="/flashmap-logo.png"
              alt="Logo"
              className="h-12 sm:h-16 w-auto"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowAboutModal(true)}
              className="hidden sm:block px-3 sm:px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-all transform hover:scale-105 font-medium shadow text-sm sm:text-base"
            >
              À Propos
            </button>
            <button
              onClick={() => setShowDonateModal(true)}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all transform hover:scale-105 font-medium shadow text-sm sm:text-base"
            >
              Donate
            </button>
          </div>
        </div>

        {mode === 'menu' && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 animate-slide-in">
              <div className="flex flex-row items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">Vos Leçons</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowLessonModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 whitespace-nowrap text-sm sm:text-base"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nouvelle Leçon</span>
                  </button>

                  {currentFolderId === null && (
                    <button
                      onClick={() => setShowFolderModal(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 whitespace-nowrap text-sm sm:text-base"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Nouveau Dossier</span>
                    </button>
                  )}

                  {/* Menu avec trois points */}
                  <div className="relative" style={{ zIndex: 9999 }}>
                    <button
                      ref={menuButtonRef}
                      onClick={(e) => {
                        const willOpen = !showMobileMenu;

                        if (willOpen && menuButtonRef.current && gameModesRef.current) {
                          // Calculer l'espace entre le bouton et la section "modes de jeu"
                          const buttonRect = menuButtonRef.current.getBoundingClientRect();
                          const gameModesRect = gameModesRef.current.getBoundingClientRect();
                          const spaceBetween = gameModesRect.top - buttonRect.bottom;

                          // Si moins de 270px disponibles, utiliser 2 colonnes (compact), sinon 1 colonne
                          setMenuColumns(spaceBetween < 270 ? 2 : 1);
                        }

                        setShowMobileMenu(willOpen);
                      }}
                      className="px-3 py-[0.625rem] text-gray-700 rounded-lg hover:bg-gray-100 transition-all transform hover:scale-105 flex items-center justify-center"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {showMobileMenu && (
                      <>
                        <div
                          className="fixed inset-0"
                          style={{ zIndex: 9998 }}
                          onClick={() => setShowMobileMenu(false)}
                        ></div>
                        <div
                          className={`absolute right-0 top-full mt-2 ${menuColumns === 1 ? 'w-56' : 'w-[26rem]'} bg-white rounded-lg shadow-xl border border-gray-200 grid ${menuColumns === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-0`}
                          style={{ zIndex: 9999 }}
                        >
                          <button
                            onClick={() => {
                              setShowShareModal(true);
                              setShowMobileMenu(false);
                            }}
                            className={`px-4 py-3 text-left hover:bg-gray-100 transition-all flex items-center gap-3 text-gray-700 border-b ${menuColumns === 2 ? 'border-r' : ''} border-gray-100`}
                          >
                            <Share2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                            <span className="font-medium text-base">Partager</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowImportModal(true);
                              setShowMobileMenu(false);
                            }}
                            className="px-4 py-3 text-left hover:bg-gray-100 transition-all flex items-center gap-3 text-gray-700 border-b border-gray-100"
                          >
                            <Upload className="w-5 h-5 text-orange-600 flex-shrink-0" />
                            <span className="font-medium text-base">Importer via code</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowMySharesModal(true);
                              setShowMobileMenu(false);
                            }}
                            className={`px-4 py-3 text-left hover:bg-gray-100 transition-all flex items-center gap-3 text-gray-700 border-b ${menuColumns === 2 ? 'border-r' : ''} border-gray-100`}
                          >
                            <BookOpen className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                            <span className="font-medium text-base">Mes partages</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowDataModal(true);
                              setShowMobileMenu(false);
                            }}
                            className="px-4 py-3 text-left hover:bg-gray-100 transition-all flex items-center gap-3 text-gray-700 border-t border-gray-100"
                          >
                            <Settings className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            <span className="font-medium text-base">Gérer les données</span>
                          </button>
                          {/* Bouton "Importer depuis Quizlet" masqué — fonctionnalité désactivée temporairement, à réintroduire plus tard */}
                          {/* <button
                            onClick={() => {
                              setShowQuizletModal(true);
                              setShowMobileMenu(false);
                            }}
                            className="px-4 py-3 text-left hover:bg-gray-100 transition-all flex items-center gap-3 text-gray-700"
                          >
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.5 3h-17A1.5 1.5 0 002 4.5v15A1.5 1.5 0 003.5 21h17a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0020.5 3zM9 17H5v-2h4v2zm0-3H5v-2h4v2zm0-3H5V9h4v2zm0-3H5V6h4v2zm10 9h-8v-2h8v2zm0-3h-8v-2h8v2zm0-3h-8V9h8v2zm0-3h-8V6h8v2z"/>
                            </svg>
                            <span className="font-medium text-base">Importer depuis Quizlet</span>
                          </button> */}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Bouton retour si on est dans un dossier */}
              {currentFolderId && folders[currentFolderId] && (
                <div className="mb-4 flex items-center gap-3">
                  <button
                    data-back-button="true"
                    data-folder-id="uncategorized"
                    onClick={() => setCurrentFolderId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = '#D1D5DB';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.transform = '';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.transform = '';
                      if (draggedLesson) {
                        moveLessonToFolder(draggedLesson, 'uncategorized');
                        setDraggedLesson(null);
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all flex items-center gap-2"
                    style={touchHoverFolderId === 'uncategorized' ? {
                      transform: 'scale(0.95)',
                      backgroundColor: '#A5B4FC',
                    } : {}}
                  >
                    ← Retour aux dossiers
                  </button>
                  <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5" style={{ color: folders[currentFolderId].color }} />
                    <span className="font-bold text-gray-800">{folders[currentFolderId].name}</span>
                  </div>
                </div>
              )}

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {currentFolderId === null ? (
                  // Vue principale : afficher les dossiers ET les leçons sans dossier
                  <>
                    {/* Afficher tous les dossiers */}
                    {Object.entries(folders)
                      .filter(([folderId]) => folderId !== 'uncategorized')
                      .map(([folderId, folder]) => (
                        <div
                          key={folderId}
                          data-folder-id={folderId}
                          onClick={() => setCurrentFolderId(folderId)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.transform = '';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.transform = '';
                            if (draggedLesson) {
                              moveLessonToFolder(draggedLesson, folderId);
                              setDraggedLesson(null);
                            }
                          }}
                          className="p-4 rounded-lg border-2 border-gray-200 transition-all cursor-pointer group"
                          style={touchHoverFolderId === folderId ? {
                            transform: 'scale(0.95)',
                            borderColor: folder.color,
                            backgroundColor: `${folder.color}30`,
                          } : {}}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = folder.color;
                            e.currentTarget.style.backgroundColor = `${folder.color}10`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                            e.currentTarget.style.backgroundColor = '';
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 flex-1">
                              <Folder className="w-full h-full flex-shrink-0 text-gray-600" style={{ color: folder.color, maxWidth: '2.5rem' }} />
                              <div>
                                <h3 className="font-bold text-gray-800 mb-1">{folder.name}</h3>
                                <p className="text-sm text-gray-600">{folder.lessonIds.length} leçon{folder.lessonIds.length > 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFolderId(folderId);
                                  setNewFolderName(folder.name);
                                  setNewFolderColor(folder.color);
                                  setShowFolderModal(true);
                                }}
                                className="p-1 text-gray-600 hover:bg-gray-200 rounded transition-all opacity-0 group-hover:opacity-100"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete({ id: folderId, name: folder.name, lessonCount: folder.lessonIds.length });
                                  setShowDeleteFolderConfirm(true);
                                }}
                                className="p-1 text-red-500 hover:bg-red-100 rounded transition-all opacity-0 group-hover:opacity-100"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Afficher les leçons sans dossier */}
                    {folders.uncategorized && folders.uncategorized.lessonIds.map((lessonId) => {
                      const lesson = lessons[lessonId];
                      if (!lesson) return null;

                      return (
                        <div
                          key={lessonId}
                          draggable
                          onDragStart={() => setDraggedLesson(lessonId)}
                          onDragEnd={() => setDraggedLesson(null)}
                          onTouchStart={(e) => handleTouchStart(e, lessonId)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchCancel}
                          className={`p-4 rounded-lg border-2 transition-all cursor-move ${
                            currentLessonId === lessonId
                              ? 'border-indigo-600 bg-indigo-50'
                              : 'border-gray-200'
                          }`}
                          style={{
                            opacity: isDraggingTouch && draggedLesson === lessonId ? 0.2 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (currentLessonId !== lessonId) {
                              e.currentTarget.style.borderColor = '#818CF8';
                              e.currentTarget.style.backgroundColor = '#F9FAFB';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentLessonId !== lessonId) {
                              e.currentTarget.style.borderColor = '';
                              e.currentTarget.style.backgroundColor = '';
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={(e) => {
                                switchLesson(lessonId);
                              }}
                              onDoubleClick={() => startEditingLesson(lessonId, lesson.name)}
                            >
                              {editingLessonId === lessonId ? (
                                <input
                                  type="text"
                                  value={editingLessonName}
                                  onChange={(e) => setEditingLessonName(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') saveEditingLesson();
                                    if (e.key === 'Escape') cancelEditingLesson();
                                  }}
                                  onBlur={saveEditingLesson}
                                  className="w-full px-2 py-1 border border-indigo-500 rounded font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <h3 className="font-bold text-gray-800 mb-1">{lesson.name}</h3>
                              )}
                              <p className="text-sm text-gray-600">{lesson.cards.length} cartes</p>
                            </div>
                            <div className="flex gap-1">
                              {currentLessonId === lessonId && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMode('manage');
                                    }}
                                    className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                                    title="Gérer les Cartes"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowShareModal(true);
                                    }}
                                    className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-all"
                                    title="Partager la Leçon"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                  {Object.keys(lessons).length > 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLessonToDelete({ id: lessonId, name: lesson.name });
                                        setShowDeleteConfirm(true);
                                      }}
                                      className="p-1 text-red-500 hover:bg-red-100 rounded transition-all"
                                      title="Supprimer la Leçon"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  // Vue d'un dossier : afficher seulement les leçons de ce dossier
                  folders[currentFolderId] && folders[currentFolderId].lessonIds.map((lessonId) => {
                    const lesson = lessons[lessonId];
                    if (!lesson) return null;
                    const folderColor = folders[currentFolderId].color;

                    return (
                      <div
                        key={lessonId}
                        draggable
                        onDragStart={() => setDraggedLesson(lessonId)}
                        onDragEnd={() => setDraggedLesson(null)}
                        onTouchStart={(e) => handleTouchStart(e, lessonId)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchCancel}
                        className={`p-4 rounded-lg border-2 transition-all cursor-move ${
                          currentLessonId === lessonId
                            ? ''
                            : 'border-gray-200'
                        }`}
                        style={currentLessonId === lessonId ? {
                          borderColor: folderColor,
                          backgroundColor: `${folderColor}15`,
                          opacity: isDraggingTouch && draggedLesson === lessonId ? 0.2 : 1
                        } : {
                          opacity: isDraggingTouch && draggedLesson === lessonId ? 0.2 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (currentLessonId !== lessonId) {
                            e.currentTarget.style.borderColor = folderColor;
                            e.currentTarget.style.backgroundColor = '#F9FAFB';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentLessonId !== lessonId) {
                            e.currentTarget.style.borderColor = '';
                            e.currentTarget.style.backgroundColor = '';
                          } else {
                            e.currentTarget.style.borderColor = folderColor;
                            e.currentTarget.style.backgroundColor = `${folderColor}15`;
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={(e) => {
                              const parent = e.currentTarget.closest('.cursor-move');
                              switchLesson(lessonId);
                              // Réappliquer immédiatement les styles de sélection
                              if (parent) {
                                parent.style.borderColor = folderColor;
                                parent.style.backgroundColor = `${folderColor}15`;
                              }
                            }}
                            onDoubleClick={() => startEditingLesson(lessonId, lesson.name)}
                          >
                            {editingLessonId === lessonId ? (
                              <input
                                type="text"
                                value={editingLessonName}
                                onChange={(e) => setEditingLessonName(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') saveEditingLesson();
                                  if (e.key === 'Escape') cancelEditingLesson();
                                }}
                                onBlur={saveEditingLesson}
                                className="w-full px-2 py-1 border border-indigo-500 rounded font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <h3 className="font-bold text-gray-800 mb-1">{lesson.name}</h3>
                            )}
                            <p className="text-sm text-gray-600">{lesson.cards.length} cartes</p>
                          </div>
                          <div className="flex gap-1">
                            {currentLessonId === lessonId && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMode('manage');
                                  }}
                                  className="p-1 rounded transition-all"
                                  style={{ color: folderColor }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${folderColor}20`}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                  title="Gérer les Cartes"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowShareModal(true);
                                  }}
                                  className="p-1 rounded transition-all"
                                  style={{ color: folderColor }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${folderColor}20`}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                  title="Partager la Leçon"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                                {Object.keys(lessons).length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLessonToDelete({ id: lessonId, name: lesson.name });
                                      setShowDeleteConfirm(true);
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-100 rounded transition-all"
                                    title="Supprimer la Leçon"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div ref={gameModesRef} className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 animate-slide-in">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Choisissez Votre Mode de Jeu</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(() => {
                    const activeModes = getActiveGameModes();
                    const builtinStyles = {
                      flashcards: 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
                      match: 'bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
                      mcq: 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
                      type: 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
                    };
                    const builtinIcons = { flashcards: Zap, match: Target, mcq: CheckCircle, type: Gamepad2 };
                    const builtinHandlers = {
                      flashcards: () => {
                        setSessionQueue(cards.filter(c => (c.nextReview ?? 0) <= Date.now()).map(c => c.id));
                        setMode('flashcards');
                      },
                      match: startMatchGame,
                      mcq: startMcqGame,
                      type: startTypeGame,
                    };

                    return activeModes.map(gm => {
                      if (!gm.isExternal) {
                        const Icon = builtinIcons[gm.id] || Zap;
                        return (
                          <button
                            key={gm.id}
                            onClick={builtinHandlers[gm.id]}
                            className={`p-6 ${builtinStyles[gm.id]} text-white rounded-xl hover:shadow-2xl transition-all transform hover:scale-105 shadow-lg`}
                          >
                            <Icon className="w-12 h-12 mb-3 mx-auto" />
                            <h3 className="text-xl font-bold mb-2">{gm.name}</h3>
                            <p className="text-white/70 text-sm">{gm.description}</p>
                          </button>
                        );
                      }
                      const isLoadingThis = externalModeLoadingId === gm.id;
                      return (
                        <button
                          key={gm.id}
                          onClick={() => startExternalMode(gm.id)}
                          disabled={!!externalModeLoadingId}
                          className="p-6 text-white rounded-xl hover:shadow-2xl transition-all transform hover:scale-105 shadow-lg disabled:opacity-75 disabled:cursor-wait relative overflow-hidden group"
                          style={{ background: `linear-gradient(to bottom right, ${adjustColor(gm.color, 1.1)}, ${adjustColor(gm.color, 0.9)})` }}
                        >
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 rounded-xl" style={{ zIndex: 0 }} />
                          <div className="relative" style={{ zIndex: 1 }}>
                            {isLoadingThis
                              ? <Loader className="w-12 h-12 mb-3 mx-auto animate-spin" />
                              : <ModeIcon icon={gm.icon} size="xl" className="block mb-3 mx-auto text-center" />
                            }
                            <h3 className="text-xl font-bold mb-2">{gm.name}</h3>
                            <p className="text-white/70 text-sm">
                              {isLoadingThis ? 'Chargement...' : gm.description}
                            </p>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setMode('manage')}
                  className="p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 animate-slide-in"
                >
                  <Edit className="w-10 h-10 text-indigo-600 mb-2 mx-auto" />
                  <h3 className="text-lg font-bold text-gray-800">Gérer les Cartes</h3>
                </button>

                <button
                  onClick={() => setMode('stats')}
                  className="p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 animate-slide-in"
                >
                  <Trophy className="w-10 h-10 text-yellow-500 mb-2 mx-auto" />
                  <h3 className="text-lg font-bold text-gray-800">Statistiques Détaillées</h3>
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 animate-slide-in">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <h3 className="font-bold text-gray-800">Vos Statistiques</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="transform hover:scale-110 transition-transform">
                    <div className="text-3xl font-bold text-indigo-600">{stats.studied}</div>
                    <div className="text-sm text-gray-600">Étudiées</div>
                  </div>
                  <div className="transform hover:scale-110 transition-transform">
                    <div className="text-3xl font-bold text-green-600">{stats.correct}</div>
                    <div className="text-sm text-gray-600">Correctes</div>
                  </div>
                  <div className="transform hover:scale-110 transition-transform">
                    <div className="text-3xl font-bold text-red-600">{stats.incorrect}</div>
                    <div className="text-sm text-gray-600">Incorrectes</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {mode === 'flashcards' && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in" key={`flashcards-${animationKey}`}>
            <div className="flex justify-between items-center gap-2 mb-4">
              <div className="text-sm text-gray-600">
                Cartes à réviser : <span className="font-bold text-indigo-600">{dueCards.length}</span>
              </div>
              <button
                onClick={() => {
                  const newValue = !reversedCards;
                  setReversedCards(newValue);
                  setShowReversedLabel(true);
                  setTimeout(() => setShowReversedLabel(false), 3000);
                }}
                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all transform hover:scale-105 font-medium flex items-center gap-2 text-sm overflow-hidden"
                title="Inverser le sens des cartes"
              >
                <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
                <span
                  className="whitespace-nowrap transition-all duration-500 ease-in-out"
                  style={{
                    maxWidth: showReversedLabel ? '200px' : '0px',
                    opacity: showReversedLabel ? 1 : 0,
                    marginLeft: showReversedLabel ? '0px' : '-8px',
                  }}
                >
                  {reversedCards ? 'Réponse → Question' : 'Question → Réponse'}
                </span>
              </button>
            </div>

            {sessionQueue.length === 0 ? (
              <div className="text-center py-16 animate-bounce-in">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Session terminée !</h2>
                <button
                  onClick={resetProgress}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105"
                >
                  Réviser Toutes les Cartes à Nouveau
                </button>
              </div>
            ) : currentCard ? (
              <>
                <div className="perspective-1000">
                  <div
                    onClick={flipCard}
                    className={`flip-card bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-12 min-h-64 flex items-center justify-center cursor-pointer transform hover:scale-105 active:scale-95 shadow-xl relative ${isFlipped ? 'flipped' : ''}`}
                  >
                    <div className="flip-card-content absolute inset-0 flex flex-col items-center justify-center p-12">
                      <div className={`${isFlipped ? 'invisible' : ''} flex flex-col items-center gap-4`}>
                        <p className="text-white text-2xl text-center font-medium">
                          {reversedCards ? currentCard.back : currentCard.front}
                        </p>
                        {(reversedCards ? currentCard.backImage : currentCard.frontImage) && (
                          <img
                            src={reversedCards ? currentCard.backImage : currentCard.frontImage}
                            alt="Image question"
                            className="max-w-full max-h-48 object-contain rounded-lg shadow-lg"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flip-card-content flip-card-back absolute inset-0 flex flex-col items-center justify-center p-12">
                      <div className={`${!isFlipped ? 'invisible' : ''} flex flex-col items-center gap-4`}>
                        <p className="text-white text-2xl text-center font-medium">
                          {reversedCards ? currentCard.front : currentCard.back}
                        </p>
                        {(reversedCards ? currentCard.frontImage : currentCard.backImage) && (
                          <img
                            src={reversedCards ? currentCard.frontImage : currentCard.backImage}
                            alt="Image réponse"
                            className="max-w-full max-h-48 object-contain rounded-lg shadow-lg"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-4 mb-6 text-sm text-gray-600">
                  Cliquez sur la carte pour la retourner
                </div>

                {isFlipped && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 animate-slide-in">
                    <button onClick={() => rateCard(1)} className="px-2 sm:px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all transform hover:scale-110 font-medium text-sm sm:text-base">Encore</button>
                    <button onClick={() => rateCard(2)} className="px-2 sm:px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all transform hover:scale-110 font-medium text-sm sm:text-base">Difficile</button>
                    <button onClick={() => rateCard(3)} className="px-2 sm:px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all transform hover:scale-110 font-medium text-sm sm:text-base">Bien</button>
                    <button onClick={() => rateCard(4)} className="px-2 sm:px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all transform hover:scale-110 font-medium text-sm sm:text-base">Facile</button>
                    <button onClick={() => rateCard(5)} className="px-2 sm:px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all transform hover:scale-110 font-medium text-sm sm:text-base col-span-2 sm:col-span-1">Parfait</button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {mode === 'external-play' && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{activeExternalModeName}</h2>
              <button
                onClick={exitExternalMode}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
              >
                Quitter
              </button>
            </div>
            <div ref={externalModeContainerRef} className="min-h-[400px]" />
          </div>
        )}

        {mode === 'match' && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in" key={`match-${animationKey}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Associez les Paires !</h2>
              <div className="text-base sm:text-lg font-bold text-indigo-600">
                {matchedPairs.length} / {matchCards.length / 2} associées
              </div>
            </div>

            {matchedPairs.length === matchCards.length / 2 ? (
              <div className="text-center py-16 animate-bounce-in">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Association Parfaite !</h2>
                <button
                  onClick={startMatchGame}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105"
                >
                  Rejouer
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {matchCards.map((card, idx) => {
                  const isMatched = matchedPairs.includes(card.pairId);
                  const isSelected = selectedMatch.find(s => s.id === card.id);
                  
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleMatchClick(card)}
                      disabled={isMatched}
                      className={`p-4 rounded-lg font-medium transition-all transform hover:scale-105 animate-bounce-in flex flex-col items-center justify-center gap-2 min-h-[100px] ${
                        isMatched
                          ? 'bg-green-100 text-green-800 opacity-50'
                          : isSelected
                          ? 'bg-purple-500 text-white scale-105 shadow-lg'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:shadow-md'
                      }`}
                      style={{animationDelay: `${idx * 0.05}s`}}
                    >
                      <span className="text-center">{card.text}</span>
                      {card.image && (
                        <img
                          src={card.image}
                          alt="Carte"
                          className="max-w-full h-16 object-contain rounded"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'mcq' && mcqQuestion && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in" key={`mcq-${animationKey}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Choix Multiple</h2>
              <div className="text-base sm:text-lg font-bold text-green-600">
                Score: {mcqScore} / {mcqTotal}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 sm:p-8 mb-6 animate-bounce-in shadow-xl">
              <p className="text-white text-lg sm:text-xl text-center font-medium mb-4">
                {mcqQuestion.front}
              </p>
              {mcqQuestion.frontImage && (
                <div className="flex justify-center mt-4">
                  <img
                    src={mcqQuestion.frontImage}
                    alt="Question"
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mcqOptions.map((option, idx) => {
                const isCorrect = option.isCorrect;
                const isSelected = mcqAnswer?.id === option.id;

                return (
                  <button
                    key={idx}
                    onClick={() => handleMcqAnswer(option)}
                    disabled={mcqAnswer !== null}
                    className={`p-6 rounded-lg font-medium transition-all transform hover:scale-105 animate-slide-in flex flex-col items-center justify-center gap-3 min-h-[120px] ${
                      mcqAnswer === null
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:shadow-lg'
                        : isSelected && isCorrect
                        ? 'bg-green-500 text-white scale-105 shadow-xl'
                        : isSelected && !isCorrect
                        ? 'bg-red-500 text-white scale-95'
                        : isCorrect
                        ? 'bg-green-300 text-green-900'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                    style={{animationDelay: `${idx * 0.1}s`}}
                  >
                    <span className="text-center">{option.text}</span>
                    {option.image && (
                      <img
                        src={option.image}
                        alt="Option"
                        className="max-w-full max-h-24 object-contain rounded"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {mcqAnswer !== null && (
              <div className={`mt-4 p-4 rounded-lg animate-bounce-in ${mcqAnswer.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    {mcqAnswer.isCorrect ? '✓ Correct !' : '✗ Incorrect'}
                  </p>
                  <button
                    onClick={() => { setMcqAnswer(null); nextMcqQuestion(); }}
                    className={`ml-4 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 flex-shrink-0 opacity-80 hover:opacity-100 ${mcqAnswer.isCorrect ? 'bg-green-700/15 hover:bg-green-700/25' : 'bg-red-700/15 hover:bg-red-700/25'}`}
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'type' && typeQuestion && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in" key={`type-${animationKey}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Défi de Frappe</h2>
              <div className="text-base sm:text-lg font-bold text-orange-600">
                Score: {typeScore} / {typeTotal}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 sm:p-8 mb-6 animate-bounce-in shadow-xl">
              <p className="text-white text-lg sm:text-xl text-center font-medium mb-4">
                {typeQuestion.front}
              </p>
              {typeQuestion.frontImage && (
                <div className="flex justify-center mt-4">
                  <img
                    src={typeQuestion.frontImage}
                    alt="Question"
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <input
                ref={typeInputRef}
                type="text"
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && typeResult === null && handleTypeSubmit()}
                disabled={typeResult !== null}
                placeholder="Tapez votre réponse..."
                className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />

              {typeResult !== null && (
                <div className={`p-4 rounded-lg animate-bounce-in ${typeResult === 'correct' ? 'bg-green-100 text-green-800' : typeResult === 'almost' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                  <div className={`flex gap-2 ${typeResult === 'correct' ? 'flex-row items-center justify-between' : 'flex-col sm:flex-row sm:items-center sm:justify-between'}`}>
                    <div>
                      <p className="font-bold">
                        {typeResult === 'correct' ? '✓ Correct !' : typeResult === 'almost' ? '≈ Presque ! Attention à l\'orthographe' : '✗ Incorrect'}
                      </p>
                      {typeResult !== 'correct' && typeQuestion.back && <p className="text-sm mt-0.5">La bonne réponse était : <strong>{typeQuestion.back}</strong></p>}
                    </div>
                    <button
                      onClick={nextTypeQuestion}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 opacity-80 hover:opacity-100 flex-shrink-0 ${typeResult === 'correct' ? '' : 'self-start sm:self-auto'} ${typeResult === 'correct' ? 'bg-green-700/15 hover:bg-green-700/25' : typeResult === 'almost' ? 'bg-orange-700/15 hover:bg-orange-700/25' : 'bg-red-700/15 hover:bg-red-700/25'}`}
                    >
                      Suivant →
                    </button>
                  </div>
                  {typeResult !== 'correct' && !typeQuestion.back && typeQuestion.backImage && (
                    <div className="flex justify-center mt-2">
                      <img
                        src={typeQuestion.backImage}
                        alt="Réponse correcte"
                        className="max-w-full max-h-32 object-contain rounded"
                      />
                    </div>
                  )}
                </div>
              )}

              {typeResult === null && (
                <button
                  onClick={handleTypeSubmit}
                  className="w-full px-6 py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 font-medium text-lg shadow-lg"
                >
                  Soumettre la Réponse
                </button>
              )}

              {typeOptions.length > 0 && (
                <div className="pt-4 border-t-2 border-gray-200">
                  <p className="text-sm text-gray-600 mb-3 text-center">Ou choisissez parmi les images :</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {typeOptions.map((option, idx) => {
                      const isCorrect = option.isCorrect;
                      const isSelected = typeSelectedOption?.id === option.id;

                      return (
                        <button
                          key={idx}
                          onClick={() => typeResult === null && handleTypeImageAnswer(option)}
                          disabled={typeResult !== null}
                          className={`p-3 rounded-lg font-medium transition-all transform hover:scale-105 animate-slide-in flex flex-col items-center justify-center gap-2 min-h-[100px] ${
                            typeResult === null
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:shadow-lg'
                              : isSelected && isCorrect
                              ? 'bg-green-500 text-white scale-105 shadow-xl'
                              : isSelected && !isCorrect
                              ? 'bg-red-500 text-white scale-95'
                              : isCorrect
                              ? 'bg-green-300 text-green-900'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                          style={{animationDelay: `${idx * 0.05}s`}}
                        >
                          {option.image && (
                            <img
                              src={option.image}
                              alt="Option"
                              className="max-w-full max-h-20 object-contain rounded"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'magic-lesson' && (
          <div className="space-y-6" key={`magic-${animationKey}`}>
            <div className="relative bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 rounded-xl shadow-lg p-6 sm:p-8 animate-slide-in overflow-hidden">
              <div className="absolute inset-0 rounded-xl animate-gradient-rotate" style={{
                background: 'linear-gradient(45deg, #8b5cf6, #ec4899, #8b5cf6, #ec4899)',
                backgroundSize: '400% 400%',
                padding: '2px',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor'
              }}></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Créer une Magic Lesson</h2>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowMagicMenu(!showMagicMenu)}
                      className="px-3 py-[0.625rem] text-gray-700 rounded-lg hover:bg-gray-500/10 transition-all transform hover:scale-105 flex items-center justify-center"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {showMagicMenu && (
                      <>
                        <div
                          className="fixed inset-0"
                          style={{ zIndex: 9998 }}
                          onClick={() => setShowMagicMenu(false)}
                        ></div>
                        <div
                          className="absolute right-0 top-full mt-2 w-max bg-white rounded-lg shadow-xl border border-gray-200"
                          style={{ zIndex: 9999 }}
                        >
                          <button
                            onClick={() => {
                              setShowMagicMenu(false);
                              setShowAltModelModal(true);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-all flex items-center gap-3 text-gray-700 rounded-lg whitespace-nowrap"
                          >
                            <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                            <span className="font-medium text-base">Utiliser un autre modèle IA</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la leçon</label>
                  <input
                    type="text"
                    value={magicLessonName}
                    onChange={(e) => setMagicLessonName(e.target.value)}
                    placeholder="Ex: Cours de biologie chapitre 3"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="bg-white rounded-xl p-6 mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-4">Uploader votre document</label>
                  
                  {!uploadedFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => magicFileInputRef.current?.click()}
                      className={`border-3 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-700 mb-2">
                        Glissez votre fichier ici ou cliquez pour parcourir
                      </p>
                      <p className="text-sm text-gray-500">
                        Formats acceptés : PNG, JPG, PDF (max 10MB)
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-green-300 bg-green-50 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                            {uploadedFile.type.includes('pdf') ? (
                              <BookOpen className="w-6 h-6 text-white" />
                            ) : (
                              <CheckCircle className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{uploadedFile.name}</p>
                            <p className="text-sm text-gray-600">
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={removeUploadedFile}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl p-6 mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instructions personnalisées (optionnel)</label>
                  <input
                    type="text"
                    value={magicInstructions}
                    onChange={(e) => setMagicInstructions(e.target.value)}
                    placeholder="Ex: Concentre-toi sur les dates importantes, génère des questions plus difficiles..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="mt-6 flex gap-4">
                  <button
                    onClick={() => {
                      setMode('menu');
                      setMagicLessonName('');
                      setMagicInstructions('');
                      setUploadedFile(null);
                    }}
                    className="flex-1 px-6 py-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={generateMagicLesson}
                    disabled={!magicLessonName.trim() || !uploadedFile || isGenerating}
                    className={`flex-1 px-6 py-4 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2 ${
                      magicLessonName.trim() && uploadedFile && !isGenerating
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Générer les Cartes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 animate-slide-in" style={{animationDelay: '0.1s'}}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Comment ça marche ?</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Donnez un nom à votre leçon</p>
                    <p className="text-sm text-gray-600">Choisissez un nom descriptif pour retrouver facilement votre leçon</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Uploadez votre document</p>
                    <p className="text-sm text-gray-600">Photo de vos notes, slides de cours ou PDF de votre manuel</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">La magie opère</p>
                    <p className="text-sm text-gray-600">L'IA analyse votre document et génère automatiquement des flashcards pertinentes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'stats' && (
          <div className="space-y-6" key={`stats-${animationKey}`}>
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 animate-slide-in">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                  <span className="hidden sm:inline">Statistiques Détaillées - {lessons[currentLessonId].name}</span>
                  <span className="sm:hidden">Statistiques Détaillées</span>
                </h2>
                <p className="text-base text-gray-600 mt-1 ml-10 sm:hidden">{lessons[currentLessonId].name}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                  <div className="text-blue-600 text-sm font-medium mb-2">Total Cartes</div>
                  <div className="text-4xl font-bold text-blue-700">{cards.length}</div>
                </div>
                
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border-2 border-indigo-200">
                  <div className="text-indigo-600 text-sm font-medium mb-2">Cartes Étudiées</div>
                  <div className="text-4xl font-bold text-indigo-700">{stats.studied}</div>
                  <div className="text-sm text-indigo-600 mt-1">
                    {cards.length > 0 ? Math.round((stats.studied / cards.length) * 100) : 0}% du total
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
                  <div className="text-purple-600 text-sm font-medium mb-2">Cartes à Réviser</div>
                  <div className="text-4xl font-bold text-purple-700">{dueCards.length}</div>
                  <div className="text-sm text-purple-600 mt-1">
                    {cards.length > 0 ? Math.round((dueCards.length / cards.length) * 100) : 0}% du total
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Performance Globale</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-green-600">Réponses Correctes</span>
                        <span className="text-sm font-bold text-green-700">{stats.correct}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{width: `${stats.correct + stats.incorrect > 0 ? (stats.correct / (stats.correct + stats.incorrect)) * 100 : 0}%`}}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-red-600">Réponses Incorrectes</span>
                        <span className="text-sm font-bold text-red-700">{stats.incorrect}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-red-500 h-3 rounded-full transition-all duration-500"
                          style={{width: `${stats.correct + stats.incorrect > 0 ? (stats.incorrect / (stats.correct + stats.incorrect)) * 100 : 0}%`}}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-800">Taux de Réussite</span>
                        <span className="text-3xl font-bold text-indigo-600">
                          {stats.correct + stats.incorrect > 0 
                            ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Répartition des Cartes</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Cartes Maîtrisées</span>
                      <span className="text-lg font-bold text-green-600">
                        {cards.filter(c => c.interval >= 7).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">En Apprentissage</span>
                      <span className="text-lg font-bold text-yellow-600">
                        {cards.filter(c => c.interval >= 1 && c.interval < 7).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Nouvelles</span>
                      <span className="text-lg font-bold text-red-600">
                        {cards.filter(c => c.interval < 1).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Facteur de Facilité Moyen</h3>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <div className="text-4xl font-bold text-indigo-600">
                      {cards.length > 0
                        ? (cards.reduce((acc, c) => acc + c.easeFactor, 0) / cards.length).toFixed(2)
                        : '2.50'}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Plus le facteur est élevé, plus les cartes sont faciles à retenir
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-sm text-gray-600">Intervalle Moyen</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {cards.length > 0
                        ? Math.round(cards.reduce((acc, c) => acc + c.interval, 0) / cards.length)
                        : 0} jours
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMagicPreviewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col animate-bounce-in" style={{ maxHeight: '85vh' }}>

              <div className="p-6 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-purple-500 flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{lessons[currentLessonId]?.name}</h2>
                    <p className="text-sm text-gray-500">{cards.length} cartes générées par l'IA</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cards.map((card, index) => (
                  <div key={card.id} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex gap-3">
                      <span className="text-xs text-gray-400 font-mono pt-1 flex-shrink-0 w-6">#{index + 1}</span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Question</p>
                          <p className="text-gray-800 font-medium">{card.front}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Réponse</p>
                          <p className="text-indigo-600 font-medium">{card.back}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-100 flex-shrink-0 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setShowMagicPreviewModal(false); setMode('manage'); }}
                  className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Modifier la leçon
                </button>
                <button
                  onClick={() => {
                    setShowMagicPreviewModal(false);
                    setTimeout(() => {
                      if (gameModesRef.current) {
                        gameModesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                  className="flex-[2] px-6 py-3 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 shadow-lg"
                >
                  <Zap className="w-4 h-4" />
                  Commencer à s'entraîner
                </button>
              </div>

            </div>
          </div>
        )}

        {mode === 'manage' && (
          <div className="space-y-6" key={`manage-${animationKey}`}>
            {/* Titre de la leçon */}
            <div className="flex items-center gap-3">
              {editingLessonId === currentLessonId ? (
                <>
                  <input
                    autoFocus
                    value={editingLessonName}
                    onChange={e => setEditingLessonName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEditingLesson();
                      if (e.key === 'Escape') setEditingLessonId(null);
                    }}
                    onBlur={saveEditingLesson}
                    className="flex-1 text-2xl font-bold text-gray-800 bg-transparent border-b-2 border-indigo-500 outline-none pb-0.5"
                  />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-800 leading-tight">
                    {lessons[currentLessonId]?.name}
                  </h1>
                  <button
                    onClick={() => startEditingLesson(currentLessonId, lessons[currentLessonId]?.name)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex-shrink-0"
                    title="Renommer la leçon"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Volets accordéon */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setManageTab('cards')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  manageTab === 'cards'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Edit className="w-4 h-4" />
                Édition des cartes
              </button>
              <button
                onClick={() => setManageTab('modes')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  manageTab === 'modes'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                Modes de jeu
              </button>
            </div>

            {manageTab === 'cards' && (<>
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Ajouter une Nouvelle Carte</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                  <textarea
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    rows="2"
                    placeholder="Entrez votre question..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Réponse</label>
                  <textarea
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    rows="2"
                    placeholder="Entrez la réponse..."
                  />
                </div>
              </div>

              {/* Section images */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Image pour la Question */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Question (optionnel)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'front', false);
                      }}
                      className="hidden"
                      id="newCardFrontImageInput"
                    />
                    <label
                      htmlFor="newCardFrontImageInput"
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      Choisir
                    </label>
                    {newCardFrontImage && (
                      <button
                        onClick={() => setNewCardFrontImage(null)}
                        className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-xs font-medium"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  {newCardFrontImage && (
                    <div className="mt-2">
                      <img
                        src={newCardFrontImage}
                        alt="Aperçu question"
                        className="max-w-full h-24 object-contain rounded-lg border-2 border-gray-200"
                      />
                    </div>
                  )}
                </div>

                {/* Image pour la Réponse */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Réponse (optionnel)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'back', false);
                      }}
                      className="hidden"
                      id="newCardBackImageInput"
                    />
                    <label
                      htmlFor="newCardBackImageInput"
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-medium"
                    >
                      <Upload className="w-3 h-3" />
                      Choisir
                    </label>
                    {newCardBackImage && (
                      <button
                        onClick={() => setNewCardBackImage(null)}
                        className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-xs font-medium"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  {newCardBackImage && (
                    <div className="mt-2">
                      <img
                        src={newCardBackImage}
                        alt="Aperçu réponse"
                        className="max-w-full h-24 object-contain rounded-lg border-2 border-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section faux choix (optionnel) pour le QCM — rétractable */}
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowNewWrongAnswers(!showNewWrongAnswers)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-all text-sm font-medium text-gray-700"
                >
                  <span className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Faux choix pour le QCM (optionnel)
                  </span>
                  <span className={`transition-transform duration-300 ${showNewWrongAnswers ? 'rotate-180' : ''}`}>▼</span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: showNewWrongAnswers ? '300px' : '0px', opacity: showNewWrongAnswers ? 1 : 0 }}
                >
                  <div className="px-4 pb-4">
                    <p className="text-xs text-gray-500 mb-3">Ajoutez jusqu'à 3 mauvaises réponses pour le mode QCM. Si laissé vide, les réponses seront générées aléatoirement.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {newWrongAnswers.map((wa, index) => (
                        <input
                          key={index}
                          type="text"
                          value={wa}
                          onChange={(e) => {
                            const updated = [...newWrongAnswers];
                            updated[index] = e.target.value;
                            setNewWrongAnswers(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-white"
                          placeholder={`Faux choix ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={addCard}
                className="mt-4 w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105 font-medium flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Ajouter une Carte
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 animate-slide-in" style={{animationDelay: '0.1s'}}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Vos Cartes ({cards.length})</h2>
                  {lessons[currentLessonId]?.flipped && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-600 border border-indigo-200">
                      <ArrowLeftRight className="w-3 h-3" />
                      Inversé
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      flipLesson();
                      setShowFlipLabel(true);
                      setTimeout(() => setShowFlipLabel(false), 3000);
                    }}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all transform hover:scale-105 font-medium flex items-center gap-2 overflow-hidden"
                    title="Inverser le sens des cartes"
                  >
                    <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
                    <span
                      className="whitespace-nowrap transition-all duration-500 ease-in-out"
                      style={{
                        maxWidth: showFlipLabel ? '200px' : '0px',
                        opacity: showFlipLabel ? 1 : 0,
                        marginLeft: showFlipLabel ? '0px' : '-8px',
                      }}
                    >
                      {lessons[currentLessonId]?.flipped ? 'Réponse → Question' : 'Question → Réponse'}
                    </span>
                  </button>
                  <button
                    onClick={() => setConfirmResetProgress(true)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 font-medium flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {cards.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucune carte pour le moment. Ajoutez votre première carte ci-dessus !</p>
                ) : (
                  cards.map((card, idx) => (
                    <div key={card.id} className={`border border-gray-200 rounded-lg p-4 transition-all animate-slide-in ${editingCardId === card.id ? 'bg-white' : 'hover:bg-gray-50 hover:shadow-md'}`} style={{animationDelay: `${idx * 0.05}s`}}>
                      {editingCardId === card.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                            <textarea
                              value={editingCardFront}
                              onChange={(e) => setEditingCardFront(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                              rows="2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Réponse</label>
                            <textarea
                              value={editingCardBack}
                              onChange={(e) => setEditingCardBack(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                              rows="2"
                            />
                          </div>

                          {/* Section images pour l'édition */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Image Question */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Image Question</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(file, 'front', true);
                                  }}
                                  className="hidden"
                                  id={`editCardFrontImageInput-${card.id}`}
                                />
                                <label
                                  htmlFor={`editCardFrontImageInput-${card.id}`}
                                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-medium"
                                >
                                  <Upload className="w-3 h-3" />
                                  Choisir
                                </label>
                                {editingCardFrontImage && (
                                  <button
                                    onClick={() => setEditingCardFrontImage(null)}
                                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-xs font-medium"
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                              {editingCardFrontImage && (
                                <div className="mt-2">
                                  <img
                                    src={editingCardFrontImage}
                                    alt="Aperçu question"
                                    className="max-w-full h-20 object-contain rounded-lg border-2 border-gray-200"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Image Réponse */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Image Réponse</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(file, 'back', true);
                                  }}
                                  className="hidden"
                                  id={`editCardBackImageInput-${card.id}`}
                                />
                                <label
                                  htmlFor={`editCardBackImageInput-${card.id}`}
                                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-medium"
                                >
                                  <Upload className="w-3 h-3" />
                                  Choisir
                                </label>
                                {editingCardBackImage && (
                                  <button
                                    onClick={() => setEditingCardBackImage(null)}
                                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-xs font-medium"
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                              {editingCardBackImage && (
                                <div className="mt-2">
                                  <img
                                    src={editingCardBackImage}
                                    alt="Aperçu réponse"
                                    className="max-w-full h-20 object-contain rounded-lg border-2 border-gray-200"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Section faux choix pour l'édition — rétractable */}
                          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowEditingWrongAnswers(!showEditingWrongAnswers)}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 transition-all text-sm font-medium text-gray-700"
                            >
                              <span className="flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Faux choix pour le QCM (optionnel)
                              </span>
                              <span className={`transition-transform duration-300 ${showEditingWrongAnswers ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            <div
                              className="overflow-hidden transition-all duration-300 ease-in-out"
                              style={{ maxHeight: showEditingWrongAnswers ? '200px' : '0px', opacity: showEditingWrongAnswers ? 1 : 0 }}
                            >
                              <div className="px-3 pb-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {editingWrongAnswers.map((wa, index) => (
                                    <input
                                      key={index}
                                      type="text"
                                      value={wa}
                                      onChange={(e) => {
                                        const updated = [...editingWrongAnswers];
                                        updated[index] = e.target.value;
                                        setEditingWrongAnswers(updated);
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-white"
                                      placeholder={`Faux choix ${index + 1}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={saveEditingCard}
                              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105 text-sm font-medium shadow"
                            >
                              Sauvegarder
                            </button>
                            <button
                              onClick={cancelEditingCard}
                              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 text-sm font-medium shadow"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-3">
                          <div
                            className="flex-1 cursor-pointer"
                            onDoubleClick={() => startEditingCard(card)}
                            title="Double-cliquez pour éditer"
                          >
                            {(card.frontImage || card.backImage) ? (
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-800 mb-2">{card.front}</div>
                                  {card.frontImage && (
                                    <img
                                      src={card.frontImage}
                                      alt="Image question"
                                      className="max-w-full h-20 object-contain rounded border border-gray-200"
                                    />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm text-gray-600 mb-2">{card.back}</div>
                                  {card.backImage && (
                                    <img
                                      src={card.backImage}
                                      alt="Image réponse"
                                      className="max-w-full h-20 object-contain rounded border border-gray-200"
                                    />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium text-gray-800 mb-1">{card.front}</div>
                                <div className="text-sm text-gray-600">{card.back}</div>
                              </>
                            )}
                            {card.wrongAnswers && card.wrongAnswers.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {card.wrongAnswers.map((wa, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                    ✗ {wa}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => startEditingCard(card)}
                              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all transform hover:scale-110"
                              title="Éditer la carte"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteCard(card.id)}
                              className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-all transform hover:scale-110"
                              title="Supprimer la carte"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            </>)}

            {manageTab === 'modes' && (
            <>
            {/* Configuration des Modes de Jeu */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">Modes de Jeu</h2>
                <Settings className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-3">
                {/* Flashcards — toujours actif */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-gray-800">Cartes Classiques</span>
                  </div>
                  <input type="checkbox" checked disabled className="w-5 h-5 rounded accent-blue-500" />
                </label>

                {/* Modes built-in togglables */}
                {[
                  { id: 'match', name: "Jeu d'Association", icon: Target, color: 'text-purple-500' },
                  { id: 'mcq', name: 'Choix Multiple', icon: CheckCircle, color: 'text-green-500' },
                  { id: 'type', name: 'Défi de Frappe', icon: Gamepad2, color: 'text-orange-500' },
                ].map(m => {
                  const gm = lessons[currentLessonId]?.gameModes;
                  const enabled = !gm || gm[m.id] !== false;
                  return (
                    <label key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-all">
                      <div className="flex items-center gap-3">
                        <m.icon className={`w-5 h-5 ${m.color}`} />
                        <span className="font-medium text-gray-800">{m.name}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => toggleGameMode(m.id, e.target.checked)}
                        className="w-5 h-5 rounded accent-indigo-500"
                      />
                    </label>
                  );
                })}

                {/* Modes externes actifs sur cette leçon */}
                {(() => {
                  const gm = lessons[currentLessonId]?.gameModes;
                  const activeModes = Object.values(installedModes).filter(ext => gm && gm[ext.id] === true);
                  const availableModes = Object.values(installedModes).filter(ext => !gm || gm[ext.id] !== true);
                  return (
                    <>
                      {activeModes.length > 0 && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Modes externes actifs</p>
                          {activeModes.map(ext => (
                            <div key={ext.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition-all">
                              <div
                                className="flex items-center gap-3 cursor-pointer flex-1"
                                onClick={() => startExternalEdit(ext.id)}
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: ext.color }}>
                                  <ModeIcon icon={ext.icon} size="sm" />
                                </div>
                                <div>
                                  <span className="font-medium text-gray-800 block">{ext.name}</span>
                                  <span className="text-xs text-gray-400 block">par {ext.author}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {ext.hasEditMode && (
                                  <button
                                    onClick={() => startExternalEdit(ext.id)}
                                    className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Configurer"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleGameMode(ext.id, false)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Retirer de cette leçon"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Modes installés mais pas encore ajoutés à cette leçon */}
                      {availableModes.length > 0 && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Modes disponibles</p>
                          {availableModes.map(ext => (
                            <div key={ext.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition-all">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: ext.color }}>
                                  <ModeIcon icon={ext.icon} size="sm" />
                                </div>
                                <div>
                                  <span className="font-medium text-gray-800 block">{ext.name}</span>
                                  <span className="text-xs text-gray-400 block">par {ext.author}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setConfirmUninstallMode(ext)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Désinstaller"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    toggleGameMode(ext.id, true);
                                    setToastMessage(`Mode "${ext.name}" ajouté à cette leçon !`);
                                    setToastType('success');
                                    setShowToast(true);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Ajouter
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Bouton installer un mode */}
                <button
                  onClick={() => { setStoreUrl(''); setStoreError(''); fetchRegistry(); setMode('store'); }}
                  className="w-full mt-2 px-4 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Installer un nouveau mode
                </button>
              </div>
            </div>
            </>
            )}

          </div>
        )}

        {/* Page Store — Boutique de modes de jeux */}
        {mode === 'store' && !selectedRegistryMode && (
          <div className="animate-slide-in">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              {/* Header : titre + bouton URL */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Gamepad2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Boutique de modes de jeux</h2>
                    <p className="text-sm text-gray-500">Découvrez et installez des modes créés par la communauté</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {Object.keys(installedModes).length > 0 && (
                    <button
                      onClick={() => setShowInstalledModesModal(true)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-indigo-400 hover:text-indigo-600 transition-all font-medium flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Modes installés</span>
                      <span className="sm:hidden">Installés</span>
                      <span className="bg-indigo-100 text-indigo-600 rounded-full flex-shrink-0" style={{ display: 'inline-block', width: '20px', height: '20px', lineHeight: '20px', textAlign: 'center', fontSize: '11px', fontWeight: 700 }}>{Object.keys(installedModes).length}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowStoreModal(true)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-indigo-400 hover:text-indigo-600 transition-all font-medium flex items-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">Installer via URL</span>
                    <span className="sm:hidden">Via URL</span>
                  </button>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="relative mb-6">
                <input
                  type="text"
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  placeholder="Rechercher un mode de jeu..."
                  className="w-full px-4 py-3 pl-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-gray-50 focus:bg-white"
                />
                <Globe className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* État loading */}
              {registryLoading && (
                <div className="text-center py-16">
                  <Loader className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Chargement du catalogue...</p>
                </div>
              )}

              {/* État erreur */}
              {registryError && !registryLoading && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <X className="w-7 h-7 text-red-500" />
                  </div>
                  <p className="text-gray-600 mb-4">{registryError}</p>
                  <button
                    onClick={() => fetchRegistry(true)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-sm"
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {/* Grille des modes */}
              {!registryLoading && !registryError && (() => {
                const search = registrySearch.toLowerCase();
                const filtered = registryModes.filter(m =>
                  !search ||
                  m.name.toLowerCase().includes(search) ||
                  m.description.toLowerCase().includes(search) ||
                  (m.tags || []).some(t => t.toLowerCase().includes(search)) ||
                  m.author.toLowerCase().includes(search)
                );

                if (filtered.length === 0 && registryModes.length > 0) {
                  return (
                    <div className="text-center py-12">
                      <p className="text-gray-500">Aucun mode trouvé pour "<span className="font-medium">{registrySearch}</span>"</p>
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Gamepad2 className="w-7 h-7 text-gray-400" />
                      </div>
                      <p className="text-gray-500">Aucun mode disponible pour le moment.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filtered.map(rm => {
                      const isInstalled = !!installedModes[rm.id];
                      const isInstalling = installingModeId === rm.id;
                      return (
                        <div
                          key={rm.id}
                          onClick={() => setSelectedRegistryMode(rm)}
                          onMouseEnter={() => setHoveredModeId(rm.id)}
                          onMouseLeave={() => setHoveredModeId(null)}
                          className={`border rounded-xl p-5 transition-all flex items-center gap-4 cursor-pointer ${hoveredModeId === rm.id ? 'shadow-md' : ''}`}
                          style={{
                            borderColor: hoveredModeId === rm.id ? rm.color + '70' : '#e5e7eb',
                          }}
                        >
                          {/* Icône */}
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rm.color + '20', color: rm.color }}>
                            <ModeIcon icon={rm.icon} size="md" />
                          </div>
                          {/* Nom + tags */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 mb-1">{rm.name}</h4>
                            {rm.tags && rm.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {rm.tags.map(tag => (
                                  <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Action droite, centrée verticalement */}
                          {isInstalled ? (
                            <span className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-full font-medium flex-shrink-0">
                              Installé
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); installFromRegistry(rm); }}
                              disabled={isInstalling}
                              className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 transition-all ${
                                isInstalling
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                              }`}
                            >
                              {isInstalling ? <Loader className="w-3 h-3 animate-spin" /> : 'Installer'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Page détails d'un mode */}
        {mode === 'store' && selectedRegistryMode && (
          <div className="animate-slide-in">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              {/* Bouton retour */}
              <button
                onClick={() => setSelectedRegistryMode(null)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-all mb-6 group"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Retour à la boutique
              </button>

              {/* Header du mode */}
              <div className="flex flex-col sm:flex-row gap-5 mb-8">
                <div className="w-32 h-32 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: selectedRegistryMode.color + '20', color: selectedRegistryMode.color }}>
                  <ModeIcon icon={selectedRegistryMode.icon} size="xl" className="text-5xl" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold text-gray-800">{selectedRegistryMode.name}</h2>
                      {selectedRegistryMode.featured && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Recommandé</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-4">par {selectedRegistryMode.author}</p>
                  </div>
                  {/* Bouton installer / installé */}
                  {(() => {
                    const isInstalled = !!installedModes[selectedRegistryMode.id];
                    const isInstalling = installingModeId === selectedRegistryMode.id;
                    return isInstalled ? (
                      <div className="self-start flex items-center gap-3">
                        <span className="px-5 py-2.5 border border-transparent bg-green-50 text-green-600 rounded-lg text-sm font-medium flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Installé
                        </span>
                        <button
                          onClick={() => setConfirmUninstallMode(selectedRegistryMode)}
                          className="px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Désinstaller
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => installFromRegistry(selectedRegistryMode)}
                        disabled={isInstalling}
                        className={`self-start px-6 py-2.5 border border-transparent rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                          isInstalling
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg'
                        }`}
                      >
                        {isInstalling ? (
                          <><Loader className="w-4 h-4 animate-spin" /> Installation...</>
                        ) : (
                          <><Download className="w-4 h-4" /> Installer ce mode</>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Galerie de screenshots */}
              {selectedRegistryMode.screenshots && selectedRegistryMode.screenshots.length > 0 && (
                <div className="-mr-4 sm:-mr-6 mb-8">
                  <div className="flex gap-4 overflow-x-auto pr-4 sm:pr-6 pb-3 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {selectedRegistryMode.screenshots.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Screenshot ${i + 1}`}
                        onClick={() => setLightboxIndex(i)}
                        className="w-96 sm:w-[28rem] h-auto rounded-xl flex-shrink-0 snap-start border border-gray-200 cursor-pointer hover:brightness-95 transition-all"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{selectedRegistryMode.description || 'Aucune description disponible.'}</p>
              </div>

              {/* Tags */}
              {selectedRegistryMode.tags && selectedRegistryMode.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRegistryMode.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Infos techniques */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Informations</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Éditeur</span>
                    <span className="text-sm font-medium text-gray-700">{selectedRegistryMode.author}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Version</span>
                    <span className="text-sm font-medium text-gray-700">{selectedRegistryMode.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Source</span>
                    <span className="text-sm font-medium text-gray-500 truncate max-w-xs">{selectedRegistryMode.scriptUrl}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Modes installés */}
        {showInstalledModesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col animate-bounce-in" style={{ maxHeight: '85vh' }}>
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Download className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Modes installés</h2>
                      <p className="text-sm text-gray-500">{Object.keys(installedModes).length} mode{Object.keys(installedModes).length > 1 ? 's' : ''} installé{Object.keys(installedModes).length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInstalledModesModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Liste des modes */}
              <div className="overflow-y-auto flex-1 p-6">
                {Object.keys(installedModes).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Download className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun mode installé</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.values(installedModes).map(ext => (
                      <div key={ext.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ext.color + '20', color: ext.color }}>
                          <ModeIcon icon={ext.icon} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{ext.name}</p>
                          <p className="text-xs text-gray-500 truncate">v{ext.version} — {ext.author}</p>
                        </div>
                        <button
                          onClick={() => setConfirmUninstallMode(ext)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all flex-shrink-0"
                          title="Désinstaller"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmation désinstallation */}
        {confirmUninstallMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm animate-bounce-in">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Désinstaller ce mode ?</h3>
                <p className="text-sm text-gray-500 mb-1">
                  Le mode <span className="font-semibold text-gray-700">"{confirmUninstallMode.name}"</span> sera supprimé définitivement.
                </p>
                <p className="text-sm text-red-500 font-medium mb-6">
                  Il sera retiré de toutes les leçons qui l'utilisent.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmUninstallMode(null)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      const modeName = confirmUninstallMode.name;
                      uninstallExternalMode(confirmUninstallMode.id);
                      setConfirmUninstallMode(null);
                      setToastMessage(`Mode "${modeName}" désinstallé`);
                      setToastType('success');
                      setShowToast(true);
                    }}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Désinstaller
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmResetProgress && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm animate-bounce-in">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RotateCcw className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Réinitialiser la progression ?</h3>
                <p className="text-sm text-gray-500 mb-1">
                  Toute la progression d'apprentissage de cette leçon sera effacée.
                </p>
                <p className="text-sm text-orange-500 font-medium mb-6">
                  Les intervalles de révision, le score de maîtrise et les statistiques seront remis à zéro. Le contenu des cartes ne sera pas modifié.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmResetProgress(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      resetProgress();
                      setConfirmResetProgress(false);
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox screenshot */}
        {lightboxIndex !== null && selectedRegistryMode?.screenshots && (
          <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 cursor-pointer"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Bouton fermer */}
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-all z-10"
            >
              <X className="w-6 h-6" />
            </button>
            {/* Flèche gauche */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                className="absolute left-3 sm:left-6 p-2 bg-white bg-opacity-20 hover:bg-opacity-40 rounded-full text-white transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {/* Image */}
            <img
              src={selectedRegistryMode.screenshots[lightboxIndex]}
              alt={`Screenshot ${lightboxIndex + 1}`}
              className="w-full max-w-5xl max-h-[90vh] object-contain rounded-xl animate-bounce-in"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Flèche droite */}
            {lightboxIndex < selectedRegistryMode.screenshots.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                className="absolute right-3 sm:right-6 p-2 bg-white bg-opacity-20 hover:bg-opacity-40 rounded-full text-white transition-all z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
            {/* Indicateur de position */}
            <div className="absolute bottom-6 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {selectedRegistryMode.screenshots.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === lightboxIndex ? 'bg-white w-4' : 'bg-white bg-opacity-40 hover:bg-opacity-70'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Modal Installer via URL */}
        {showStoreModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col animate-bounce-in" style={{ maxHeight: '85vh' }}>
              {/* Header avec icône */}
              <div className="p-6 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Installer via URL</h2>
                      <p className="text-sm text-gray-500">Ajoutez un mode depuis une URL externe</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowStoreModal(false); setStoreUrl(''); setStoreError(''); }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Contenu scrollable */}
              <div className="overflow-y-auto flex-1">
                <div className="p-6 space-y-4">
                  {/* Champ URL avec label */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">URL du fichier JavaScript</label>
                    <p className="text-xs text-gray-500 mb-2">Entrez l'URL d'un fichier .js compatible avec le SDK FlashMap.</p>
                    <input
                      type="url"
                      value={storeUrl}
                      onChange={(e) => { setStoreUrl(e.target.value); setStoreError(''); }}
                      placeholder="https://exemple.com/mon-mode.js"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                      disabled={storeLoading}
                    />
                  </div>
                  {storeError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                      <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600">{storeError}</p>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      if (!storeUrl.trim()) { setStoreError('Veuillez entrer une URL'); return; }
                      try { new URL(storeUrl); } catch { setStoreError('URL invalide'); return; }
                      setStoreError('');
                      setStoreLoading(true);
                      try {
                        const moduleDef = await loadExternalMode(storeUrl);
                        if (!moduleDef.id || !moduleDef.name || !moduleDef.onPlay || !moduleDef.onDestroy) {
                          throw new Error('Le mode doit implémenter id, name, onPlay et onDestroy');
                        }
                        if (installedModes[moduleDef.id]) {
                          throw new Error(`Le mode "${moduleDef.name}" est déjà installé`);
                        }
                        const meta = {
                          id: moduleDef.id, name: moduleDef.name,
                          description: moduleDef.description || '', author: moduleDef.author || 'Inconnu',
                          version: moduleDef.version || '1.0.0', url: storeUrl,
                          icon: moduleDef.icon || '🧩', color: moduleDef.color || '#6366F1',
                          installedAt: Date.now(), hasEditMode: !!moduleDef.onEdit,
                        };
                        setInstalledModes(prev => ({ ...prev, [meta.id]: meta }));
                        loadedModulesRef.current.set(meta.id, moduleDef);
                        // Activer le mode pour la leçon courante uniquement
                        setLessons(prev => ({
                          ...prev,
                          [currentLessonId]: {
                            ...prev[currentLessonId],
                            gameModes: {
                              ...prev[currentLessonId].gameModes,
                              [meta.id]: true
                            }
                          }
                        }));
                        setShowStoreModal(false);
                        setStoreUrl('');
                        setStoreError('');
                        setToastMessage(`Mode "${meta.name}" installé et ajouté à cette leçon !`);
                        setToastType('success');
                        setShowToast(true);
                      } catch (err) {
                        setStoreError(err.message);
                      } finally {
                        setStoreLoading(false);
                      }
                    }}
                    disabled={storeLoading || !storeUrl.trim()}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      storeLoading || !storeUrl.trim()
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg'
                    }`}
                  >
                    {storeLoading ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Installation...</>
                    ) : (
                      <><Download className="w-4 h-4" /> Installer le mode</>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 pb-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <p className="text-gray-600 text-sm">
            Made with love by <span className="font-semibold text-indigo-600">tomyfak</span>
          </p>
          <button
            onClick={() => setShowAboutModal(true)}
            className="sm:hidden text-indigo-600 hover:text-indigo-700 text-sm font-medium underline"
          >
            À Propos
          </button>
        </div>
      </footer>

      {/* Feedback visuel pour le drag-and-drop mobile */}
      {isDraggingTouch && draggedLesson && lessons[draggedLesson] && (() => {
        // Trouver la couleur du dossier contenant la leçon
        let folderColor = '#6366F1'; // indigo par défaut
        let bgColor = '#ffffff';
        let isInUncategorized = false;

        Object.entries(folders).forEach(([folderId, folder]) => {
          if (folder.lessonIds && folder.lessonIds.includes(draggedLesson)) {
            if (folderId === 'uncategorized') {
              isInUncategorized = true;
              folderColor = '#6366F1'; // Forcer indigo pour "Sans dossier"
            } else {
              folderColor = folder.color;
            }
          }
        });

        // Si c'est la leçon courante, ajouter un fond coloré
        if (currentLessonId === draggedLesson) {
          if (isInUncategorized) {
            bgColor = '#EEF2FF'; // indigo-50
          } else {
            // Convertir la couleur hex en rgba avec opacité
            const hex = folderColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            bgColor = `rgba(${r}, ${g}, ${b}, 0.08)`;
          }
        }

        return (
          <div
            style={{
              position: 'fixed',
              left: touchCurrentPos.x - 100,
              top: touchCurrentPos.y - 40,
              pointerEvents: 'none',
              zIndex: 9999,
              transform: 'scale(0.85) rotate(-5deg)',
            }}
          >
            <div
              className="p-4 rounded-lg border-2 shadow-2xl"
              style={{
                width: '200px',
                opacity: 0.95,
                borderColor: folderColor,
                backgroundColor: bgColor,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 mb-1 text-sm line-clamp-2">
                    {lessons[draggedLesson].name}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {lessons[draggedLesson].cards?.length || 0} carte{lessons[draggedLesson].cards?.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal d'édition de mode externe */}
      {showExternalEditModal && externalEditModeId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col animate-bounce-in" style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-gray-800">
                  Configurer — {installedModes[externalEditModeId]?.name || 'Mode externe'}
                </h2>
              </div>
              <button
                onClick={exitExternalEdit}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Container pour le rendu onEdit du mode */}
            <div className="flex-1 overflow-y-auto p-4" ref={externalEditContainerRef}></div>
            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={exitExternalEdit}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'aperçu de partage via URL */}
      {showSharePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full animate-bounce-in">
            {sharePreviewLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement de la leçon...</p>
              </div>
            ) : sharePreviewError ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Erreur</h2>
                <p className="text-red-600 mb-6 text-center">{sharePreviewError}</p>
                <button
                  onClick={() => {
                    setShowSharePreview(false);
                    window.history.replaceState({}, '', window.location.pathname);
                  }}
                  className="w-full px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
                >
                  Fermer
                </button>
              </>
            ) : sharePreviewData ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full">
                  <BookOpen className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Leçon partagée</h2>
                <p className="text-gray-600 mb-6 text-center">
                  Voulez-vous ajouter cette leçon à votre espace ?
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{sharePreviewData.lesson.name}</h3>
                  <p className="text-gray-600 text-sm mb-2">
                    {sharePreviewData.lesson.cards?.length || 0} carte{sharePreviewData.lesson.cards?.length > 1 ? 's' : ''}
                  </p>
                  {sharePreviewData.expiresAt && (
                    <p className="text-gray-500 text-xs">
                      Expire le {new Date(sharePreviewData.expiresAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                  {sharePreviewData.remainingUses !== null && (
                    <p className="text-gray-500 text-xs">
                      Utilisations restantes : {sharePreviewData.remainingUses}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSharePreview(false);
                      window.history.replaceState({}, '', window.location.pathname);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      // Importer la leçon
                      const newLessonId = Date.now().toString();

                      // Ajouter la leçon aux leçons existantes (comme addImportedLesson)
                      const newLessons = {
                        ...lessons,
                        [newLessonId]: {
                          ...sharePreviewData.lesson,
                          id: newLessonId
                        }
                      };

                      setLessons(newLessons);

                      // Ajouter au dossier "Sans dossier"
                      const newFolders = { ...folders };
                      if (!newFolders.uncategorized) {
                        newFolders.uncategorized = {
                          name: 'Sans dossier',
                          color: '#6B7280',
                          lessonIds: [],
                          isExpanded: true
                        };
                      }
                      newFolders.uncategorized.lessonIds.push(newLessonId);
                      setFolders(newFolders);

                      setCurrentLessonId(newLessonId);
                      setCards(newLessons[newLessonId].cards);
                      setStats(newLessons[newLessonId].stats);
                      setMode('menu');
                      setShowSharePreview(false);
                      window.history.replaceState({}, '', window.location.pathname);

                      // Message de succès
                      setToastMessage(`Leçon "${sharePreviewData.lesson.name}" importée avec succès !`);
                      setToastType('success');
                      setShowToast(true);
                    }}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 font-medium"
                  >
                    Importer
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}