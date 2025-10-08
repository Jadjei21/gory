// routes/status.js
const express = require('express');
const { getStagedFiles } = require('../services/gcsStatus');

const router = express.Router();

router.get('/:repoName', async (req, res) => {
  const { repoName } = req.params;

  try {
    const files = await getStagedFiles(repoName);
    res.status(200).json({ staged: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
