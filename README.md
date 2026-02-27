![FlashMap Logo](https://iili.io/K8e4zLF.png)
An open source React application made to simplify learning at school

## Features
FlashMap is a spaced learning application that uses different methods. The application currently includes pre-built game modes such as 

 - Classic Cards, which allows users to review with flashcards that they turn over. Users then indicate whether they found the card difficult to learn or not on a scale of 5 different levels of difficulty, in order to accurately feed the SM-2 learning algorithm.
- The association game mode, where the user must match the correct question to the correct answer in a group of several questions and answers.
- The multiple-choice game mode, where the user must answer a multiple-choice question.
- And finally, a typing challenge game mode,

All lessons are a list of cards with a question on one side and an answer on the other (with or without three other incorrect answers related to the question for the multiple-choice game mode).

Lessons can be written manually by the user or created using an image or PDF of your course and AI 

> the AI currently implemented in FlashMap is Gemini Flash, you must provide your own Gemini API key.

FlashMap uses the SM-2 learning algorithm to determine the user's knowledge of each cards and help them learn more effectively through spaced repetition learning.

But the best way for you to see the features FlashMap has to offer is [to visit the official website](https://flashmap.app)

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/Glyph-Games/FlashMap.git
cd FlashMap
```

3.  **Install dependencies**
    
```bash
npm install
```
    
4.  **Start the development server**
    
```bash
npm start
```
    
 The app will be available at  `http://localhost:3000`
    
5. **Build for production**
    
```bash
npm run build
```
>On first launch, if no API key is configured, a modal will automatically appear prompting you to enter it.

## Language

Currently FlashMap is developed and available only in French, but your contribution to port FlashMap into another language will be greatly appreciated.

## Contributing

All contributions are very welcome! Please create a branch for your feature or fix (`feature/your-feature-name` or `fix/your-fix-name`), then open a Pull Request describing what you changed and why.

## Backend

FlashMap also contains a backend for lesson sharing and statistics. More information can be found in the [backend readme.](backend/README.md)

## Create externals game modes using the FlashMap SDK

You can create your own custom game modes in JS using the FlashMap SDK [available here](docs/SDK.md) (sorry but only in French for now). Host your JS file on an accessible server (GitHub Pages, Netlify, Vercel, etc.), then you or any other user can use it by pasting the game mode URL into FlashMap, open a lesson > Manage Mode > “+ Install a new mode.”

 **But your game mode can also be available in the game mode store, visible to everyone and also present on the https://flashmap.app website.** To submit your game mode, create a branch `gamemode/your-gamemode-name`then open a Pull Request describing your game mode, filling in the with

---

Made with love by tomyfak in Montpellier, France.


