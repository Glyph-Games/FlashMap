const rateLimit = require('express-rate-limit');

// Rate limiter pour le partage de leçons
const shareLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // Maximum 10 partages par heure par IP
  message: {
    error: 'Trop de partages effectués. Veuillez réessayer dans une heure.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter pour la récupération de leçons
const retrieveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Maximum 30 récupérations par 15 minutes par IP
  message: {
    error: 'Trop de récupérations effectuées. Veuillez réessayer dans 15 minutes.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  shareLimiter,
  retrieveLimiter
};
