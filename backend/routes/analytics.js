const express = require('express');
const router = express.Router();
const db = require('../models/db');

const PLUS_SURVEY_ANSWERS = ['yes_monthly', 'yes_annual', 'no'];
const PLUS_SURVEY_REASONS = ['too_expensive', 'free_is_enough', 'cant_pay_online', 'not_interested', 'other'];
const PLUS_SURVEY_COMMENT_MAX_LENGTH = 500;

/**
 * Valide une réponse au sondage FlashMap Plus et ne garde que les champs connus.
 * Retourne null si la réponse est invalide.
 */
function sanitizePlusSurveyAnswer(data) {
  if (!PLUS_SURVEY_ANSWERS.includes(data.answer)) return null;

  const clean = { answer: data.answer };
  if (data.answer === 'no') {
    if (PLUS_SURVEY_REASONS.includes(data.reason)) clean.reason = data.reason;
    if (typeof data.comment === 'string' && data.comment.trim()) {
      clean.comment = data.comment.trim().slice(0, PLUS_SURVEY_COMMENT_MAX_LENGTH);
    }
  }
  return clean;
}

/**
 * POST /api/analytics/track
 * Enregistre un événement analytics
 * Route publique (pas d'authentification requise)
 */
router.post('/track', async (req, res) => {
  try {
    const { userId, sessionId, eventType, eventData } = req.body;

    // Validation des données
    if (!userId || !sessionId || !eventType) {
      return res.status(400).json({
        error: 'Données manquantes',
        details: 'userId, sessionId et eventType sont requis'
      });
    }

    // Validation du type d'événement
    const validEventTypes = [
      'session_start',
      'lesson_created',
      'lesson_edited',
      'lesson_deleted',
      'lesson_imported',
      'game_started',
      'game_completed',
      'magic_lesson_used',
      'plus_survey_answered',
      'plus_survey_later',
      'plus_survey_link_clicked'
    ];

    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        error: 'Type d\'événement invalide',
        details: `Types autorisés: ${validEventTypes.join(', ')}`
      });
    }

    let data = eventData || {};

    // Sondage FlashMap Plus : ne garder que les champs attendus (le commentaire est du texte libre)
    if (eventType === 'plus_survey_answered') {
      data = sanitizePlusSurveyAnswer(data);
      if (!data) {
        return res.status(400).json({
          error: 'Réponse au sondage invalide'
        });
      }
    }

    // Insérer l'événement dans la base de données
    await db.query(
      `INSERT INTO analytics_events (user_id, session_id, event_type, event_data)
       VALUES ($1, $2, $3, $4)`,
      [userId, sessionId, eventType, JSON.stringify(data)]
    );

    res.status(201).json({
      success: true,
      message: 'Événement enregistré'
    });

  } catch (error) {
    console.error('[Analytics/Track] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'enregistrement de l\'événement',
      details: error.message
    });
  }
});

module.exports = router;
