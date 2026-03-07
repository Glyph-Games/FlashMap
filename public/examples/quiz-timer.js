/**
 * FlashMap SDK — Mode Exemple : Quiz Chrono
 *
 * Un mode de jeu qui teste les connaissances avec un timer.
 * Le joueur doit répondre correctement à chaque carte avant la fin du temps.
 *
 * Supporte l'algorithme SM-2 : la rapidité de réponse détermine la qualité
 * de mémorisation et influence les prochaines dates de révision.
 *
 * Installation : Entrez l'URL de ce fichier dans le Store de FlashMap.
 * Ex: https://votre-site.com/examples/quiz-timer.js
 */

(function () {
  'use strict';

  // Helper : génère un SVG Lucide inline
  const svgIcon = (name, { size = 24, color = 'currentColor', strokeWidth = 2 } = {}) => {
    const icons = {
      trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>`,
      timer: `<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>`,
      'check-circle': `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
      'x-circle': `<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`,
      brain: `<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>`,
      'calendar-check': `<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/>`,
    };
    const paths = icons[name] || '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  };

  // Helper : formate un timestamp en texte lisible "dans X jours"
  const formatNextReview = (nextReview) => {
    const diffMs = nextReview - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'demain';
    if (diffDays === 1) return 'dans 1 jour';
    return `dans ${diffDays} jours`;
  };

  // Enregistrement du mode via le SDK
  FlashMap.registerMode({
    // === MÉTADONNÉES (obligatoires) ===
    id: 'quiz-timer',
    name: 'Quiz Chrono',
    description: 'Répondez aux questions avant la fin du temps !',
    version: '2.0.0',
    author: 'FlashMap Team',
    icon: 'alarm-clock',
    color: '#EF4444', // rouge

    // === CYCLE DE VIE ===

    /**
     * onPlay — Appelé quand le joueur lance le mode.
     *
     * @param {Object} ctx
     * @param {HTMLElement} ctx.container     - Zone de rendu DOM
     * @param {Array}       ctx.cards         - Toutes les cartes (avec champs SM-2)
     * @param {Array}       ctx.dueCards      - Cartes dues pour révision SM-2 (peut être vide)
     * @param {string}      ctx.lessonName    - Nom de la leçon
     * @param {*}           ctx.customData    - Données de onEdit (ou null)
     * @param {Function}    ctx.onCardResult  - (cardId, quality 1-5) → met à jour SM-2
     * @param {Function}    ctx.onComplete    - ({correct, incorrect, studied}) → fin de partie
     * @param {Function}    ctx.onExit        - Quitter le mode
     */
    onPlay({ container, cards, dueCards, lessonName, customData, onCardResult, onComplete, onExit }) {
      const timePerCard = customData?.timePerCard || 15;
      const sm2Mode = customData?.sm2Mode !== false; // SM-2 activé par défaut

      let score = 0;          // cartes réussies du premier coup
      let incorrectCount = 0; // cartes ayant eu au moins un mauvais essai
      const incorrectIds = new Set(); // pour ne compter chaque carte qu'une fois
      let timer = null;
      let timeLeft = timePerCard;

      // === Sélection de la file de cartes ===
      // En mode SM-2 : on utilise les cartes dues. Si rien à réviser, on le signale.
      // En mode libre : on mélange toutes les cartes.
      let queue;
      if (sm2Mode) {
        if (dueCards.length === 0) {
          // Rien à réviser aujourd'hui
          container.innerHTML = `
            <div style="text-align:center;padding:48px 20px;font-family:system-ui,-apple-system,sans-serif;">
              <div style="width:80px;height:80px;background:#ECFDF5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                ${svgIcon('calendar-check', { size: 40, color: '#059669' })}
              </div>
              <h2 style="font-size:22px;font-weight:700;color:#1F2937;margin-bottom:8px;">Tout est à jour !</h2>
              <p style="color:#6B7280;margin-bottom:6px;">Aucune carte à réviser aujourd'hui pour</p>
              <p style="color:#374151;font-weight:600;margin-bottom:28px;">${lessonName}</p>
              <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                <button id="qt-free" style="padding:10px 20px;background:#F3F4F6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
                  Entraînement libre
                </button>
                <button id="qt-exit" style="padding:10px 20px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
                  Retour
                </button>
              </div>
            </div>
          `;
          container.querySelector('#qt-exit').addEventListener('click', onExit);
          container.querySelector('#qt-free').addEventListener('click', () => {
            // Relancer en mode libre
            queue = [...cards].sort(() => Math.random() - 0.5);
            render();
          });
          return;
        }
        queue = [...dueCards]; // file SM-2 : cartes dues triées par ancienneté
      } else {
        queue = [...cards].sort(() => Math.random() - 0.5); // mode libre : ordre aléatoire
      }

      const totalCards = queue.length;

      // === Helper : contenu HTML de la zone "Question" (texte + image) ===
      const questionHTML = (card) => {
        const hasText = card.front && card.front.trim();
        const hasImg = !!card.frontImage;
        return `
          ${hasImg ? `<img src="${card.frontImage}" alt="Question"
            style="display:block;margin:0 auto;max-width:100%;max-height:220px;object-fit:contain;border-radius:8px;${hasText ? 'margin-bottom:12px;' : ''}" />` : ''}
          ${hasText ? `<p style="font-size:18px;font-weight:600;color:#1F2937;margin:0;">${card.front}</p>` : ''}
        `;
      };

      // === Rendu de la question courante ===
      const render = () => {
        if (queue.length === 0) {
          // Fin du quiz
          clearInterval(timer);
          container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif;">
              <div style="width:80px;height:80px;background:#FEF3C7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                ${svgIcon('trophy', { size: 40, color: '#D97706' })}
              </div>
              <h2 style="font-size:24px;font-weight:700;color:#1F2937;margin-bottom:8px;">Quiz terminé !</h2>
              <p style="color:#6B7280;margin-bottom:24px;">${lessonName}</p>
              <div style="display:flex;gap:16px;justify-content:center;margin-bottom:${sm2Mode ? '16px' : '32px'};">
                <div style="background:#ECFDF5;border-radius:12px;padding:16px 24px;">
                  <div style="font-size:28px;font-weight:700;color:#059669;">${score}</div>
                  <div style="font-size:12px;color:#6B7280;">Correct</div>
                </div>
                <div style="background:#FEF2F2;border-radius:12px;padding:16px 24px;">
                  <div style="font-size:28px;font-weight:700;color:#DC2626;">${incorrectCount}</div>
                  <div style="font-size:12px;color:#6B7280;">Incorrect</div>
                </div>
              </div>
              ${sm2Mode ? `
                <div style="display:inline-flex;align-items:center;gap:6px;background:#EFF6FF;border-radius:8px;padding:8px 14px;margin-bottom:24px;font-size:13px;color:#3B82F6;">
                  ${svgIcon('brain', { size: 14, color: '#3B82F6' })}
                  Intervalles SM-2 mis à jour
                </div>
              ` : ''}
              <br/>
              <button id="qt-finish" style="padding:12px 32px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">
                Terminer
              </button>
            </div>
          `;
          container.querySelector('#qt-finish').addEventListener('click', () => {
            onComplete({ correct: score, incorrect: incorrectCount, studied: score + incorrectCount }); // score + incorrectCount = totalCards
          });
          return;
        }

        const card = queue[0];
        timeLeft = timePerCard;

        // Cartes dont la réponse est une image sans texte → grille de sélection d'images
        const isImageOnlyAnswer = !card.back.trim() && !!card.backImage;

        // Préparer les options de la grille (uniquement si image-only)
        let imageOptions = [];
        if (isImageOnlyAnswer) {
          const distractors = cards
            .filter(c => c.id !== card.id && c.backImage)
            .sort(() => Math.random() - 0.5)
            .slice(0, 11); // jusqu'à 11 distracteurs → max 12 options au total
          imageOptions = [
            { cardId: card.id, src: card.backImage, isCorrect: true },
            ...distractors.map(c => ({ cardId: c.id, src: c.backImage, isCorrect: false })),
          ].sort(() => Math.random() - 0.5);
        }

        container.innerHTML = `
          <div style="padding:20px;font-family:system-ui,-apple-system,sans-serif;max-width:500px;margin:0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:14px;color:#6B7280;">${totalCards - queue.length + 1} / ${totalCards}</span>
              ${sm2Mode ? `
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#6366F1;background:#EEF2FF;padding:3px 8px;border-radius:6px;">
                  ${svgIcon('brain', { size: 12, color: '#6366F1' })} Révision SM-2
                </span>
              ` : ''}
              <span id="qt-timer" style="font-size:18px;font-weight:700;color:#EF4444;display:inline-flex;align-items:center;gap:4px;">
                ${svgIcon('timer', { size: 18, color: 'currentColor' })}
                <span id="qt-timer-count">${timeLeft}s</span>
              </span>
            </div>
            <div style="width:100%;height:6px;background:#F3F4F6;border-radius:3px;margin-bottom:16px;overflow:hidden;">
              <div id="qt-progress" style="width:100%;height:100%;background:#EF4444;border-radius:3px;transition:width 1s linear;"></div>
            </div>

            <!-- Zone question : image + texte -->
            <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 4px 12px rgba(0,0,0,0.08);margin-bottom:16px;border:1px solid #E5E7EB;">
              <p style="font-size:13px;color:#9CA3AF;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;">Question</p>
              ${questionHTML(card)}
            </div>

            <!-- Zone réponse : grille d'images OU saisie texte -->
            <div id="qt-answer-area">
              ${isImageOnlyAnswer ? `
                <p style="font-size:13px;color:#6B7280;margin-bottom:10px;text-align:center;">Choisissez la bonne réponse</p>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
                  ${imageOptions.map((opt, i) => `
                    <button data-idx="${i}" data-correct="${opt.isCorrect}"
                      style="border:2px solid #E5E7EB;border-radius:10px;padding:3px;background:white;cursor:pointer;aspect-ratio:1;overflow:hidden;transition:border-color 0.15s,transform 0.1s;">
                      <img src="${opt.src}" alt="Option ${i + 1}"
                        style="width:100%;height:100%;object-fit:cover;border-radius:7px;pointer-events:none;display:block;" />
                    </button>
                  `).join('')}
                </div>
              ` : `
                <input id="qt-input" type="text" placeholder="Votre réponse..." autocomplete="off"
                  style="width:100%;padding:14px 16px;border:2px solid #E5E7EB;border-radius:12px;font-size:16px;outline:none;box-sizing:border-box;transition:border-color 0.2s;" />
                <button id="qt-submit" style="width:100%;margin-top:12px;padding:14px;background:linear-gradient(135deg,#EF4444,#DC2626);color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">
                  Valider
                </button>
              `}
            </div>
          </div>
        `;

        const timerEl = container.querySelector('#qt-timer');
        const timerCount = container.querySelector('#qt-timer-count');
        const progressEl = container.querySelector('#qt-progress');

        // Timer commun aux deux flows
        clearInterval(timer);
        timer = setInterval(() => {
          timeLeft--;
          timerCount.textContent = `${timeLeft}s`;
          progressEl.style.width = `${(timeLeft / timePerCard) * 100}%`;
          if (timeLeft <= 5) timerEl.style.color = '#DC2626';
          if (timeLeft <= 0) {
            clearInterval(timer);
            // Timeout : désactiver la grille et traiter comme raté
            if (isImageOnlyAnswer) {
              container.querySelectorAll('#qt-answer-area [data-idx]').forEach(b => {
                b.disabled = true;
                if (b.dataset.correct === 'true') {
                  b.style.borderColor = '#22C55E';
                  b.style.background = '#F0FDF4';
                }
              });
              // Passer au feedback automatiquement après un court délai
              setTimeout(() => handleResult(card, false, 1, true), 700);
            } else {
              handleResult(card, false, 1, true);
            }
          }
        }, 1000);

        if (isImageOnlyAnswer) {
          // Flow grille : clic sur une image → surligner correct/incorrect → bouton Suivant
          container.querySelectorAll('#qt-answer-area [data-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
              clearInterval(timer);
              const chosen = btn.dataset.correct === 'true';

              // Surligner toutes les options
              container.querySelectorAll('#qt-answer-area [data-idx]').forEach(b => {
                b.disabled = true;
                b.style.cursor = 'default';
                if (b.dataset.correct === 'true') {
                  b.style.borderColor = '#22C55E';
                  b.style.background = '#F0FDF4';
                  b.style.transform = 'scale(1.04)';
                } else if (b === btn && !chosen) {
                  b.style.borderColor = '#EF4444';
                  b.style.background = '#FEF2F2';
                }
              });

              const ratio = timeLeft / timePerCard;
              const quality = !chosen ? 1 : ratio > 0.66 ? 5 : ratio > 0.33 ? 4 : 3;

              // Passer au feedback automatiquement après un court délai (le temps de voir le surlignage)
              setTimeout(() => handleResult(card, chosen, quality, false), 700);
            });
          });
        } else {
          // Flow texte : saisie + validation
          const input = container.querySelector('#qt-input');
          const submitBtn = container.querySelector('#qt-submit');
          input.focus();

          const checkAnswer = (viaKeyboard = false) => {
            clearInterval(timer);
            const userAnswer = input.value.trim().toLowerCase();
            const correctAnswer = card.back.trim().toLowerCase();
            const isCorrect = userAnswer === correctAnswer;

            let quality;
            if (!isCorrect) {
              quality = 1;
            } else {
              // Qualité basée sur le temps restant : répondre vite = mieux mémorisé
              const ratio = timeLeft / timePerCard;
              if (ratio > 0.66) quality = 5;
              else if (ratio > 0.33) quality = 4;
              else quality = 3;
            }
            handleResult(card, isCorrect, quality, !isCorrect, viaKeyboard);
          };

          submitBtn.addEventListener('click', () => checkAnswer(false));
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(true); });
          input.addEventListener('focus', () => { input.style.borderColor = '#6366F1'; });
          input.addEventListener('blur', () => { input.style.borderColor = '#E5E7EB'; });
        }
      };

      // === Traitement du résultat d'une carte ===
      // showAnswer : afficher la bonne réponse dans le feedback (utile si timeout ou erreur)
      const handleResult = (card, isCorrect, quality, showAnswer, viaKeyboard = false) => {
        onCardResult(card.id, quality);

        if (isCorrect) {
          if (!incorrectIds.has(card.id)) score++; // premier coup réussi
          queue.shift();
        } else {
          if (!incorrectIds.has(card.id)) {
            incorrectCount++;
            incorrectIds.add(card.id); // ne compter qu'une fois par carte
          }
          queue.push(queue.shift()); // repassée en fin de file
        }

        showFeedback(isCorrect, card, quality, showAnswer, viaKeyboard);
      };

      // === Écran de feedback après chaque carte ===
      const showFeedback = (isCorrect, card, quality, showAnswer, viaKeyboard = false) => {
        const bgColor = isCorrect ? '#ECFDF5' : '#FEF2F2';
        const textColor = isCorrect ? '#059669' : '#DC2626';
        const icon = isCorrect
          ? svgIcon('check-circle', { size: 40, color: textColor })
          : svgIcon('x-circle', { size: 40, color: textColor });

        // Message : "Correct !" ou "La bonne réponse était…"
        const hasBackText = card.back && card.back.trim();
        const message = isCorrect
          ? 'Correct !'
          : (hasBackText ? `La bonne réponse était : ${card.back}` : 'Incorrect !');

        // Afficher l'image de réponse si disponible (le texte est déjà dans `message`)
        const answerBlock = (!isCorrect && showAnswer && card.backImage) ? `
          <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:14px;border:1px solid #E5E7EB;">
            <img src="${card.backImage}" alt="Réponse"
              style="max-width:100%;max-height:180px;object-fit:contain;border-radius:8px;" />
          </div>
        ` : (isCorrect && card.backImage && hasBackText) ? `
          <div style="background:#F0FDF4;border-radius:12px;padding:12px;margin-bottom:14px;">
            <img src="${card.backImage}" alt="Réponse"
              style="max-width:100%;max-height:160px;object-fit:contain;border-radius:8px;" />
          </div>
        ` : '';

        // Badge qualité SM-2
        const qualityLabels = { 1: 'Raté', 2: 'Difficile', 3: 'Correct', 4: 'Facile', 5: 'Parfait !' };
        const qualityColors = { 1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#22C55E', 5: '#6366F1' };
        const sm2Badge = sm2Mode ? `
          <div style="display:inline-flex;align-items:center;gap:6px;background:#F3F4F6;border-radius:8px;padding:6px 12px;margin-bottom:14px;font-size:13px;color:${qualityColors[quality]};font-weight:600;">
            ${svgIcon('brain', { size: 13, color: qualityColors[quality] })}
            ${qualityLabels[quality]}
          </div>
        ` : '';

        const remaining = queue.length;
        const nextLabel = remaining > 0
          ? `Suivant <span style="font-size:13px;opacity:0.8;">(${remaining} restante${remaining > 1 ? 's' : ''})</span>`
          : 'Voir les résultats';

        container.innerHTML = `
          <div style="text-align:center;padding:32px 20px;font-family:system-ui,-apple-system,sans-serif;max-width:500px;margin:0 auto;">
            <div style="width:72px;height:72px;background:${bgColor};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">${icon}</div>
            <p style="font-size:18px;font-weight:600;color:${textColor};margin-bottom:14px;">${message}</p>
            ${answerBlock}
            ${sm2Badge}
            <br/>
            <button id="qt-next" style="padding:12px 28px;background:linear-gradient(135deg,#6366F1,#4F46E5);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;">
              ${nextLabel}
            </button>
          </div>
        `;
        const nextBtn = container.querySelector('#qt-next');
        nextBtn.addEventListener('click', render);
        const onEnterDown = (e) => { if (e.key === 'Enter') { window.removeEventListener('keydown', onEnterDown); render(); } };
        if (viaKeyboard) {
          // Entrée utilisée pour valider : attendre que la touche soit relâchée
          // avant d'activer le listener, pour éviter de passer au suivant immédiatement
          const onEnterUp = (e) => { if (e.key === 'Enter') { window.removeEventListener('keyup', onEnterUp); window.addEventListener('keydown', onEnterDown); } };
          window.addEventListener('keyup', onEnterUp);
        } else {
          window.addEventListener('keydown', onEnterDown);
        }
      };

      // Lancer le quiz
      render();
    },

    /**
     * onDestroy — Appelé quand le joueur quitte le mode.
     * Le timer est dans le scope de onPlay et sera garbage-collecté automatiquement.
     */
    onDestroy() {
      // Rien à nettoyer ici : le timer est géré en interne dans onPlay
    },

    /**
     * onEdit (optionnel) — Configuration par leçon.
     */
    onEdit({ container, cards, lessonName, getData, setData, onClose }) {
      const currentData = getData() || { timePerCard: 15, sm2Mode: true };

      container.innerHTML = `
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:8px;">
          <p style="font-size:14px;color:#6B7280;margin-bottom:16px;">
            Configurez le Quiz Chrono pour la leçon "${lessonName}" (${cards.length} cartes).
          </p>

          <!-- Mode SM-2 -->
          <div style="background:#EFF6FF;border-radius:10px;padding:14px;margin-bottom:16px;">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input id="qte-sm2" type="checkbox" ${currentData.sm2Mode !== false ? 'checked' : ''}
                style="margin-top:2px;width:16px;height:16px;cursor:pointer;accent-color:#6366F1;" />
              <div>
                <div style="font-size:14px;font-weight:600;color:#1E40AF;margin-bottom:2px;">Mode révision SM-2</div>
                <div style="font-size:13px;color:#3B82F6;">
                  Joue uniquement les cartes dues aujourd'hui. La rapidité de réponse influence les prochains intervalles de révision.
                </div>
              </div>
            </label>
          </div>

          <!-- Temps par carte -->
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px;">
              Temps par carte (secondes)
            </label>
            <input id="qte-time" type="number" min="5" max="120" value="${currentData.timePerCard}"
              style="width:100%;padding:10px 12px;border:2px solid #E5E7EB;border-radius:8px;font-size:16px;outline:none;box-sizing:border-box;" />
          </div>

          <div style="background:#F3F4F6;border-radius:8px;padding:12px;margin-bottom:16px;">
            <p style="font-size:13px;color:#6B7280;display:flex;align-items:center;gap:6px;margin:0;">
              Durée estimée : <strong id="qte-estimate">${(currentData.timePerCard * cards.length / 60).toFixed(1)} min</strong>
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
        const sm2Mode = container.querySelector('#qte-sm2').checked;
        setData({ timePerCard, sm2Mode });
        onClose();
      });
    },
  });
})();
