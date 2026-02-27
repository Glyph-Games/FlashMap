const bcrypt = require('bcrypt');
const db = require('./models/db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Script de configuration du système d'authentification admin
 * - Crée la table admin_users si elle n'existe pas
 * - Ajoute l'utilisateur admin initial
 */

async function setupAdminSystem() {
  try {
    console.log('🚀 Configuration du système d\'authentification admin...\n');

    // 1. Créer la table admin_users
    console.log('📋 Création de la table admin_users...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '001_create_admin_users.sql'),
      'utf8'
    );

    await db.query(migrationSQL);
    console.log('✅ Table admin_users créée avec succès\n');

    // 2. Créer l'utilisateur admin initial
    console.log('👤 Création de l\'utilisateur admin initial...');

    const username = 'tomyfak';
    const password = 'admin123';
    const role = 'admin';

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  L'utilisateur "${username}" existe déjà`);
    } else {
      // Hasher le mot de passe
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insérer l'utilisateur
      const result = await db.query(
        `INSERT INTO admin_users (username, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, username, role, created_at`,
        [username, passwordHash, role]
      );

      const user = result.rows[0];
      console.log('✅ Utilisateur admin créé avec succès:');
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Créé le: ${user.created_at}\n`);
    }

    console.log('🎉 Configuration terminée avec succès!');
    console.log('\n📝 Informations de connexion:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);

    await db.pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    console.error(error);
    await db.pool.end();
    process.exit(1);
  }
}

setupAdminSystem();
