import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "image-studio.sqlite");

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    model_label TEXT NOT NULL,
    size_label TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    input_asset_ids TEXT NOT NULL DEFAULT '[]',
    output_asset_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function insertAsset(asset) {
  db.prepare(`
    INSERT INTO assets (id, kind, filename, mime_type, size_bytes, width, height, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    asset.id,
    asset.kind,
    asset.filename,
    asset.mimeType,
    asset.sizeBytes,
    asset.width,
    asset.height,
    asset.data
  );
}

export function listAssets(limit = 80) {
  return db.prepare(`
    SELECT id, kind, filename, mime_type AS mimeType, size_bytes AS sizeBytes, width, height, created_at AS createdAt
    FROM assets
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

export function getAsset(id) {
  return db.prepare(`
    SELECT id, kind, filename, mime_type AS mimeType, size_bytes AS sizeBytes, width, height, data, created_at AS createdAt
    FROM assets
    WHERE id = ?
  `).get(id);
}

export function createJob(job) {
  db.prepare(`
    INSERT INTO jobs (id, prompt, model_label, size_label, width, height, mode, status, input_asset_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id,
    job.prompt,
    job.modelLabel,
    job.sizeLabel,
    job.width,
    job.height,
    job.mode,
    job.status,
    job.inputAssetIds
  );
}

export function finishJob(id, status, outputAssetIds = [], error = null) {
  db.prepare(`
    UPDATE jobs
    SET status = ?, output_asset_ids = ?, error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, JSON.stringify(outputAssetIds), error, id);
}

export function listJobs(limit = 40) {
  return db.prepare(`
    SELECT
      id,
      prompt,
      model_label AS modelLabel,
      size_label AS sizeLabel,
      width,
      height,
      mode,
      status,
      error,
      input_asset_ids AS inputAssetIds,
      output_asset_ids AS outputAssetIds,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM jobs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit).map((job) => ({
    ...job,
    inputAssetIds: JSON.parse(job.inputAssetIds || "[]"),
    outputAssetIds: JSON.parse(job.outputAssetIds || "[]")
  }));
}
