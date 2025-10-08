// services/gcsCommit.js
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

const getFileBuffer = async (file) => (await file.download())[0];

const listFilesInPrefix = async (prefix) => {
  const [files] = await bucket.getFiles({ prefix });
  return files.filter(file => !file.name.endsWith('.init'));
};

function generateCommitId() {
  return Date.now().toString(); // simpler numeric ID
}

async function commitFiles(repoName, message) {
  const basePath = `repos/${repoName}/`;
  const stagingPath = `${basePath}staging/`;
  const repoJsonFile = bucket.file(`${basePath}repo.json`);

  const stagedFiles = await listFilesInPrefix(stagingPath);
  if (stagedFiles.length === 0) throw new Error('Nothing to commit');

  // Read and parse repo.json
  const [repoDataRaw] = await repoJsonFile.download();
  const repoData = JSON.parse(repoDataRaw.toString());
  const currentBranch = repoData.current_branch;
  const parentBranchFile = bucket.file(`${basePath}branches/${currentBranch}_repo.json`);
  const [parentRaw] = await parentBranchFile.download();
  const parentBranchData = JSON.parse(parentRaw.toString());

  // Get last commit if it exists
  let lastCommitFiles = [];
  if (parentBranchData.commits.length > 0) {
    const lastCommitId = parentBranchData.commits.at(-1).id;
    lastCommitFiles = await listFilesInPrefix(`${basePath}commits/${lastCommitId}/`);
  }

  // Compare staged to last commit
  const sameContent = await Promise.all(stagedFiles.map(async (stagedFile) => {
    const fileName = path.basename(stagedFile.name);
    const matching = lastCommitFiles.find(f => path.basename(f.name) === fileName);
    if (!matching) return false;

    const [a, b] = await Promise.all([
      getFileBuffer(stagedFile),
      getFileBuffer(matching),
    ]);

    return a.equals(b);
  }));

  if (sameContent.length === stagedFiles.length && sameContent.every(Boolean)) {
    throw new Error('Nothing to commit');
  }

  // Create new commit
  const commitId = generateCommitId();
  const workspacePrefix = `${basePath}branches/${currentBranch}/workspace/`;
const newCommitPath = `${basePath}commits/${commitId}/`;

// 1. Get all workspace files to snapshot
const workspaceFiles = await listFilesInPrefix(workspacePrefix);

await Promise.all(
  workspaceFiles.map(async (file) => {
    const relativePath = file.name.replace(workspacePrefix, '');
    const [buffer] = await file.download();

    // Save to commit snapshot
    await bucket.file(`${newCommitPath}${relativePath}`).save(buffer, {
      contentType: file.metadata.contentType,
    });
  })
);

// 2. Apply staged file changes to workspace (overwrite)
await Promise.all(
  stagedFiles.map(async (file) => {
    const relativePath = file.name.replace(stagingPath, '');
    const buffer = await getFileBuffer(file);

    await bucket.file(`${workspacePrefix}${relativePath}`).save(buffer, {
      contentType: file.metadata.contentType,
    });

    await file.delete(); // Clear staging
  })
);


  // Update commit logs
  parentBranchData.commits.push({ id: commitId, message });
  repoData.commits.push({ id: commitId, message });

  await parentBranchFile.save(JSON.stringify(parentBranchData, null, 2), {
    contentType: 'application/json',
  });

  await repoJsonFile.save(JSON.stringify(repoData, null, 2), {
    contentType: 'application/json',
  });

  return {
    committed: stagedFiles.map(f => f.name.replace(stagingPath, '')),
    commitId,
  };
}

module.exports = { commitFiles };
