// routes/repo.js
const express = require('express');
const { createRepo } = require('../services/gcsRepo');

const router = express.Router();

router.post('/', async (req, res) => {
  const { repoName } = req.body;

  if (!repoName) return res.status(400).json({ error: 'Repo name is required' });

  try {
    await createRepo(repoName);
    res.status(201).json({ success: true, repo: repoName, defaultBranch: 'main' });
  } catch (err) {
    console.error(err);
    const status = err.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
