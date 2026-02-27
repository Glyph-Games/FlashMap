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
    onPlay({ container, cards, lessonName, customData, onComplete, onExit }) {
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
  container,    // HTMLElement — votre zone de rendu
  cards,        // Array<Card> — les cartes de la leçon
  lessonName,   // string — nom de la leçon
  customData,   // any — données de onEdit (ou null)
  onComplete,   // Function — à appeler en fin de partie
  onExit,       // Function — pour quitter le mode
})
```

#### Format des cartes

```js
{
  id: number,
  front: string,         // Question
  back: string,          // Réponse
  frontImage: string|null, // URL image question
  backImage: string|null,  // URL image réponse
  wrongAnswers: string[]   // Réponses incorrectes (pour QCM)
}
```

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
