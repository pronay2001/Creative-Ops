const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

const client = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: 'json', subject_token_field_name: 'access_token' },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

function getBucketName() {
  const b = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!b) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
  return b;
}

function getBucket() {
  return client.bucket(getBucketName());
}

// Detect legacy disk paths written before the Object Storage migration.
// New uploads use bucket object keys with a fixed `assets/` prefix
// (see buildAssetKey). Anything else that points at the local `uploads/`
// folder — either as an absolute path that includes that folder, or as a
// `uploads/...` relative path — is treated as legacy and served from disk.
// We intentionally do NOT treat every absolute path as legacy, so future
// object-key schemes that happen to start with `/` are not misrouted.
const LEGACY_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
function isLegacyDiskPath(filePath) {
  if (!filePath) return false;
  if (filePath.startsWith('assets/')) return false;
  if (filePath.startsWith(LEGACY_UPLOADS_DIR)) return true;
  if (filePath.indexOf('/uploads/') !== -1) return true;
  if (filePath.indexOf('\\uploads\\') !== -1) return true;
  if (filePath.startsWith('uploads/') || filePath.startsWith('uploads\\')) return true;
  return false;
}

async function put(key, buffer, contentType) {
  const file = getBucket().file(key);
  await file.save(buffer, {
    resumable: false,
    contentType: contentType || 'application/octet-stream',
    metadata: { contentType: contentType || 'application/octet-stream' },
  });
  return key;
}

function getReadStream(key) {
  return getBucket().file(key).createReadStream();
}

async function del(key) {
  try {
    await getBucket().file(key).delete({ ignoreNotFound: true });
  } catch (e) {
    // best-effort
    console.warn('[storage] delete failed for', key, e.message);
  }
}

async function exists(key) {
  try {
    const [ok] = await getBucket().file(key).exists();
    return ok;
  } catch (e) {
    return false;
  }
}

function buildAssetKey(requestId, fileId, originalName) {
  const ext = path.extname(originalName || '') || '';
  return `assets/${requestId}/${fileId}${ext}`;
}

module.exports = {
  put,
  getReadStream,
  del,
  exists,
  buildAssetKey,
  isLegacyDiskPath,
  getBucketName,
};
