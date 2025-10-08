// routes/staging.js
const express = require('express');
const multer = require('multer');
const { stageFiles } = require('../services/gcsStaging');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/:repoName', upload.array('files'), async (req, res) => {
  const { repoName } = req.params;

  if (!repoName) return res.status(400).json({ error: 'Repository name is required' });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const uploaded = await stageFiles(repoName, req.files);
    res.status(200).json({ success: true, files: uploaded });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
