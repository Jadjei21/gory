// services/gcsStaging.js
const { Storage } = require('@google-cloud/storage');
const path = require('path');

require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

async function stageFiles(repoName, files) {
  const uploadedFiles = [];

  const promises = files.map((file) => {
    const blob = bucket.file(`repos/${repoName}/staging/${file.originalname}`);
    const stream = blob.createWriteStream({
      resumable: false,
      metadata: { contentType: file.mimetype },
    });

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        uploadedFiles.push(blob.name);
        resolve();
      });
      stream.on('error', reject);
      stream.end(file.buffer);
    });
  });

  await Promise.all(promises);
  return uploadedFiles;
}

module.exports = { stageFiles };
