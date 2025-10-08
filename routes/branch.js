// routes/branch.js
const express = require('express');
const { createBranch, switchBranch, deleteBranch, mergeBranch , getBranchTree} = require('../services/gcsBranch');
const router = express.Router();

router.post('/:repoName', async (req, res) => {
  const { repoName } = req.params;
  const { branchName } = req.body;

  if (!branchName || !branchName.trim()) {
    return res.status(400).json({ error: 'Branch name is required' });
  }

  try {
    await createBranch(repoName, branchName.trim());
    res.status(201).json({ success: true, branch: branchName });
  } catch (err) {
    const status = err.message === 'Branch already exists' ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/:repoName/switch', async (req, res) => {
  const { repoName } = req.params;
  const { targetBranch } = req.body;

  if (!targetBranch || !targetBranch.trim()) {
    return res.status(400).json({ error: 'Target branch name is required' });
  }

  try {
    await switchBranch(repoName, targetBranch.trim());
    res.status(200).json({ success: true, current_branch: targetBranch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/:repoName/:branchName', async (req, res) => {
  const { repoName, branchName } = req.params;
  console.log('main entry')
  try {
    await deleteBranch(repoName, branchName.trim());
    res.status(200).json({ success: true, deleted: branchName });
  } catch (err) {
    const status = err.message.includes('current') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});
router.post('/:repoName/merge', async (req, res) => {
  const { repoName } = req.params;
  const { sourceBranch } = req.body;

  if (!sourceBranch || !sourceBranch.trim()) {
    return res.status(400).json({ error: 'sourceBranch is required' });
  }

  try {
    const result = await mergeBranch(repoName, sourceBranch.trim());
    res.status(200).json({
      success: true,
      message: result.message,
      commitId: result.commitId,
      mergedInto: result.mergedInto
    });
  } catch (err) {
    const status = err.conflict ? 409 : 500;
    res.status(status).json({
      success: false,
      error: err.message,
      conflicts: err.conflicts || [],
    });
  }
});
router.get('/branch-tree/:repoName', async (req, res) => {
  const { repoName } = req.params;

  try {
    const tree = await getBranchTree(repoName);
    res.json(tree);
  } catch (err) {
    console.error('Error building branch tree:', err.message);
    res.status(500).json({ error: 'Failed to build branch tree' });
  }
});


module.exports = router;
