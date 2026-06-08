const fs = require('fs');
const path = require('path');

// ── Environment detection ────────────────────────────────────────────────────
// On Replit, DEFAULT_OBJECT_STORAGE_BUCKET_ID is auto-set and the sidecar
// runs at 127.0.0.1:1106. Everywhere else (Railway, Render, local dev) we
// fall back to writing files to the local `uploads/` directory so the app
// works without any extra object-storage credentials.

const IS_REPLIT = !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

// ── Local-disk helpers ───────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function diskPath(key) {
  // key looks like  assets/<requestId>/<fileId>.ext
  // flatten to  uploads/<requestId>-<fileId>.ext  to avoid sub-dir issues
  const safe = key.replace(/\//g, '_');
  return path.join(UPLOADS_DIR, safe);
}

// ── Replit Object Storage (only initialised when bucket id is present) ───────
let replitClient = null;
let replitBucket = null;

if (IS_REPLIT) {
  try {
    const { Storage } = require('@google-cloud/storage');
    const SIDECAR = 'http://127.0.0.1:1106';
    replitClient = new Storage({
      credentials: {
        audience: 'replit',
        subject_token_type: 'access_token',
        token_url: `${SIDECAR}/token`,
        type: 'external_account',
        credential_source: {
          url: `${SIDECAR}/credential`,
          format: { type: 'json', subject_token_field_name: 'access_token' },
        },
        universe_domain: 'googleapis.com',
      },
      projectId: '',
    });
    replitBucket = replitClient.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
    console.log('[storage] Using Replit Object Storage bucket:', process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
  } catch (e) {
    console.warn('[storage] Failed to init Replit Object Storage, falling back to disk:', e.message);
  }
}

if (!IS_REPLIT || !replitBucket) {
  ensureUploadsDir();
  console.log('[storage] Using local disk storage at', UPLOADS_DIR);
}

// ── Public API ───────────────────────────────────────────────────────────────

async function put(key, buffer, contentType) {
  if (replitBucket) {
    const file = replitBucket.file(key);
    await file.save(buffer, {
      resumable: false,
      contentType: contentType || 'application/octet-stream',
      metadata: { contentType: contentType || 'application/octet-stream' },
    });
    return key;
  }
  // Disk fallback
  ensureUploadsDir();
  fs.writeFileSync(diskPath(key), buffer);
  return key;
}

function getReadStream(key) {
  if (replitBucket) {
    return replitBucket.file(key).createReadStream();
  }
  // Disk fallback
  return fs.createReadStream(diskPath(key));
}

async function del(key) {
  try {
    if (replitBucket) {
      await replitBucket.file(key).delete({ ignoreNotFound: true });
      return;
    }
    const p = diskPath(key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.warn('[storage] delete failed for', key, e.message);
  }
}

async function exists(key) {
  try {
    if (replitBucket) {
      const [ok] = await replitBucket.file(key).exists();
      return ok;
    }
    return fs.existsSync(diskPath(key));
  } catch (e) {
    return false;
  }
}

function buildAssetKey(requestId, fileId, originalName) {
  const ext = path.extname(originalName || '') || '';
  return `assets/${requestId}/${fileId}${ext}`;
}

// ── Legacy-disk-path detection (unchanged) ───────────────────────────────────
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

function getBucketName() {
  return process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || 'local-disk';
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
