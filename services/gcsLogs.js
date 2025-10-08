const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

async function getRepoLog(repoName) {
  const repoFile = bucket.file(`repos/${repoName}/repo.json`);
  const [exists] = await repoFile.exists();

  if (!exists) {
    throw new Error('Repository not found');
  }

  const [data] = await repoFile.download();
  return JSON.parse(data.toString());
}

module.exports = { getRepoLog };
