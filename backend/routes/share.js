const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { generateUniqueCode } = require('../utils/codeGenerator');
const { shareLimiter, retrieveLimiter } = require('../middleware/rateLimit');

// Taille maximale acceptée pour une leçon (100 MB)
const MAX_LESSON_SIZE = 100 * 1024 * 1024;

/**
 * Calcule la date d'expiration en fonction de la durée choisie
 */
function calculateExpirationDate(duration) {
  const now = new Date();

  switch (duration) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '5h':
      return new Date(now.getTime() + 5 * 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'unlimited':
      return null;
    default:
      throw new Error('Durée invalide');
  }
}

/**
 * POST /api/share
 * Partage une leçon et génère un code unique
 */
router.post('/share', shareLimiter, async (req, res) => {
  try {
    const { lesson, duration, oneTime } = req.body;

    // Validation des données
    if (!lesson || !lesson.name || !lesson.cards || !Array.isArray(lesson.cards)) {
      return res.status(400).json({
        error: 'Données de leçon invalides',
        details: 'La leçon doit contenir un nom et un tableau de cartes'
      });
    }

    if (!['1h', '5h', '24h', '7d', 'unlimited'].includes(duration)) {
      return res.status(400).json({
        error: 'Durée invalide',
        details: 'Durées acceptées: 1h, 5h, 24h, 7d, unlimited'
      });
    }

    // Vérification de la taille
    const lessonSize = JSON.stringify(lesson).length;
    if (lessonSize > MAX_LESSON_SIZE) {
      return res.status(413).json({
        error: 'Leçon trop volumineuse',
        details: `Taille maximale: 100 MB, taille actuelle: ${(lessonSize / (1024 * 1024)).toFixed(2)} MB`
      });
    }

    // Générer un code unique
    const code = await generateUniqueCode();

    // Calculer la date d'expiration
    const expiresAt = calculateExpirationDate(duration);

    // Insérer dans la base de données
    const result = await db.query(
      `INSERT INTO shared_lessons
       (code, lesson_data, expires_at, is_one_time, max_downloads)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING code, created_at, expires_at`,
      [code, JSON.stringify(lesson), expiresAt, oneTime || false, oneTime ? 1 : null]
    );

    res.status(201).json({
      success: true,
      code: result.rows[0].code,
      expiresAt: result.rows[0].expires_at,
      oneTime: oneTime || false
    });

  } catch (error) {
    console.error('[Share] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors du partage de la leçon',
      details: error.message
    });
  }
});

/**
 * GET /api/retrieve/:code
 * Récupère une leçon partagée via son code
 */
router.get('/retrieve/:code', retrieveLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    // Validation du format du code (5 caractères alphanumériques)
    if (!/^[A-Z0-9]{5}$/.test(code.toUpperCase())) {
      return res.status(400).json({
        error: 'Format de code invalide',
        details: 'Le code doit contenir exactement 5 caractères alphanumériques'
      });
    }

    // Récupérer la leçon
    const result = await db.query(
      `SELECT code, lesson_data, expires_at, is_one_time, download_count, max_downloads
       FROM shared_lessons
       WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Code introuvable',
        details: 'Ce code n\'existe pas ou a expiré'
      });
    }

    const sharedLesson = result.rows[0];

    // Vérifier si la leçon a expiré
    if (sharedLesson.expires_at && new Date(sharedLesson.expires_at) < new Date()) {
      // Supprimer la leçon expirée
      await db.query('DELETE FROM shared_lessons WHERE code = $1', [code.toUpperCase()]);

      return res.status(410).json({
        error: 'Code expiré',
        details: 'Cette leçon partagée a expiré'
      });
    }

    // Vérifier si le nombre de téléchargements maximum est atteint
    if (sharedLesson.max_downloads && sharedLesson.download_count >= sharedLesson.max_downloads) {
      // Supprimer la leçon consommée
      await db.query('DELETE FROM shared_lessons WHERE code = $1', [code.toUpperCase()]);

      return res.status(410).json({
        error: 'Code consommé',
        details: 'Ce partage à usage unique a déjà été utilisé'
      });
    }

    // Incrémenter le compteur de téléchargements
    await db.query(
      'UPDATE shared_lessons SET download_count = download_count + 1 WHERE code = $1',
      [code.toUpperCase()]
    );

    // Calculer les téléchargements restants
    const remainingUses = sharedLesson.max_downloads
      ? sharedLesson.max_downloads - (sharedLesson.download_count + 1)
      : null;

    // Si c'est un one-time et qu'il a été utilisé, on le supprimera au prochain cleanup
    // (pas besoin de supprimer immédiatement, la vérification max_downloads le bloquera)

    res.status(200).json({
      success: true,
      lesson: sharedLesson.lesson_data,
      expiresAt: sharedLesson.expires_at,
      remainingUses: remainingUses
    });

  } catch (error) {
    console.error('[Retrieve] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de la leçon',
      details: error.message
    });
  }
});

/**
 * GET /api/check/:code
 * Vérifie l'existence et la validité d'un code sans le consommer
 */
router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (!/^[A-Z0-9]{5}$/.test(code.toUpperCase())) {
      return res.status(400).json({
        error: 'Format de code invalide'
      });
    }

    const result = await db.query(
      `SELECT expires_at, is_one_time, download_count, max_downloads
       FROM shared_lessons
       WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        exists: false
      });
    }

    const sharedLesson = result.rows[0];

    // Vérifier si expiré
    if (sharedLesson.expires_at && new Date(sharedLesson.expires_at) < new Date()) {
      return res.status(410).json({
        exists: false,
        expired: true
      });
    }

    // Vérifier si consommé
    if (sharedLesson.max_downloads && sharedLesson.download_count >= sharedLesson.max_downloads) {
      return res.status(410).json({
        exists: false,
        consumed: true
      });
    }

    const remainingUses = sharedLesson.max_downloads
      ? sharedLesson.max_downloads - sharedLesson.download_count
      : null;

    res.status(200).json({
      exists: true,
      expiresAt: sharedLesson.expires_at,
      isOneTime: sharedLesson.is_one_time,
      remainingUses: remainingUses
    });

  } catch (error) {
    console.error('[Check] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la vérification du code'
    });
  }
});

module.exports = router;
