/**
 * FlashMap SDK — Mode Exemple : Quiz Chrono
 *
 * Un mode de jeu qui teste les connaissances avec un timer.
 * Le joueur doit répondre correctement à chaque carte avant la fin du temps.
 *
 * Installation : Entrez l'URL de ce fichier dans le Store de FlashMap.
 * Ex: https://votre-site.com/examples/quiz-timer.js
 */

(function () {
  'use strict';

  // Enregistrement du mode via le SDK
  FlashMap.registerMode({
    // === MÉTADONNÉES (obligatoires) ===
    id: 'quiz-timer',
    name: 'Quiz Chrono',
    description: 'Répondez aux questions avant la fin du temps !',
    version: '1.0.0',
    author: 'FlashMap Team',
    icon: '⏱️',
    color: '#EF4444', // rouge

    // === CYCLE DE VIE ===

    /**
     * onPlay — Appelé quand le joueur lance le mode.
     * C'est ici que vous construisez votre interface de jeu.
     *
     * @param {Object} ctx - Le contexte de jeu
     * @param {HTMLElement} ctx.container - Le conteneur DOM où rendre votre UI
     * @param {Array} ctx.cards - Les cartes de la leçon [{id, front, back, frontImage?, backImage?}]
     * @param {string} ctx.lessonName - Le nom de la leçon
     * @param {*} ctx.customData - Les données sauvegardées par onEdit (ou null)
     * @param {Function} ctx.onComplete - Appeler à la fin : onComplete({correct, incorrect, studied})
     * @param {Function} ctx.onExit - Appeler pour quitter le mode
     */
    onPlay({ container, cards, lessonName, customData, onComplete, onExit }) {
      // Configuration (peut venir de customData si onEdit est utilisé)
      const timePerCard = customData?.timePerCard || 15; // secondes par carte
      const shuffledCards = [...cards].sort(() => Math.random() - 0.5);

      let currentIndex = 0;
      let score = 0;
      let incorrect = 0;
      let timer = null;
      let timeLeft = timePerCard;

      // Construction de l'interface
      const render = () => {
        if (currentIndex >= shuffledCards.length) {
          // Fin du quiz
          clearInterval(timer);
          container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif;">
              <div style="font-size:48px;margin-bottom:16px;">🏆</div>
              <h2 style="font-size:24px;font-weight:700;color:#1F2937;margin-bottom:8px;">Quiz terminé !</h2>
              <p style="color:#6B7280;margin-bottom:24px;">${lessonName}</p>
              <div style="display:flex;gap:16px;justify-content:center;margin-bottom:32px;">
                <div style="background:#ECFDF5;border-radius:12px;padding:16px 24px;">
                  <div style="font-size:28px;font-weight:700;color:#059669;">${score}</div>
                  <div style="font-size:12px;color:#6B7280;">Correct</div>
                </div>
                <div style="background:#FEF2F2;border-radius:12px;padding:16px 24px;">
                  <div style="font-size:28px;font-weight:700;color:#DC2626;">${incorrect}</div>
                  <div style="font-size:12px;color:#6B7280;">Incorrect</div>
                </div>
              </div>
              <button id="qt-finish" style="padding:12px 32px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">
                Terminer
              </button>
            </div>
          `;
          container.querySelector('#qt-finish').addEventListener('click', () => {
            onComplete({ correct: score, incorrect, studied: shuffledCards.length });
          });
          return;
        }

        const card = shuffledCards[currentIndex];
        timeLeft = timePerCard;

        container.innerHTML = `
          <div style="padding:20px;font-family:system-ui,-apple-system,sans-serif;max-width:500px;margin:0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <span style="font-size:14px;color:#6B7280;">${currentIndex + 1} / ${shuffledCards.length}</span>
              <span id="qt-timer" style="font-size:18px;font-weight:700;color:#EF4444;">⏱️ ${timeLeft}s</span>
            </div>
            <div style="width:100%;height:6px;background:#F3F4F6;border-radius:3px;margin-bottom:24px;overflow:hidden;">
              <div id="qt-progress" style="width:100%;height:100%;background:#EF4444;border-radius:3px;transition:width 1s linear;"></div>
            </div>
            <div style="background:white;border-radius:16px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08);margin-bottom:20px;border:1px solid #E5E7EB;">
              <p style="font-size:13px;color:#9CA3AF;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Question</p>
              <p style="font-size:18px;font-weight:600;color:#1F2937;">${card.front}</p>
            </div>
            <input id="qt-input" type="text" placeholder="Votre réponse..." autocomplete="off"
              style="width:100%;padding:14px 16px;border:2px solid #E5E7EB;border-radius:12px;font-size:16px;outline:none;box-sizing:border-box;transition:border-color 0.2s;" />
            <button id="qt-submit" style="width:100%;margin-top:12px;padding:14px;background:linear-gradient(135deg,#EF4444,#DC2626);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:transform 0.1s;">
              Valider
            </button>
          </div>
        `;

        const input = container.querySelector('#qt-input');
        const timerEl = container.querySelector('#qt-timer');
        const progressEl = container.querySelector('#qt-progress');
        const submitBtn = container.querySelector('#qt-submit');

        input.focus();

        // Timer
        clearInterval(timer);
        timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `⏱️ ${timeLeft}s`;
          progressEl.style.width = `${(timeLeft / timePerCard) * 100}%`;
          if (timeLeft <= 5) timerEl.style.color = '#DC2626';
          if (timeLeft <= 0) {
            clearInterval(timer);
            incorrect++;
            showFeedback(false, card.back);
          }
        }, 1000);

        const checkAnswer = () => {
          clearInterval(timer);
          const answer = input.value.trim().toLowerCase();
          const correct = card.back.trim().toLowerCase();
          if (answer === correct) {
            score++;
            showFeedback(true, card.back);
          } else {
            incorrect++;
            showFeedback(false, card.back);
          }
        };

        submitBtn.addEventListener('click', checkAnswer);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') checkAnswer();
        });
        input.addEventListener('focus', () => { input.style.borderColor = '#6366F1'; });
        input.addEventListener('blur', () => { input.style.borderColor = '#E5E7EB'; });
      };

      const showFeedback = (isCorrect, correctAnswer) => {
        const bgColor = isCorrect ? '#ECFDF5' : '#FEF2F2';
        const textColor = isCorrect ? '#059669' : '#DC2626';
        const emoji = isCorrect ? '✅' : '❌';
        const message = isCorrect ? 'Correct !' : `La bonne réponse était : ${correctAnswer}`;

        container.innerHTML = `
          <div style="text-align:center;padding:60px 20px;font-family:system-ui,-apple-system,sans-serif;">
            <div style="width:80px;height:80px;background:${bgColor};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px;">${emoji}</div>
            <p style="font-size:18px;font-weight:600;color:${textColor};margin-bottom:24px;">${message}</p>
            <button id="qt-next" style="padding:12px 32px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">
              ${currentIndex + 1 < shuffledCards.length ? 'Suivant' : 'Voir les résultats'}
            </button>
          </div>
        `;
        container.querySelector('#qt-next').addEventListener('click', () => {
          currentIndex++;
          render();
        });
      };

      // Lancer le quiz
      render();
    },

    /**
     * onDestroy — Appelé quand le joueur quitte le mode.
     * Nettoyez vos timers, event listeners, etc.
     */
    onDestroy() {
      // Le timer est nettoyé dans le scope de onPlay via clearInterval
      // Rien de plus à faire ici dans cet exemple
    },

    /**
     * onEdit (optionnel) — Appelé quand l'utilisateur veut configurer le mode pour une leçon.
     * Permet de stocker des paramètres personnalisés par leçon.
     *
     * @param {Object} ctx - Le contexte d'édition
     * @param {HTMLElement} ctx.container - Le conteneur DOM
     * @param {Array} ctx.cards - Les cartes de la leçon
     * @param {string} ctx.lessonName - Le nom de la leçon
     * @param {Function} ctx.getData - Récupère les données sauvegardées pour ce mode/leçon
     * @param {Function} ctx.setData - Sauvegarde des données pour ce mode/leçon
     * @param {Function} ctx.onClose - Ferme la modal d'édition
     */
    onEdit({ container, cards, lessonName, getData, setData, onClose }) {
      const currentData = getData() || { timePerCard: 15 };

      container.innerHTML = `
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:8px;">
          <p style="font-size:14px;color:#6B7280;margin-bottom:16px;">
            Configurez le Quiz Chrono pour la leçon "${lessonName}" (${cards.length} cartes).
          </p>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px;">
              Temps par carte (secondes)
            </label>
            <input id="qte-time" type="number" min="5" max="120" value="${currentData.timePerCard}"
              style="width:100%;padding:10px 12px;border:2px solid #E5E7EB;border-radius:8px;font-size:16px;outline:none;box-sizing:border-box;" />
          </div>
          <div style="background:#F3F4F6;border-radius:8px;padding:12px;margin-bottom:16px;">
            <p style="font-size:13px;color:#6B7280;">
              ⏱️ Durée estimée du quiz : <strong id="qte-estimate">${(currentData.timePerCard * cards.length / 60).toFixed(1)} min</strong>
            </p>
          </div>
          <button id="qte-save" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">
            Sauvegarder
          </button>
        </div>
      `;

      const timeInput = container.querySelector('#qte-time');
      const estimate = container.querySelector('#qte-estimate');

      timeInput.addEventListener('input', () => {
        const val = parseInt(timeInput.value) || 15;
        estimate.textContent = `${(val * cards.length / 60).toFixed(1)} min`;
      });

      container.querySelector('#qte-save').addEventListener('click', () => {
        const timePerCard = Math.max(5, Math.min(120, parseInt(timeInput.value) || 15));
        setData({ timePerCard });
        onClose();
      });
    },
  });
})();
