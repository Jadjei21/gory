const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'gory-server-1c683176a315.json'),
  projectId: process.env.GCLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

async function listRepos() {
  const [files] = await bucket.getFiles({ prefix: 'repos/' });
  // Only include paths that end with repo.json
  const repoNames = files
    .filter(file => file.name.endsWith('repo.json'))
    .map(file => {
      const match = file.name.match(/^repos\/([^/]+)\/repo\.json$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  return repoNames;
}

module.exports = { listRepos };
