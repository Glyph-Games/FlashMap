# FlashMap SDK — Guide du Développeur

Créez des modes de jeu personnalisés pour FlashMap et partagez-les avec la communauté.

## Démarrage rapide

Un mode de jeu FlashMap est un fichier JavaScript auto-exécutable qui appelle `FlashMap.registerMode()`.

```js
(function () {
  FlashMap.registerMode({
    // Métadonnées
    id: 'mon-mode',
    name: 'Mon Mode',
    description: 'Description courte du mode',
    version: '1.0.0',
    author: 'Votre Nom',
    icon: '🎮',
    color: '#6366F1',

    // Obligatoire : Lancement du jeu
    onPlay({ container, cards, dueCards, lessonName, customData, onCardResult, onComplete, onExit }) {
      // Votre logique de jeu ici
    },

    // Obligatoire : Nettoyage
    onDestroy() {
      // Nettoyage (timers, listeners, etc.)
    },

    // Optionnel : Configuration par leçon
    onEdit({ container, cards, lessonName, getData, setData, onClose }) {
      // Interface de configuration
    },
  });
})();
```

## Structure du mode

### Métadonnées (obligatoires)

| Propriété     | Type   | Description                          |
| ------------- | ------ | ------------------------------------ |
| `id`          | string | Identifiant unique (kebab-case)      |
| `name`        | string | Nom affiché dans l'interface         |
| `description` | string | Description courte                   |
| `version`     | string | Version semver (ex: `1.0.0`)         |
| `author`      | string | Nom de l'auteur                      |

### Métadonnées (optionnelles)

| Propriété | Type   | Défaut      | Description                           |
| --------- | ------ | ----------- | ------------------------------------- |
| `icon`    | string | `'🧩'`     | Icône du mode (voir formats ci-dessous) |
| `color`   | string | `'#6366F1'` | Couleur thème du mode (hex)           |

#### Formats acceptés pour `icon`

| Format | Exemple | Description |
| ------ | ------- | ----------- |
| Emoji | `'🎮'` | Affiché directement |
| Nom Lucide | `'Trophy'` | Icône du set [Lucide](https://lucide.dev) |
| URL image | `'https://…/icon.png'` | Image hébergée (png, svg…) |

Les deux formats de nommage sont acceptés (PascalCase ou kebab-case) :

```js
// Exemples
icon: '🏆',              // emoji
icon: 'Trophy',           // icône Lucide (PascalCase)
icon: 'alarm-clock',      // icône Lucide (kebab-case, converti automatiquement)
icon: 'https://cdn.example.com/my-icon.png',  // image URL
```

Toutes les icônes du catalogue [lucide.dev](https://lucide.dev) sont disponibles — aucune liste à consulter.

## API

### `onPlay(context)` — Obligatoire

Appelé quand le joueur lance le mode. Vous recevez un conteneur DOM vide où construire votre interface.

#### Paramètres du contexte

```js
onPlay({
  container,      // HTMLElement — votre zone de rendu
  cards,          // Array<Card> — toutes les cartes de la leçon (avec champs SM-2)
  dueCards,       // Array<Card> — cartes dues pour révision (nextReview ≤ maintenant), triées par date
  lessonName,     // string — nom de la leçon
  customData,     // any — données de onEdit (ou null)
  onCardResult,   // Function — noter une carte avec SM-2 (voir section Révision espacée)
  onComplete,     // Function — à appeler en fin de partie
  onExit,         // Function — pour quitter le mode
})
```

#### Format des cartes

```js
{
  id: number,
  front: string,            // Question
  back: string,             // Réponse
  frontImage: string|null,  // URL image question
  backImage: string|null,   // URL image réponse
  wrongAnswers: string[],   // Réponses incorrectes (pour QCM)

  // Champs SM-2 (lecture seule — utiliser onCardResult pour les modifier)
  nextReview: number,       // Timestamp de la prochaine révision (ms)
  interval: number,         // Intervalle actuel en jours
  easeFactor: number,       // Facteur de facilité (1.3 à 3.0, défaut 2.5)
  repetitions: number,      // Nombre de révisions réussies consécutives
}
```

#### `onCardResult(cardId, quality)` — Révision espacée (SM-2)

Appelez cette fonction après chaque réponse pour mettre à jour l'algorithme SM-2 de la carte. FlashMap recalcule automatiquement le prochain intervalle de révision.

```js
onCardResult(cardId, quality);
// cardId : id de la carte (number)
// quality : note de 1 à 5
```

| Valeur | Signification | Effet sur la carte |
| ------ | ------------- | ------------------ |
| `1`    | Raté / Again  | Reset (repetitions=0, interval=1j, EF -0.2) |
| `2`    | Difficile, raté | Reset (idem) |
| `3`    | Correct (effort) | Intervalle progresse, EF inchangé |
| `4`    | Facile         | Intervalle progresse, EF +0.1 |
| `5`    | Parfait        | Intervalle progresse, EF +0.16 |

> **Progression des intervalles** : 1j → 6j → interval × EF (arrondi) à chaque réussite.

> **`dueCards`** contient uniquement les cartes que l'algorithme SM-2 a planifiées pour aujourd'hui. Si le tableau est vide, le joueur n'a rien à réviser.

#### `onComplete(results)`

Appelez cette fonction à la fin de la partie pour enregistrer les statistiques :

```js
onComplete({
  correct: 8,     // nombre de bonnes réponses
  incorrect: 2,   // nombre de mauvaises réponses
  studied: 10     // nombre total de cartes étudiées
});
```

> Après `onComplete`, le joueur revient automatiquement au menu.

#### `onExit()`

Appelez pour quitter immédiatement le mode (bouton "Quitter", etc.).

### `onDestroy()` — Obligatoire

Appelé quand le joueur quitte le mode. Nettoyez vos timers, event listeners globaux, etc.

```js
onDestroy() {
  clearInterval(this.myTimer);
  window.removeEventListener('keydown', this.myHandler);
}
```

### `onEdit(context)` — Optionnel

Permet à l'utilisateur de configurer le mode pour chaque leçon. Si implémenté, un bouton "Configurer" (icône engrenage) apparaît dans la gestion des modes.

```js
onEdit({
  container,    // HTMLElement — zone de rendu pour le formulaire
  cards,        // Array<Card> — cartes de la leçon
  lessonName,   // string — nom de la leçon
  getData,      // Function — () => données sauvegardées (ou null)
  setData,      // Function — (data) => sauvegarde les données
  onClose,      // Function — ferme la modal de configuration
})
```

#### Exemple

```js
onEdit({ container, cards, getData, setData, onClose }) {
  const data = getData() || { difficulty: 'normal' };

  container.innerHTML = `
    <select id="diff">
      <option value="easy" ${data.difficulty === 'easy' ? 'selected' : ''}>Facile</option>
      <option value="normal" ${data.difficulty === 'normal' ? 'selected' : ''}>Normal</option>
      <option value="hard" ${data.difficulty === 'hard' ? 'selected' : ''}>Difficile</option>
    </select>
    <button id="save">Sauvegarder</button>
  `;

  container.querySelector('#save').addEventListener('click', () => {
    setData({ difficulty: container.querySelector('#diff').value });
    onClose();
  });
}
```

Les données sauvées via `setData` sont ensuite accessibles dans `onPlay` via `customData`.

## `FlashMap.icons` — Icônes Lucide

FlashMap expose le set d'icônes [Lucide](https://lucide.dev) via `window.FlashMap.icons`. Vous pouvez les utiliser dans votre interface de jeu si votre mode utilise React.

Les icônes sont chargées de façon asynchrone. Attendez leur disponibilité dans `onPlay` :

```js
async onPlay({ container }) {
  const { Trophy, CheckCircle, X } = await window.FlashMap.icons;
  // Les icônes sont des composants React — utilisez-les avec ReactDOM
  ReactDOM.createRoot(container).render(
    <div>
      <Trophy className="w-8 h-8 text-yellow-500" />
      <p>Bravo !</p>
    </div>
  );
}
```

> **Note** : `window.FlashMap.icons` est une `Promise` jusqu'au premier chargement. Utilisez `await` ou `.then()`. Pour les modes en **vanilla JS**, préférez des emojis ou des SVG inline.

## Révision espacée (SM-2)

FlashMap intègre l'algorithme **SM-2** pour planifier les révisions dans le temps. Vos modes peuvent s'y connecter pour que chaque partie influence les prochaines dates de révision du joueur.

### Fonctionnement

- `dueCards` : cartes dont la date de révision est aujourd'hui ou dépassée, triées de la plus ancienne à la plus récente. Commencez par elles pour respecter le planning du joueur.
- `onCardResult(cardId, quality)` : à appeler après chaque réponse. FlashMap met à jour `interval`, `easeFactor`, `repetitions` et `nextReview` de la carte.
- `cards` : toutes les cartes, y compris celles non dues (utile pour un mode entraînement libre).

### Exemple — Mode révision SM-2 complet

```js
onPlay({ container, dueCards, onCardResult, onComplete, onExit }) {
  let queue = [...dueCards]; // file de révision du jour
  let correct = 0, incorrect = 0;

  // Rien à réviser aujourd'hui
  if (queue.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; font-family:sans-serif;">
        <div style="font-size:48px;">🎉</div>
        <h2>Rien à réviser aujourd'hui !</h2>
        <p>Toutes vos cartes sont à jour.</p>
        <button id="exit" style="margin-top:16px; padding:8px 20px;">Retour</button>
      </div>`;
    container.querySelector('#exit').addEventListener('click', onExit);
    return;
  }

  function showCard() {
    if (queue.length === 0) {
      // Fin de session
      onComplete({ correct, incorrect, studied: correct + incorrect });
      return;
    }

    const card = queue[0];
    container.innerHTML = `
      <div style="text-align:center; padding:24px; font-family:sans-serif;">
        <p style="color:#888; font-size:13px;">${queue.length} carte(s) restante(s)</p>
        <h2>${card.front}</h2>
        <div id="answer" style="display:none;">
          <p style="font-size:20px; color:#333;">${card.back}</p>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:16px;">
            <button data-q="1" style="padding:8px 16px; background:#ef4444; color:white; border:none; border-radius:8px; cursor:pointer;">Raté</button>
            <button data-q="3" style="padding:8px 16px; background:#f59e0b; color:white; border:none; border-radius:8px; cursor:pointer;">Correct</button>
            <button data-q="4" style="padding:8px 16px; background:#22c55e; color:white; border:none; border-radius:8px; cursor:pointer;">Facile</button>
            <button data-q="5" style="padding:8px 16px; background:#6366f1; color:white; border:none; border-radius:8px; cursor:pointer;">Parfait</button>
          </div>
        </div>
        <button id="reveal" style="margin-top:16px; padding:8px 20px;">Voir la réponse</button>
      </div>`;

    container.querySelector('#reveal').addEventListener('click', () => {
      container.querySelector('#answer').style.display = 'block';
      container.querySelector('#reveal').style.display = 'none';
    });

    container.querySelectorAll('[data-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        const quality = parseInt(btn.dataset.q);
        onCardResult(card.id, quality); // ← mise à jour SM-2
        if (quality >= 3) { correct++; queue.shift(); }
        else { incorrect++; queue.push(queue.shift()); } // revoir en fin de file
        showCard();
      });
    });
  }

  showCard();
},
```

### Exemple — Mode entraînement libre (sans SM-2)

Si votre mode ne note pas les cartes individuellement, vous pouvez ignorer `onCardResult` et `dueCards`, et utiliser uniquement `cards` :

```js
onPlay({ container, cards, onComplete, onExit }) {
  // Jouer avec toutes les cartes, sans impact sur le planning SM-2
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  // ...
}
```

---

## Bonnes pratiques

1. **Utilisez des styles inline** — Votre mode s'exécute dans le DOM de FlashMap, utilisez `style="..."` pour éviter les conflits CSS.

2. **Nettoyez dans `onDestroy`** — Supprimez tout timer, interval, et listener global. Le conteneur est vidé automatiquement.

3. **IIFE** — Enveloppez tout dans `(function() { ... })()` pour éviter les fuites de variables globales.

4. **Responsive** — Testez sur mobile. Utilisez `%`, `vw`/`vh`, ou `max-width` pour un rendu adaptatif.

5. **Accessibilité** — Ajoutez des `aria-label` et supportez la navigation clavier quand possible.

6. **Données légères** — Les données de `setData` sont stockées en localStorage. Gardez-les compactes (pas d'images, pas de gros tableaux).

## Installation

1. Hébergez votre fichier JS sur un serveur accessible (GitHub Pages, Netlify, Vercel, etc.)
2. Dans FlashMap, ouvrez une leçon > Mode Manage > "+ Installer un nouveau mode"
3. Collez l'URL de votre fichier
4. Le mode apparaît dans la grille des modes de jeu

## Exemple complet

Voir le fichier [`/examples/quiz-timer.js`](../public/examples/quiz-timer.js) pour un exemple complet avec `onPlay`, `onDestroy` et `onEdit`.
