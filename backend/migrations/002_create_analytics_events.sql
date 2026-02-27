-- Migration: Création de la table analytics_events
-- Date: 2025-11-16

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

-- Vérification
SELECT
  'analytics_events table created successfully' as message,
  COUNT(*) as row_count
FROM analytics_events;
