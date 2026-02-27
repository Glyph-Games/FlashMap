# API Documentation - Flashcard Share Backend

## Vue d'ensemble

Cette API permet de partager temporairement des leçons de flashcards entre utilisateurs via un système de codes à 5 caractères.

**Base URL:** `http://localhost:3001` (développement)

**Version:** 1.0.0

---

## Authentification

Aucune authentification n'est requise pour cette API.

---

## Rate Limiting

Des limites de taux sont appliquées pour prévenir les abus :

- **Partage de leçons** : 10 requêtes par heure par IP
- **Récupération de leçons** : 30 requêtes par 15 minutes par IP

Les en-têtes de réponse incluent :
- `X-RateLimit-Limit` : Limite maximale
- `X-RateLimit-Remaining` : Nombre de requêtes restantes
- `X-RateLimit-Reset` : Timestamp de réinitialisation

---

## Endpoints

### 1. Partager une leçon

Partage une leçon et génère un code unique de 5 caractères.

**Endpoint:** `POST /api/share`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "lesson": {
    "name": "Vocabulaire Anglais",
    "cards": [
      {
        "id": 1,
        "front": "Hello",
        "back": "Bonjour",
        "frontImage": "data:image/png;base64,...",
        "backImage": null,
        "nextReview": 1699000000000,
        "interval": 1,
        "easeFactor": 2.5
      }
    ],
    "stats": {
      "studied": 10,
      "correct": 8,
      "incorrect": 2
    }
  },
  "duration": "24h",
  "oneTime": false
}
```

**Paramètres:**

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| lesson | Object | Oui | Objet contenant la leçon complète |
| lesson.name | String | Oui | Nom de la leçon |
| lesson.cards | Array | Oui | Tableau de cartes |
| lesson.stats | Object | Non | Statistiques de la leçon |
| duration | String | Oui | Durée de validité : `1h`, `5h`, `24h`, `7d`, `unlimited` |
| oneTime | Boolean | Non | Si `true`, le code sera supprimé après une seule récupération (défaut: `false`) |

**Réponse (201 Created):**
```json
{
  "success": true,
  "code": "A3K9M",
  "expiresAt": "2025-11-04T10:00:00.000Z",
  "oneTime": false
}
```

**Erreurs possibles:**

| Code | Message | Description |
|------|---------|-------------|
| 400 | Données de leçon invalides | Structure JSON incorrecte |
| 400 | Durée invalide | Durée non supportée |
| 413 | Leçon trop volumineuse | Taille > 20 MB |
| 429 | Trop de partages effectués | Rate limit dépassé |
| 500 | Erreur serveur | Erreur interne |

---

### 2. Récupérer une leçon

Récupère une leçon partagée via son code unique.

**Endpoint:** `GET /api/retrieve/:code`

**Paramètres URL:**

| Paramètre | Type | Description |
|-----------|------|-------------|
| code | String | Code à 5 caractères (ex: `A3K9M`) |

**Exemple de requête:**
```
GET /api/retrieve/A3K9M
```

**Réponse (200 OK):**
```json
{
  "success": true,
  "lesson": {
    "name": "Vocabulaire Anglais",
    "cards": [...],
    "stats": {...}
  },
  "expiresAt": "2025-11-04T10:00:00.000Z",
  "remainingUses": null
}
```

**Champs de réponse:**

| Champ | Type | Description |
|-------|------|-------------|
| success | Boolean | Toujours `true` en cas de succès |
| lesson | Object | Données complètes de la leçon |
| expiresAt | String/null | Date d'expiration (ISO 8601) ou `null` si illimité |
| remainingUses | Number/null | Nombre d'utilisations restantes ou `null` si illimité |

**Erreurs possibles:**

| Code | Message | Description |
|------|---------|-------------|
| 400 | Format de code invalide | Le code ne respecte pas le format (5 caractères alphanumériques) |
| 404 | Code introuvable | Le code n'existe pas dans la base de données |
| 410 | Code expiré | La leçon a dépassé sa date d'expiration |
| 410 | Code consommé | Le partage à usage unique a déjà été utilisé |
| 429 | Trop de récupérations effectuées | Rate limit dépassé |
| 500 | Erreur serveur | Erreur interne |

**Note importante:**
- Le compteur de téléchargements est incrémenté à chaque récupération
- Si `oneTime: true`, la leçon est automatiquement supprimée après récupération
- Les codes sont insensibles à la casse (convertis en majuscules)

---

### 3. Vérifier un code

Vérifie l'existence et la validité d'un code sans le consommer.

**Endpoint:** `GET /api/check/:code`

**Paramètres URL:**

| Paramètre | Type | Description |
|-----------|------|-------------|
| code | String | Code à 5 caractères (ex: `A3K9M`) |

**Exemple de requête:**
```
GET /api/check/A3K9M
```

**Réponse (200 OK):**
```json
{
  "exists": true,
  "expiresAt": "2025-11-04T10:00:00.000Z",
  "isOneTime": false,
  "remainingUses": null
}
```

**Champs de réponse:**

| Champ | Type | Description |
|-------|------|-------------|
| exists | Boolean | `true` si le code existe et est valide |
| expiresAt | String/null | Date d'expiration ou `null` si illimité |
| isOneTime | Boolean | `true` si c'est un partage à usage unique |
| remainingUses | Number/null | Utilisations restantes ou `null` si illimité |

**Réponse (404 Not Found):**
```json
{
  "exists": false
}
```

**Réponse (410 Gone - Code expiré):**
```json
{
  "exists": false,
  "expired": true
}
```

**Réponse (410 Gone - Code consommé):**
```json
{
  "exists": false,
  "consumed": true
}
```

---

### 4. Health Check

Vérifie que le serveur est opérationnel.

**Endpoint:** `GET /health`

**Réponse (200 OK):**
```json
{
  "status": "OK",
  "timestamp": "2025-11-03T12:00:00.000Z",
  "uptime": 3600.5
}
```

---

### 5. Informations de l'API

Retourne les informations sur l'API et ses endpoints.

**Endpoint:** `GET /`

**Réponse (200 OK):**
```json
{
  "name": "Flashcard Share API",
  "version": "1.0.0",
  "endpoints": {
    "share": "POST /api/share",
    "retrieve": "GET /api/retrieve/:code",
    "check": "GET /api/check/:code",
    "health": "GET /health"
  }
}
```

---

## Codes d'erreur HTTP

| Code | Signification |
|------|---------------|
| 200 | OK - Requête réussie |
| 201 | Created - Ressource créée avec succès |
| 400 | Bad Request - Requête invalide |
| 404 | Not Found - Ressource non trouvée |
| 410 | Gone - Ressource supprimée ou expirée |
| 413 | Payload Too Large - Données trop volumineuses |
| 429 | Too Many Requests - Rate limit dépassé |
| 500 | Internal Server Error - Erreur serveur |

---

## Exemples d'utilisation

### Partager une leçon (cURL)

```bash
curl -X POST http://localhost:3001/api/share \
  -H "Content-Type: application/json" \
  -d '{
    "lesson": {
      "name": "Test Lesson",
      "cards": [
        {
          "id": 1,
          "front": "Question",
          "back": "Réponse"
        }
      ]
    },
    "duration": "24h",
    "oneTime": false
  }'
```

### Récupérer une leçon (cURL)

```bash
curl http://localhost:3001/api/retrieve/A3K9M
```

### Vérifier un code (cURL)

```bash
curl http://localhost:3001/api/check/A3K9M
```

### JavaScript (Fetch API)

```javascript
// Partager une leçon
const shareLesson = async (lesson, duration, oneTime) => {
  const response = await fetch('http://localhost:3001/api/share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lesson, duration, oneTime })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Récupérer une leçon
const retrieveLesson = async (code) => {
  const response = await fetch(`http://localhost:3001/api/retrieve/${code}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Vérifier un code
const checkCode = async (code) => {
  const response = await fetch(`http://localhost:3001/api/check/${code}`);
  return await response.json();
};
```

---

## Durées disponibles

| Valeur | Description |
|--------|-------------|
| `1h` | Expire après 1 heure |
| `5h` | Expire après 5 heures |
| `24h` | Expire après 24 heures |
| `7d` | Expire après 7 jours |
| `unlimited` | Pas de date d'expiration |

---

## Nettoyage automatique

Un cron job s'exécute **toutes les heures** pour supprimer automatiquement :
- Les leçons expirées (`expires_at < NOW()`)
- Les partages à usage unique déjà consommés

---

## Limitations

- **Taille maximale par leçon** : 20 MB
- **Format de code** : Exactement 5 caractères alphanumériques (A-Z, 0-9)
- **Caractères exclus** : 0, O, 1, I (pour éviter la confusion)
- **Nombre total de combinaisons** : ~60 millions de codes possibles

---

## Notes techniques

### Format des images

Les images sont stockées en **base64** dans le JSON. Exemple :
```json
{
  "frontImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA..."
}
```

### Structure complète d'une carte

```json
{
  "id": 1,
  "front": "Question text",
  "back": "Answer text",
  "frontImage": "data:image/png;base64,...",
  "backImage": "data:image/png;base64,...",
  "nextReview": 1699000000000,
  "interval": 1,
  "easeFactor": 2.5
}
```

### Base de données

- **Type** : PostgreSQL
- **Table** : `shared_lessons`
- **Index** : Sur `code` et `expires_at`

---

## Variables d'environnement

Créer un fichier `.env` à la racine du backend :

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flashcard_share
DB_USER=postgres
DB_PASSWORD=your_password

PORT=3001
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:3000
```

---

## Installation et démarrage

### Prérequis
- Node.js >= 16
- PostgreSQL >= 12

### Installation

```bash
cd backend
npm install
```

### Initialisation de la base de données

```bash
psql -U postgres -f init.sql
```

### Démarrage

```bash
# Développement (avec auto-reload)
npm run dev

# Production
npm start
```

---

## Support

Pour toute question ou problème, créer une issue sur le dépôt GitHub du projet.

---

**Dernière mise à jour :** 2025-11-03
