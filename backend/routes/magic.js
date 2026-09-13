const express = require('express');
const https = require('https');
const router = express.Router();

// Modèle Gemini utilisé pour les Magic Lessons (modifiable via GEMINI_MODEL dans .env)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

/**
 * Construit le prompt envoyé à Gemini
 * ⚠️ Garder synchronisé avec generateMagicLesson dans src/App.js (utilisé quand l'utilisateur a sa propre clé)
 */
function buildPrompt(instructions) {
  return `Analyse ce document et génère le MAXIMUM de flashcards possible pour apprendre son contenu de manière exhaustive.${instructions ? `\n\nInstructions spécifiques de l'utilisateur : ${instructions}` : ''}

IMPORTANT: Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, dans ce format exact:
[
  {"question": "Question 1", "answer": "Réponse 1", "wrongAnswers": ["Faux choix 1", "Faux choix 2", "Faux choix 3"]},
  {"question": "Question 2", "answer": "Réponse 2", "wrongAnswers": ["Faux choix 1", "Faux choix 2", "Faux choix 3"]}
]

Règles STRICTES:
- Génère AU MOINS 20 flashcards, et jusqu'à 50 si le document le permet
- Couvre TOUS les concepts, détails, définitions, dates, noms, chiffres importants
- Questions claires, précises et directes (sans fioriture)
- Réponses ULTRA-COURTES : 1 à 5 mots maximum, ou une phrase très courte (max 10 mots)
- Élimine tout mot superflu : pas de "c'est", "il s'agit de", "on peut dire que"
- Réponds de façon directe et factuelle uniquement
- Questions variées : définitions, dates, personnes, formules, concepts clés, relations cause-effet
- Pour chaque carte, génère EXACTEMENT 3 faux choix (wrongAnswers) qui sont plausibles mais incorrects
- Les faux choix doivent être du même type/format que la bonne réponse (même longueur approximative, même catégorie)
- Les faux choix doivent être crédibles pour rendre le QCM challengeant
- Retourne UNIQUEMENT le JSON, rien d'autre

Exemples de réponses COURTES (à suivre) :
❌ MAUVAIS : "Il s'agit de la capitale de la France qui est située au nord du pays"
✅ BON : "Paris" avec wrongAnswers: ["Lyon", "Marseille", "Bordeaux"]

❌ MAUVAIS : "C'est le processus par lequel les plantes convertissent la lumière en énergie"
✅ BON : "Photosynthèse" avec wrongAnswers: ["Respiration", "Fermentation", "Osmose"]

❌ MAUVAIS : "On peut dire que c'est environ 9,81 mètres par seconde au carré"
✅ BON : "9,81 m/s²" avec wrongAnswers: ["6,67 m/s²", "3,14 m/s²", "1,62 m/s²"]`;
}

/**
 * Envoie une requête POST JSON à l'API Gemini, en IPv4 uniquement
 * (Google refuse l'IPv6 du serveur : "User location is not supported for the API use")
 * @returns {Promise<{ ok: boolean, status: number, json: object }>}
 */
function postToGemini(path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const request = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path,
      method: 'POST',
      family: 4,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-goog-api-key': apiKey
      }
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            json: JSON.parse(raw)
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.end(payload);
  });
}

/**
 * POST /api/magic/generate
 * Génère des flashcards depuis un document via Gemini, avec la clé API du serveur
 * (la clé ne transite jamais par le navigateur de l'utilisateur)
 * Body: { instructions?: string, mimeType: string, data: string (base64) }
 * Réponse : uniquement le texte généré, dans la même structure que la réponse Gemini
 * (lue telle quelle par le frontend). Les erreurs Gemini ne sont jamais renvoyées telles quelles :
 * leur message peut contenir la clé API.
 */
router.post('/generate', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: {
        code: 503,
        status: 'NOT_CONFIGURED',
        message: 'Magic Lessons non configurées sur ce serveur (GEMINI_API_KEY manquante)'
      }
    });
  }

  try {
    const { instructions, mimeType, data } = req.body;

    // Validation des données
    if (typeof mimeType !== 'string' || !mimeType || typeof data !== 'string' || !data) {
      return res.status(400).json({
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'mimeType et data (fichier en base64) sont requis'
        }
      });
    }

    const prompt = buildPrompt(typeof instructions === 'string' ? instructions.trim() : '');

    const response = await postToGemini(`/v1beta/models/${GEMINI_MODEL}:generateContent`, apiKey, {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data
            }
          }
        ]
      }]
    });

    const result = response.json;

    if (!response.ok) {
      // Détail uniquement dans les logs serveur : le message Gemini peut contenir la clé API
      console.error('[Magic] Erreur Gemini:', response.status, result.error?.status, result.error?.message);
      return res.status(response.status).json({
        error: {
          code: response.status,
          status: result.error?.status || 'UNKNOWN',
          message: 'Erreur de l\'API Gemini'
        }
      });
    }

    // Les modèles Gemini 3 peuvent découper la réponse en plusieurs parts (dont des pensées) : on garde le texte final
    const parts = result.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(part => typeof part.text === 'string' && !part.thought).map(part => part.text).join('');

    if (!text) {
      console.error('[Magic] Réponse Gemini sans texte:', result.candidates?.[0]?.finishReason);
      return res.status(502).json({
        error: {
          code: 502,
          status: 'EMPTY_RESPONSE',
          message: 'Gemini n\'a renvoyé aucun texte'
        }
      });
    }

    res.status(200).json({ candidates: [{ content: { parts: [{ text }] } }] });

  } catch (error) {
    console.error('[Magic] Erreur:', error);
    res.status(500).json({
      error: {
        code: 500,
        status: 'INTERNAL',
        message: 'Erreur lors de la génération de la Magic Lesson'
      }
    });
  }
});

module.exports = router;
