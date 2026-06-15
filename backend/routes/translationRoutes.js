const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google API Key is not configured on the server." });
    }

    const { text, targetLanguage } = req.body;
    
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "Missing text or targetLanguage" });
    }

    // Use raw REST API to avoid SDK credential loading issues with API Keys
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        target: targetLanguage
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Translate API Error Response:', data);
      return res.status(response.status).json({ error: data.error?.message || "Unknown error" });
    }

    let translatedText = text;
    if (data.data && data.data.translations && data.data.translations.length > 0) {
      translatedText = data.data.translations[0].translatedText;
    }

    // Decode HTML entities that Google Translate might return (like &#39;)
    translatedText = translatedText.replace(/&#39;/g, "'").replace(/&quot;/g, '"');

    res.json({ translatedText });
  } catch (error) {
    console.error('Translation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
