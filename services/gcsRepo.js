// services/gcsRepo.js
const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});


const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

async function createRepo(repoName) {
  const basePath = `repos/${repoName}/`;
  const repoMetaFile = bucket.file(`${basePath}repo.json`);
  const exists = await repoMetaFile.exists();

  if (exists[0]) {
    throw new Error(`Repository "${repoName}" already exists.`);
  }

  // Create commits and staging "folders" with .init files
  const commitsInit = bucket.file(`${basePath}commits/.init`);
  const stagingInit = bucket.file(`${basePath}staging/.init`);
  await Promise.all([
    commitsInit.save('Commits initialized'),
    stagingInit.save('Staging initialized'),
  ]);

  // Create branches dir + main_repo.json file
  const branchPath = `${basePath}branches/`;
  const mainBranchMeta = bucket.file(`${branchPath}main_repo.json`);
  await mainBranchMeta.save(
    JSON.stringify({ branch: 'main',commits: [], subBranches: [] ,createdAt: new Date().toISOString() }, null, 2),
    { contentType: 'application/json' }
  );

  // Create repo.json
  const repoMetadata = {
    defaultBranch: 'main',
    branches: ['main'],
    commits: [],
    current_branch: 'main',
    createdAt: new Date().toISOString(),
  };

  await repoMetaFile.save(JSON.stringify(repoMetadata, null, 2), {
    contentType: 'application/json',
  });
}

module.exports = { createRepo };
