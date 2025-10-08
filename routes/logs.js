const express = require('express');
const { getRepoLog } = require('../services/gcsLogs');

const router = express.Router();

router.get('/:repoName', async (req, res) => {
  const { repoName } = req.params;

  try {
    const log = await getRepoLog(repoName);
    res.status(200).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
