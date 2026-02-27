const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Ajouter le plugin stealth pour éviter la détection
puppeteer.use(StealthPlugin());

/**
 * Route pour importer un set Quizlet via URL
 * POST /api/quizlet/import
 * Body: { url: "https://quizlet.com/..." }
 */
router.post('/import', async (req, res) => {
  let browser;

  try {
    const { url } = req.body;

    // Validation de l'URL
    if (!url || !url.includes('quizlet.com')) {
      return res.status(400).json({
        error: 'URL invalide',
        details: 'Veuillez fournir une URL Quizlet valide'
      });
    }

    console.log('[Quizlet Import] Démarrage du scraping pour:', url);

    // Lancer le navigateur headless
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Configurer les headers pour éviter la détection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Cache-Control': 'max-age=0'
    });

    // Naviguer vers la page Quizlet
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Attendre que le contenu se charge
    await page.waitForTimeout(3000);

    console.log('[Quizlet Import] Page chargée, extraction des données...');

    // Extraire les données depuis __NEXT_DATA__
    const quizletData = await page.evaluate(() => {
      // Chercher le script __NEXT_DATA__
      const nextDataScript = document.getElementById('__NEXT_DATA__');

      if (!nextDataScript) {
        // Logger pour debug
        console.error('Scripts disponibles:', Array.from(document.querySelectorAll('script')).map(s => s.id || 'no-id'));
        throw new Error('__NEXT_DATA__ non trouvé sur la page');
      }

      const data = JSON.parse(nextDataScript.textContent);

      // Récupérer les informations du set
      const dehydratedState = data.props?.pageProps?.dehydratedReduxStateKey;

      if (!dehydratedState) {
        throw new Error('Données du set non trouvées');
      }

      // Extraire le titre du set
      const setTitle = data.props?.pageProps?.setTitle || 'Set Quizlet importé';

      // Extraire les termes depuis studyModesCommon
      const studyModesData = dehydratedState.studyModesCommon?.studiableData?.studiableItems || [];

      // Parser les cartes
      const cards = studyModesData.map(item => {
        const cardSide1 = item.cardSides?.find(side => side.label === 'word');
        const cardSide2 = item.cardSides?.find(side => side.label === 'definition');

        return {
          term: cardSide1?.media?.[0]?.plainText || '',
          definition: cardSide2?.media?.[0]?.plainText || '',
          imageUrl: cardSide2?.media?.find(m => m.type === 2)?.url || null,
          audioUrl: cardSide2?.media?.find(m => m.type === 3)?.url || null
        };
      });

      return {
        title: setTitle,
        cards: cards.filter(card => card.term && card.definition)
      };
    });

    await browser.close();

    console.log(`[Quizlet Import] Succès ! ${quizletData.cards.length} cartes extraites`);

    // Retourner les données formatées
    res.json({
      success: true,
      data: {
        title: quizletData.title,
        cardCount: quizletData.cards.length,
        cards: quizletData.cards
      }
    });

  } catch (error) {
    console.error('[Quizlet Import] Erreur:', error);

    // Fermer le navigateur en cas d'erreur
    if (browser) {
      await browser.close().catch(() => {});
    }

    res.status(500).json({
      error: 'Erreur lors de l\'importation',
      details: error.message
    });
  }
});

module.exports = router;
