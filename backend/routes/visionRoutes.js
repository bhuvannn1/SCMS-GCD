const express = require('express');
const router = express.Router();
const multer = require('multer');
const vision = require('@google-cloud/vision');

// Configure multer for memory storage (we don't need to save the image to disk)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Cloud Vision Client
const client = new vision.ImageAnnotatorClient();

// POST /api/vision/scan
// Extracts text from an uploaded image (invoice, label, waybill)
router.post('/scan', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    const imageBuffer = req.file.buffer;

    // Call Google Cloud Vision API for text detection
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });

    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      return res.json({ success: true, text: '', message: 'No text detected in the image.' });
    }

    // The first element in textAnnotations contains the entire extracted text
    const extractedText = detections[0].description;

    res.json({
      success: true,
      text: extractedText,
      message: 'Document scanned successfully using Google Cloud Vision AI.',
    });

  } catch (error) {
    console.error('VISION API ERROR:', error);
    res.status(500).json({ success: false, error: 'Failed to process image via Vision API: ' + error.message });
  }
});

module.exports = router;
