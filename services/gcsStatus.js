// services/gcsStatus.js
const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

async function getStagedFiles(repoName) {
  const prefix = `repos/${repoName}/staging/`;
  const [files] = await bucket.getFiles({ prefix });

  return files
    .filter(file => !file.name.endsWith('/')) // skip folder placeholders
    .map(file => file.name.replace(prefix, '')); // relative path
}

module.exports = { getStagedFiles };
