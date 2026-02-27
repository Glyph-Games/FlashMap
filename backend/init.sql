-- Script d'initialisation de la base de données pour le partage de flashcards

-- Créer la base de données (à exécuter en tant que superutilisateur)
-- CREATE DATABASE flashcard_share;

-- Se connecter à la base de données flashcard_share avant d'exécuter la suite

-- Supprimer la table si elle existe déjà (pour réinitialiser)
DROP TABLE IF EXISTS shared_lessons;

-- Créer la table des leçons partagées
CREATE TABLE shared_lessons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(5) UNIQUE NOT NULL,
  lesson_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_one_time BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  max_downloads INTEGER,

  -- Contraintes
  CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9]{5}$'),
  CONSTRAINT check_download_count CHECK (download_count >= 0),
  CONSTRAINT check_max_downloads CHECK (max_downloads IS NULL OR max_downloads > 0)
);

-- Index pour optimiser les recherches par code
CREATE INDEX idx_code ON shared_lessons(code);

-- Index pour optimiser le nettoyage des leçons expirées
CREATE INDEX idx_expires_at ON shared_lessons(expires_at) WHERE expires_at IS NOT NULL;

-- Afficher les informations de la table créée
\d shared_lessons

-- Exemples de requêtes utiles (commentées)

-- Voir toutes les leçons partagées
-- SELECT code, created_at, expires_at, is_one_time, download_count FROM shared_lessons;

-- Voir les leçons expirées
-- SELECT code, expires_at FROM shared_lessons WHERE expires_at < NOW();

-- Supprimer les leçons expirées manuellement
-- DELETE FROM shared_lessons WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- Statistiques
-- SELECT
--   COUNT(*) as total_lessons,
--   COUNT(*) FILTER (WHERE is_one_time = TRUE) as one_time_lessons,
--   COUNT(*) FILTER (WHERE expires_at IS NULL) as unlimited_lessons,
--   COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_lessons
-- FROM shared_lessons;

-- ============================================
-- Table des utilisateurs administrateurs
-- ============================================

DROP TABLE IF EXISTS admin_users;

CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,

  -- Contraintes
  CONSTRAINT check_username_format CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
  CONSTRAINT check_role CHECK (role IN ('admin', 'super_admin', 'viewer'))
);

-- Index pour optimiser les recherches par username
CREATE INDEX idx_username ON admin_users(username);

-- Afficher les informations de la table créée
\d admin_users

-- ============================================
-- Table des événements analytics
-- ============================================

DROP TABLE IF EXISTS analytics_events;

CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_composite ON analytics_events(event_type, created_at);

-- Afficher les informations de la table créée
\d analytics_events
