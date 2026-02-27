const db = require('../models/db');

// Caractères autorisés : majuscules et chiffres (sans caractères ambigus comme 0/O, 1/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Génère un code aléatoire de 5 caractères
 */
function generateRandomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/**
 * Génère un code unique (vérifie qu'il n'existe pas déjà en DB)
 * @returns {Promise<string>} Code unique à 5 caractères
 */
async function generateUniqueCode() {
  let code;
  let isUnique = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  while (!isUnique && attempts < MAX_ATTEMPTS) {
    code = generateRandomCode();

    // Vérifier si le code existe déjà
    const result = await db.query(
      'SELECT code FROM shared_lessons WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique) {
    throw new Error('Impossible de générer un code unique après plusieurs tentatives');
  }

  return code;
}

module.exports = {
  generateUniqueCode
};
