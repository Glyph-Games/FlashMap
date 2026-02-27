# Flashcard Share Backend

Backend Node.js/Express pour le partage temporaire de leçons de flashcards.

## Fonctionnalités

- 📤 **Partage de leçons** : Générez un code unique à 5 caractères pour partager une leçon
- ⏰ **Durées flexibles** : 1h, 5h, 24h, 7 jours ou illimité
- 🔒 **Partage à usage unique** : Option pour supprimer automatiquement après récupération
- 🧹 **Nettoyage automatique** : Suppression automatique des leçons expirées toutes les heures
- 🛡️ **Rate limiting** : Protection contre les abus
- 📊 **Support des images** : Stockage des images en base64

## Stack technique

- **Framework** : Express.js
- **Base de données** : PostgreSQL
- **Cron jobs** : node-cron
- **Rate limiting** : express-rate-limit

## Structure du projet

```
backend/
├── server.js              # Point d'entrée du serveur
├── routes/
│   └── share.js          # Routes API pour le partage
├── models/
│   └── db.js             # Connexion PostgreSQL
├── utils/
│   ├── codeGenerator.js  # Génération de codes uniques
│   └── cleanup.js        # Nettoyage automatique
├── middleware/
│   └── rateLimit.js      # Configuration du rate limiting
├── init.sql              # Script d'initialisation de la DB
├── .env.example          # Exemple de configuration
└── package.json          # Dépendances npm
```

## Installation

### Prérequis

- **Node.js** >= 16.x
- **PostgreSQL** >= 12.x
- **npm** ou **yarn**

### Étapes

1. **Installer les dépendances** :
   ```bash
   cd backend
   npm install
   ```

2. **Configurer PostgreSQL** :
   ```bash
   # Se connecter à PostgreSQL
   psql -U postgres

   # Créer la base de données
   CREATE DATABASE flashcard_share;

   # Quitter psql
   \q

   # Initialiser les tables
   psql -U postgres -d flashcard_share -f init.sql
   ```

3. **Configurer les variables d'environnement** :
   ```bash
   cp .env.example .env
   ```

   Puis éditer `.env` avec vos paramètres :
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=flashcard_share
   DB_USER=postgres
   DB_PASSWORD=votre_mot_de_passe

   PORT=3001
   NODE_ENV=development
   ALLOWED_ORIGIN=http://localhost:3000
   ```

4. **Démarrer le serveur** :
   ```bash
   # Mode développement (auto-reload)
   npm run dev

   # Mode production
   npm start
   ```

Le serveur démarre sur `http://localhost:3001`

## API Endpoints

### 1. Partager une leçon
```http
POST /api/share
Content-Type: application/json

{
  "lesson": { ... },
  "duration": "24h",
  "oneTime": false
}
```

**Réponse :**
```json
{
  "success": true,
  "code": "A3K9M",
  "expiresAt": "2025-11-04T10:00:00Z"
}
```

### 2. Récupérer une leçon
```http
GET /api/retrieve/:code
```

**Réponse :**
```json
{
  "success": true,
  "lesson": { ... },
  "expiresAt": "2025-11-04T10:00:00Z",
  "remainingUses": null
}
```

### 3. Vérifier un code
```http
GET /api/check/:code
```

**Réponse :**
```json
{
  "exists": true,
  "expiresAt": "2025-11-04T10:00:00Z",
  "isOneTime": false,
  "remainingUses": null
}
```

### 4. Health check
```http
GET /health
```

📖 **Documentation complète** : Voir [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## Déploiement sur VPS

### Option 1 : PM2 (Recommandé)

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer l'application
pm2 start server.js --name flashcard-backend

# Configurer le démarrage automatique
pm2 startup
pm2 save

# Surveiller les logs
pm2 logs flashcard-backend
```

### Option 2 : Systemd

Créer `/etc/systemd/system/flashcard-backend.service` :

```ini
[Unit]
Description=Flashcard Share Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Puis :
```bash
sudo systemctl enable flashcard-backend
sudo systemctl start flashcard-backend
sudo systemctl status flashcard-backend
```

### Configuration Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name api.votredomaine.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Maintenance

### Voir les statistiques

```sql
-- Connexion à PostgreSQL
psql -U postgres -d flashcard_share

-- Statistiques générales
SELECT
  COUNT(*) as total_lessons,
  COUNT(*) FILTER (WHERE is_one_time = TRUE) as one_time_lessons,
  COUNT(*) FILTER (WHERE expires_at IS NULL) as unlimited_lessons,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_lessons
FROM shared_lessons;

-- Voir toutes les leçons
SELECT code, created_at, expires_at, download_count, is_one_time
FROM shared_lessons
ORDER BY created_at DESC;
```

### Nettoyer manuellement les leçons expirées

```sql
DELETE FROM shared_lessons
WHERE expires_at IS NOT NULL AND expires_at < NOW();
```

### Sauvegarder la base de données

```bash
# Backup
pg_dump -U postgres flashcard_share > backup_$(date +%Y%m%d).sql

# Restaurer
psql -U postgres -d flashcard_share < backup_20251103.sql
```

## Monitoring

### Logs

```bash
# Avec PM2
pm2 logs flashcard-backend

# Avec systemd
journalctl -u flashcard-backend -f
```

### Métriques

Le serveur expose un endpoint `/health` pour le monitoring :

```bash
curl http://localhost:3001/health
```

## Sécurité

- ✅ Rate limiting activé (10 partages/h, 30 récupérations/15min)
- ✅ Validation des données d'entrée
- ✅ Limite de taille (20 MB max)
- ✅ CORS configuré
- ✅ Codes générés aléatoirement avec vérification d'unicité
- ⚠️ Utiliser HTTPS en production (Let's Encrypt + Nginx)
- ⚠️ Configurer un firewall (UFW recommandé)

## Troubleshooting

### Erreur de connexion PostgreSQL

```bash
# Vérifier que PostgreSQL est démarré
sudo systemctl status postgresql

# Vérifier les paramètres de connexion dans .env
cat .env

# Tester la connexion manuellement
psql -U postgres -d flashcard_share
```

### Port 3001 déjà utilisé

Modifier le port dans `.env` :
```env
PORT=3002
```

### Rate limit trop restrictif

Modifier dans `middleware/rateLimit.js` :
```javascript
const shareLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20, // Augmenter la limite
  // ...
});
```

## Développement

### Tests

```bash
# Installer les dépendances de dev
npm install --save-dev jest supertest

# Lancer les tests (à implémenter)
npm test
```

### Debug

```bash
# Activer les logs détaillés
NODE_ENV=development npm run dev
```

## Roadmap

- [ ] Tests unitaires et d'intégration
- [ ] Métriques Prometheus
- [ ] Support de Redis pour le rate limiting distribué
- [ ] Migration vers TypeScript
- [ ] Docker / Docker Compose
- [ ] CI/CD avec GitHub Actions

## Licence

MIT

## Support

Pour toute question, ouvrir une issue sur GitHub.

---

**Auteur** : Votre Nom
**Version** : 1.0.0
**Dernière mise à jour** : 2025-11-03
