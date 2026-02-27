-- Migration: Création de la table admin_users
-- Date: 2025-11-15

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
