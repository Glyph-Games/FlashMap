const express = require('express');
const cors = require('cors');
require('dotenv').config();

const shareRoutes = require('./routes/share');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const quizletRoutes = require('./routes/quizlet');
const { startCleanupSchedule } = require('./utils/cleanup');
const db = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (comme les appels depuis Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['username', 'password', 'X-Admin-Role'] // Permettre les headers custom
}));

app.use(express.json({ limit: '100mb' })); // Limite pour les images base64

// Routes
app.use('/api', shareRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/quizlet', quizletRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    name: 'Flashcard Share API',
    version: '1.0.0',
    endpoints: {
      share: 'POST /api/share',
      retrieve: 'GET /api/retrieve/:code',
      check: 'GET /api/check/:code',
      health: 'GET /health'
    }
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('[Server] Erreur:', err);
  res.status(err.status || 500).json({
    error: 'Erreur serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    // Tester la connexion à la base de données
    await db.query('SELECT NOW()');
    console.log('[DB] Connexion PostgreSQL établie');

    // Démarrer le cron de nettoyage
    startCleanupSchedule();

    // Démarrer le serveur HTTP
    app.listen(PORT, () => {
      console.log(`[Server] Backend démarré sur le port ${PORT}`);
      console.log(`[Server] Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] CORS autorisé pour: ${process.env.ALLOWED_ORIGIN || 'http://localhost:3000'}`);
    });

  } catch (error) {
    console.error('[Server] Erreur de démarrage:', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt gracieux
process.on('SIGTERM', async () => {
  console.log('[Server] Signal SIGTERM reçu, arrêt en cours...');
  await db.pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] Signal SIGINT reçu, arrêt en cours...');
  await db.pool.end();
  process.exit(0);
});

startServer();
