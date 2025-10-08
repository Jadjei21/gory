// routes/commit.js
const express = require('express');
const { commitFiles } = require('../services/gcsCommit');

const router = express.Router();

router.post('/:repoName', async (req, res) => {
  const { repoName } = req.params;
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Commit message is required' });
  }

  try {
    const result = await commitFiles(repoName, message);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const status = err.message === 'Nothing to commit' ? 409 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
