/**
 * Service Analytics pour Flashmap
 * Gère le tracking des événements utilisateur
 */

// URL de l'API (à adapter selon l'environnement)
const API_URL = process.env.REACT_APP_API_URL || 'https://api.flashmap.app/api';

class Analytics {
  constructor() {
    this.userId = this.getUserId();
    this.sessionId = this.getSessionId();
    this.isEnabled = true; // Possibilité de désactiver le tracking
  }

  /**
   * Génère ou récupère l'ID utilisateur unique
   * Stocké dans localStorage pour persistance
   */
  getUserId() {
    const storageKey = 'flashmap_user_id';
    let userId = localStorage.getItem(storageKey);

    if (!userId) {
      // Générer un nouvel UUID
      userId = this.generateUUID();
      localStorage.setItem(storageKey, userId);
    }

    return userId;
  }

  /**
   * Génère ou récupère l'ID de session
   * Stocké dans sessionStorage (nouveau à chaque visite)
   */
  getSessionId() {
    const storageKey = 'flashmap_session_id';
    let sessionId = sessionStorage.getItem(storageKey);

    if (!sessionId) {
      sessionId = this.generateUUID();
      sessionStorage.setItem(storageKey, sessionId);
    }

    return sessionId;
  }

  /**
   * Génère un UUID v4 simple
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Envoie un événement à l'API
   * Méthode asynchrone non-bloquante
   */
  async track(eventType, eventData = {}) {
    if (!this.isEnabled) {
      console.log('[Analytics] Tracking désactivé');
      return;
    }

    try {
      const payload = {
        userId: this.userId,
        sessionId: this.sessionId,
        eventType,
        eventData
      };

      // Envoi asynchrone sans attendre la réponse
      fetch(`${API_URL}/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        // Log silencieux en cas d'erreur (ne pas perturber l'UX)
        console.warn('[Analytics] Erreur d\'envoi:', error.message);
      });

      // Log pour debugging (à retirer en production)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Event tracked:', eventType, eventData);
      }

    } catch (error) {
      console.warn('[Analytics] Erreur:', error);
    }
  }

  // ========================================
  // Helpers spécifiques pour chaque événement
  // ========================================

  /**
   * Track le démarrage d'une session
   */
  trackSessionStart() {
    const eventData = {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timestamp: new Date().toISOString()
    };

    this.track('session_start', eventData);
  }

  /**
   * Track la création d'une leçon
   */
  trackLessonCreated(lessonId, cardCount) {
    const eventData = {
      lesson_id: lessonId,
      card_count: cardCount
    };

    this.track('lesson_created', eventData);
  }

  /**
   * Track la modification d'une leçon
   */
  trackLessonEdited(lessonId) {
    const eventData = {
      lesson_id: lessonId
    };

    this.track('lesson_edited', eventData);
  }

  /**
   * Track la suppression d'une leçon
   */
  trackLessonDeleted(lessonId) {
    const eventData = {
      lesson_id: lessonId
    };

    this.track('lesson_deleted', eventData);
  }

  /**
   * Track l'import d'une leçon
   */
  trackLessonImported(method) {
    const eventData = {
      method // 'code' ou 'url'
    };

    this.track('lesson_imported', eventData);
  }

  /**
   * Track le début d'un jeu
   */
  trackGameStarted(mode, lessonId) {
    const eventData = {
      mode, // 'flashcards', 'quiz', 'write', 'match'
      lesson_id: lessonId,
      started_at: new Date().toISOString()
    };

    this.track('game_started', eventData);
  }

  /**
   * Track la fin d'un jeu avec statistiques
   */
  trackGameCompleted(mode, lessonId, stats) {
    const eventData = {
      mode,
      lesson_id: lessonId,
      duration: stats.duration, // en secondes
      score: stats.score,
      cards_played: stats.cardsPlayed,
      completed_at: new Date().toISOString()
    };

    this.track('game_completed', eventData);
  }

  /**
   * Track l'utilisation de Magic Lesson
   */
  trackMagicLessonUsed(source, cardCount) {
    const eventData = {
      source, // 'text' ou 'image'
      card_count: cardCount
    };

    this.track('magic_lesson_used', eventData);
  }

  /**
   * Désactiver le tracking (pour respecter les préférences utilisateur)
   */
  disable() {
    this.isEnabled = false;
    console.log('[Analytics] Tracking désactivé');
  }

  /**
   * Activer le tracking
   */
  enable() {
    this.isEnabled = true;
    console.log('[Analytics] Tracking activé');
  }
}

// Export d'une instance singleton
const analytics = new Analytics();
export default analytics;
