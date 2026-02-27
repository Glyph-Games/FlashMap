const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../models/db');

/**
 * Middleware d'authentification admin basé sur la base de données
 * Vérifie les credentials contre la table admin_users
 */
async function adminAuth(req, res, next) {
  try {
    const { username, password } = req.headers;

    // Vérifier que les credentials sont fournis
    if (!username || !password) {
      return res.status(401).json({
        error: 'Non autorisé',
        details: 'Nom d\'utilisateur et mot de passe requis'
      });
    }

    // Rechercher l'utilisateur dans la base de données
    const result = await db.query(
      'SELECT id, username, password_hash, role FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Non autorisé',
        details: 'Identifiants invalides'
      });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe avec bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Non autorisé',
        details: 'Identifiants invalides'
      });
    }

    // Mettre à jour la dernière connexion
    await db.query(
      'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Ajouter les infos utilisateur à la requête pour les routes suivantes
    req.adminUser = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    // Envoyer le rôle dans les headers de réponse
    res.setHeader('X-Admin-Role', user.role);

    next();

  } catch (error) {
    console.error('[AdminAuth] Erreur:', error);
    res.status(500).json({
      error: 'Erreur d\'authentification',
      details: error.message
    });
  }
}

/**
 * Middleware de vérification de rôle
 * Vérifie que l'utilisateur a au moins le rôle spécifié
 * Hiérarchie : viewer < admin < super_admin
 */
function requireRole(minRole) {
  const roleHierarchy = {
    'viewer': 0,
    'admin': 1,
    'super_admin': 2
  };

  return (req, res, next) => {
    const userRole = req.adminUser?.role || 'viewer';
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Accès refusé',
        details: `Cette action nécessite le rôle "${minRole}" ou supérieur. Vous êtes "${userRole}".`
      });
    }

    next();
  };
}

/**
 * GET /api/admin/stats
 * Récupère les statistiques globales
 */
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Total de partages
    const totalResult = await db.query('SELECT COUNT(*) as total FROM shared_lessons');
    const totalShares = parseInt(totalResult.rows[0].total);

    // Partages actifs (non expirés)
    const activeResult = await db.query(`
      SELECT COUNT(*) as active
      FROM shared_lessons
      WHERE expires_at IS NULL OR expires_at > NOW()
    `);
    const activeShares = parseInt(activeResult.rows[0].active);

    // Total des utilisations
    const usesResult = await db.query('SELECT SUM(download_count) as total_uses FROM shared_lessons');
    const totalUses = parseInt(usesResult.rows[0].total_uses) || 0;

    res.status(200).json({
      success: true,
      stats: {
        totalShares,
        activeShares,
        totalUses
      }
    });

  } catch (error) {
    console.error('[Admin/Stats] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/shares
 * Récupère la liste de tous les partages
 */
router.get('/shares', adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        code,
        lesson_data,
        created_at,
        expires_at,
        is_one_time,
        download_count,
        max_downloads
      FROM shared_lessons
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const shares = result.rows.map(share => {
      const lessonData = typeof share.lesson_data === 'string'
        ? JSON.parse(share.lesson_data)
        : share.lesson_data;

      return {
        code: share.code,
        lessonName: lessonData.name,
        cardCount: lessonData.cards?.length || 0,
        createdAt: share.created_at,
        expiresAt: share.expires_at,
        isOneTime: share.is_one_time,
        downloadCount: share.download_count,
        maxDownloads: share.max_downloads,
        isExpired: share.expires_at && new Date(share.expires_at) < new Date(),
        isActive: !share.expires_at || new Date(share.expires_at) > new Date()
      };
    });

    res.status(200).json({
      success: true,
      shares
    });

  } catch (error) {
    console.error('[Admin/Shares] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des partages',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/shares/:code
 * Supprime un partage spécifique
 */
router.delete('/shares/:code', adminAuth, requireRole('admin'), async (req, res) => {
  try {
    const { code } = req.params;

    const result = await db.query(
      'DELETE FROM shared_lessons WHERE code = $1 RETURNING code',
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Partage introuvable',
        details: 'Ce code n\'existe pas'
      });
    }

    res.status(200).json({
      success: true,
      message: `Partage ${code} supprimé avec succès`
    });

  } catch (error) {
    console.error('[Admin/Delete] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression du partage',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/cleanup
 * Nettoie les partages expirés et consommés
 */
router.post('/cleanup', adminAuth, requireRole('admin'), async (req, res) => {
  try {
    // Supprimer les partages expirés
    const expiredResult = await db.query(`
      DELETE FROM shared_lessons
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING code
    `);

    // Supprimer les partages one-time consommés
    const consumedResult = await db.query(`
      DELETE FROM shared_lessons
      WHERE max_downloads IS NOT NULL AND download_count >= max_downloads
      RETURNING code
    `);

    const expiredCount = expiredResult.rows.length;
    const consumedCount = consumedResult.rows.length;
    const totalCleaned = expiredCount + consumedCount;

    res.status(200).json({
      success: true,
      message: `Nettoyage terminé : ${totalCleaned} partage(s) supprimé(s)`,
      details: {
        expired: expiredCount,
        consumed: consumedCount,
        total: totalCleaned
      }
    });

  } catch (error) {
    console.error('[Admin/Cleanup] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors du nettoyage',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/activity
 * Récupère l'activité récente (derniers partages créés et récupérés)
 */
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const recentShares = await db.query(`
      SELECT
        code,
        lesson_data,
        created_at,
        download_count
      FROM shared_lessons
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const activities = recentShares.rows.map(share => {
      const lessonData = typeof share.lesson_data === 'string'
        ? JSON.parse(share.lesson_data)
        : share.lesson_data;

      return {
        code: share.code,
        lessonName: lessonData.name,
        createdAt: share.created_at,
        downloadCount: share.download_count,
        type: 'share_created'
      };
    });

    res.status(200).json({
      success: true,
      activities
    });

  } catch (error) {
    console.error('[Admin/Activity] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de l\'activité',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/users
 * Récupère la liste de tous les utilisateurs admin
 */
router.get('/users', adminAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        username,
        role,
        created_at,
        last_login
      FROM admin_users
      ORDER BY created_at DESC
    `);

    res.status(200).json({
      success: true,
      users: result.rows
    });

  } catch (error) {
    console.error('[Admin/Users] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des utilisateurs',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur admin
 */
router.post('/users', adminAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validation des données
    if (!username || !password || !role) {
      return res.status(400).json({
        error: 'Données manquantes',
        details: 'Username, password et role sont requis'
      });
    }

    // Vérifier le format du username
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(username)) {
      return res.status(400).json({
        error: 'Format de username invalide',
        details: 'Le username doit contenir entre 3 et 50 caractères alphanumériques'
      });
    }

    // Vérifier la longueur du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Mot de passe trop court',
        details: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier que le rôle est valide
    if (!['admin', 'super_admin', 'viewer'].includes(role)) {
      return res.status(400).json({
        error: 'Rôle invalide',
        details: 'Rôles autorisés: admin, super_admin, viewer'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Utilisateur existant',
        details: 'Ce nom d\'utilisateur est déjà utilisé'
      });
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const result = await db.query(
      `INSERT INTO admin_users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, created_at`,
      [username, passwordHash, role]
    );

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('[Admin/CreateUser] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la création de l\'utilisateur',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Supprime un utilisateur admin
 */
router.delete('/users/:id', adminAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.adminUser.id;

    // Empêcher un utilisateur de se supprimer lui-même
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({
        error: 'Action interdite',
        details: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Supprimer l'utilisateur
    const result = await db.query(
      'DELETE FROM admin_users WHERE id = $1 RETURNING username',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur introuvable',
        details: 'Cet utilisateur n\'existe pas'
      });
    }

    res.status(200).json({
      success: true,
      message: `Utilisateur ${result.rows[0].username} supprimé avec succès`
    });

  } catch (error) {
    console.error('[Admin/DeleteUser] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression de l\'utilisateur',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/change-password
 * Change le mot de passe de l'utilisateur connecté
 */
router.post('/change-password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.adminUser.id;

    // Validation des données
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Données manquantes',
        details: 'L\'ancien et le nouveau mot de passe sont requis'
      });
    }

    // Vérifier la longueur du nouveau mot de passe
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Mot de passe trop court',
        details: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Récupérer l'utilisateur
    const userResult = await db.query(
      'SELECT password_hash FROM admin_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur introuvable'
      });
    }

    const user = userResult.rows[0];

    // Vérifier l'ancien mot de passe
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Mot de passe incorrect',
        details: 'L\'ancien mot de passe est incorrect'
      });
    }

    // Hasher le nouveau mot de passe
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe
    await db.query(
      'UPDATE admin_users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('[Admin/ChangePassword] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors du changement de mot de passe',
      details: error.message
    });
  }
});

// ============================================
// Routes Analytics Admin
// ============================================

/**
 * GET /api/admin/analytics/overview
 * Récupère les KPIs principaux
 */
router.get('/analytics/overview', adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculer la date de début selon la période
    const periodMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      'all': '10 years' // Arbitraire pour "tout"
    };
    const periodInterval = periodMap[period] || '30 days';

    // Utilisateurs uniques
    const usersResult = await db.query(`
      SELECT COUNT(DISTINCT user_id) as unique_users
      FROM analytics_events
      WHERE created_at > NOW() - INTERVAL '${periodInterval}'
    `);

    // Sessions totales
    const sessionsResult = await db.query(`
      SELECT COUNT(DISTINCT session_id) as total_sessions
      FROM analytics_events
      WHERE created_at > NOW() - INTERVAL '${periodInterval}'
    `);

    // Leçons créées
    const lessonsResult = await db.query(`
      SELECT COUNT(*) as lessons_created
      FROM analytics_events
      WHERE event_type = 'lesson_created'
        AND created_at > NOW() - INTERVAL '${periodInterval}'
    `);

    // Temps moyen de session (calculé à partir des événements game_completed)
    const avgTimeResult = await db.query(`
      SELECT AVG((event_data->>'duration')::integer) as avg_duration
      FROM analytics_events
      WHERE event_type = 'game_completed'
        AND created_at > NOW() - INTERVAL '${periodInterval}'
        AND event_data->>'duration' IS NOT NULL
    `);

    res.status(200).json({
      success: true,
      period,
      kpis: {
        uniqueUsers: parseInt(usersResult.rows[0].unique_users) || 0,
        totalSessions: parseInt(sessionsResult.rows[0].total_sessions) || 0,
        lessonsCreated: parseInt(lessonsResult.rows[0].lessons_created) || 0,
        avgSessionTime: parseInt(avgTimeResult.rows[0].avg_duration) || 0
      }
    });

  } catch (error) {
    console.error('[Admin/Analytics/Overview] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des KPIs',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/analytics/timeline
 * Récupère les données temporelles pour les graphiques
 */
router.get('/analytics/timeline', adminAuth, async (req, res) => {
  try {
    const { period = '30d', metric = 'sessions' } = req.query;

    const periodMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      'all': '10 years'
    };
    const periodInterval = periodMap[period] || '30 days';

    let query;

    if (metric === 'sessions') {
      // Sessions par jour
      query = `
        SELECT
          DATE(created_at) as date,
          COUNT(DISTINCT session_id) as count
        FROM analytics_events
        WHERE created_at > NOW() - INTERVAL '${periodInterval}'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    } else if (metric === 'users') {
      // Utilisateurs uniques par jour
      query = `
        SELECT
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as count
        FROM analytics_events
        WHERE created_at > NOW() - INTERVAL '${periodInterval}'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    } else if (metric === 'lessons') {
      // Leçons créées par jour
      query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM analytics_events
        WHERE event_type = 'lesson_created'
          AND created_at > NOW() - INTERVAL '${periodInterval}'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    }

    const result = await db.query(query);

    const timeline = result.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count)
    }));

    res.status(200).json({
      success: true,
      period,
      metric,
      timeline
    });

  } catch (error) {
    console.error('[Admin/Analytics/Timeline] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des données temporelles',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/analytics/game-modes
 * Récupère les statistiques des modes de jeu
 */
router.get('/analytics/game-modes', adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const periodMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      'all': '10 years'
    };
    const periodInterval = periodMap[period] || '30 days';

    // Nombre de parties par mode
    const gamesResult = await db.query(`
      SELECT
        event_data->>'mode' as mode,
        COUNT(*) as games_played,
        AVG((event_data->>'duration')::integer) as avg_duration,
        AVG((event_data->>'score')::integer) as avg_score
      FROM analytics_events
      WHERE event_type IN ('game_started', 'game_completed')
        AND created_at > NOW() - INTERVAL '${periodInterval}'
        AND event_data->>'mode' IS NOT NULL
      GROUP BY event_data->>'mode'
      ORDER BY games_played DESC
    `);

    const gameModes = gamesResult.rows.map(row => ({
      mode: row.mode,
      gamesPlayed: parseInt(row.games_played) || 0,
      avgDuration: parseInt(row.avg_duration) || 0,
      avgScore: parseFloat(row.avg_score) || 0
    }));

    res.status(200).json({
      success: true,
      period,
      gameModes
    });

  } catch (error) {
    console.error('[Admin/Analytics/GameModes] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des stats de jeu',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/analytics/events
 * Récupère la liste des événements récents
 */
router.get('/analytics/events', adminAuth, async (req, res) => {
  try {
    const { type, limit = 100 } = req.query;

    let query = `
      SELECT
        id,
        user_id,
        session_id,
        event_type,
        event_data,
        created_at
      FROM analytics_events
    `;

    const params = [];

    if (type) {
      query += ` WHERE event_type = $1`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      events: result.rows
    });

  } catch (error) {
    console.error('[Admin/Analytics/Events] Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des événements',
      details: error.message
    });
  }
});

module.exports = router;
