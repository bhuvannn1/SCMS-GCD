const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: 'uploads/' });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google API Key is not configured on the server." });
    }

    const { languageCode } = req.body; // e.g. 'hi-IN'
    const audioFilePath = req.file.path;

    const file = fs.readFileSync(audioFilePath);
    const audioBytes = file.toString('base64');

    // Use raw REST API to avoid SDK credential loading issues with API Keys
    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;
    
    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS',
        languageCode: languageCode || 'en-IN',
      },
      audio: {
        content: audioBytes
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Clean up file
    fs.unlinkSync(audioFilePath);

    if (!response.ok) {
      console.error('Speech API Error Response:', data);
      return res.status(response.status).json({ error: data.error?.message || "Unknown error" });
    }

    let transcription = '';
    if (data.results && data.results.length > 0) {
      transcription = data.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    }

    res.json({ text: transcription });
  } catch (error) {
    console.error('Speech-to-Text Error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
