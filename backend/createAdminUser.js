const bcrypt = require('bcrypt');
const db = require('./models/db');
require('dotenv').config();

/**
 * Script pour créer un utilisateur administrateur
 * Usage: node createAdminUser.js <username> <password> [role]
 */

async function createAdminUser(username, password, role = 'admin') {
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      console.log(`❌ L'utilisateur "${username}" existe déjà`);
      process.exit(1);
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insérer l'utilisateur dans la base de données
    const result = await db.query(
      `INSERT INTO admin_users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, created_at`,
      [username, passwordHash, role]
    );

    const user = result.rows[0];
    console.log('✅ Utilisateur créé avec succès:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Créé le: ${user.created_at}`);

    await db.pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur:', error.message);
    await db.pool.end();
    process.exit(1);
  }
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node createAdminUser.js <username> <password> [role]');
  console.log('Roles disponibles: admin, super_admin, viewer');
  console.log('Exemple: node createAdminUser.js tomyfak admin123 admin');
  process.exit(1);
}

const [username, password, role] = args;

createAdminUser(username, password, role);
