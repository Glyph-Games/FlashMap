const cron = require('node-cron');
const db = require('../models/db');

/**
 * Supprime toutes les leçons expirées de la base de données
 */
async function cleanupExpiredLessons() {
  try {
    // Supprimer les leçons expirées ET les leçons one-time consommées
    const result = await db.query(
      `DELETE FROM shared_lessons
       WHERE (expires_at IS NOT NULL AND expires_at < NOW())
       OR (max_downloads IS NOT NULL AND download_count >= max_downloads)
       RETURNING code`,
      []
    );

    if (result.rows.length > 0) {
      console.log(`[Cleanup] ${result.rows.length} leçon(s) supprimée(s)`);
      result.rows.forEach(row => {
        console.log(`  - Code supprimé: ${row.code}`);
      });
    }

    return result.rows.length;
  } catch (error) {
    console.error('[Cleanup] Erreur lors du nettoyage:', error);
    throw error;
  }
}

/**
 * Démarre le cron job de nettoyage automatique
 * S'exécute toutes les heures
 */
function startCleanupSchedule() {
  // Exécution toutes les heures
  cron.schedule('0 * * * *', async () => {
    console.log('[Cleanup] Démarrage du nettoyage automatique...');
    await cleanupExpiredLessons();
  });

  console.log('[Cleanup] Tâche planifiée activée (toutes les heures)');
}

module.exports = {
  cleanupExpiredLessons,
  startCleanupSchedule
};
