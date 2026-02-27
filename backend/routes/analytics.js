const express = require('express');
const router = express.Router();
const db = require('../models/db');

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
      'magic_lesson_used'
    ];

    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        error: 'Type d\'événement invalide',
        details: `Types autorisés: ${validEventTypes.join(', ')}`
      });
    }

    // Insérer l'événement dans la base de données
    await db.query(
      `INSERT INTO analytics_events (user_id, session_id, event_type, event_data)
       VALUES ($1, $2, $3, $4)`,
      [userId, sessionId, eventType, JSON.stringify(eventData || {})]
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
