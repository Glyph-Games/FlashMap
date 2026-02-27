# Guide d'Administration - Système d'Authentification

## Vue d'ensemble

Le système d'authentification admin utilise maintenant une base de données PostgreSQL pour stocker les utilisateurs et leurs mots de passe hashés avec bcrypt.

## Structure de la table admin_users

```sql
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);
```

### Rôles disponibles
- `admin` : Administrateur standard
- `super_admin` : Super administrateur (pour futures fonctionnalités)
- `viewer` : Lecture seule (pour futures fonctionnalités)

## Gestion des utilisateurs

### 1. Créer un nouvel utilisateur admin

```bash
node createAdminUser.js <username> <password> [role]
```

**Exemples :**
```bash
# Créer un admin standard
node createAdminUser.js john password123 admin

# Créer un super admin
node createAdminUser.js superuser securepass super_admin

# Créer un utilisateur en lecture seule
node createAdminUser.js viewer viewonly viewer
```

### 2. Première configuration (setup initial)

Si vous installez le système pour la première fois, exécutez :

```bash
node setupAdmin.js
```

Ce script :
- Crée la table `admin_users` dans la base de données
- Ajoute l'utilisateur admin par défaut (`tomyfak` / `admin123`)

### 3. Modifier un mot de passe via SQL

```sql
-- D'abord, hasher le nouveau mot de passe avec bcrypt
-- Puis exécuter :
UPDATE admin_users
SET password_hash = '$2b$10$...' -- Hash bcrypt du nouveau mot de passe
WHERE username = 'tomyfak';
```

**Note :** Pour hasher un mot de passe avec bcrypt, vous pouvez utiliser Node.js :

```javascript
const bcrypt = require('bcrypt');
bcrypt.hash('nouveau_mot_de_passe', 10, (err, hash) => {
  console.log(hash);
});
```

### 4. Lister tous les utilisateurs admin

```sql
SELECT id, username, role, created_at, last_login
FROM admin_users
ORDER BY created_at DESC;
```

### 5. Supprimer un utilisateur

```sql
DELETE FROM admin_users WHERE username = 'username_a_supprimer';
```

## Sécurité

### Bonnes pratiques
1. **Mots de passe forts** : Utilisez des mots de passe d'au moins 12 caractères avec lettres, chiffres et symboles
2. **Changement régulier** : Changez les mots de passe tous les 3-6 mois
3. **Pas de réutilisation** : N'utilisez jamais le même mot de passe sur plusieurs systèmes
4. **Stockage sécurisé** : Les mots de passe ne sont JAMAIS stockés en clair, uniquement hashés avec bcrypt

### Algorithme de hashage
- **Algorithme** : bcrypt
- **Salt rounds** : 10
- **Format du hash** : `$2b$10$...` (60 caractères)

## Fonctionnement de l'authentification

### Côté serveur (backend/routes/admin.js)
1. Réception des headers `username` et `password`
2. Recherche de l'utilisateur dans la base de données
3. Vérification du mot de passe avec `bcrypt.compare()`
4. Mise à jour de `last_login` si succès
5. Ajout des infos utilisateur dans `req.adminUser`

### Côté client (public/admin/index.html)
1. Formulaire de connexion envoie username + password
2. Appel API à `/admin/stats` pour vérifier les credentials
3. Si succès, stockage dans sessionStorage :
   - `adminAuth`: 'true'
   - `adminUsername`: nom d'utilisateur
   - `adminPassword`: mot de passe (pour futures requêtes API)
   - `lastLogin`: timestamp
4. Toutes les requêtes API suivantes incluent username et password dans les headers

## Fichiers impliqués

### Backend
- `backend/init.sql` : Schéma de la table admin_users
- `backend/migrations/001_create_admin_users.sql` : Migration de création de table
- `backend/routes/admin.js` : Middleware d'authentification et routes admin
- `backend/createAdminUser.js` : Script pour créer un utilisateur
- `backend/setupAdmin.js` : Script de configuration initiale

### Frontend
- `public/admin/index.html` : Interface d'administration avec login

## Dépannage

### Problème : "Identifiants invalides" malgré les bons credentials
- Vérifier que la table `admin_users` existe : `\dt admin_users` dans psql
- Vérifier les utilisateurs : `SELECT * FROM admin_users;`
- Vérifier la connexion à la base de données dans `.env`

### Problème : "Erreur de connexion au serveur"
- Vérifier que le backend est démarré : `npm start`
- Vérifier la configuration CORS dans `server.js`
- Vérifier l'URL de l'API dans `public/admin/index.html` (API_URL)

### Problème : Utilisateur existant lors du setup
- C'est normal si vous avez déjà exécuté le setup
- Pour réinitialiser : `DROP TABLE admin_users;` puis relancer `node setupAdmin.js`

## Migration depuis l'ancien système

L'ancien système utilisait un objet JavaScript hardcodé `AUTHORIZED_USERS` dans le fichier HTML. Ce système a été complètement remplacé par l'authentification base de données.

### Changements principaux :
1. ✅ Suppression de `AUTHORIZED_USERS` du code
2. ✅ Login via API au lieu de vérification locale
3. ✅ Stockage des credentials dans sessionStorage
4. ✅ Vérification des credentials à chaque requête API
5. ✅ Déconnexion automatique si 401 (non autorisé)

## Évolutions futures possibles

1. **JWT Tokens** : Remplacer l'envoi du mot de passe à chaque requête par des tokens JWT
2. **Sessions** : Utiliser des sessions Express avec Redis
3. **2FA** : Ajouter l'authentification à deux facteurs
4. **Gestion des rôles** : Implémenter les permissions selon les rôles
5. **Historique** : Logger toutes les actions admin
6. **Mot de passe oublié** : Système de réinitialisation par email
