const express = require('express');
const { listRepos } = require('../services/gcsRepos');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const repos = await listRepos();
    res.status(200).json({ repos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
