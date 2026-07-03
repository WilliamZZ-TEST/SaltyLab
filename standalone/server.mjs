import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const staticRoot = path.join(root, "static-preview");
const dataRoot = path.join(root, "runtime");
const dbPath = path.join(dataRoot, "standalone.sqlite");
const port = Number(process.env.PORT || 5173);

mkdirSync(dataRoot, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    model_label TEXT NOT NULL,
    size_label TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    count INTEGER NOT NULL DEFAULT 1,
    quality TEXT NOT NULL DEFAULT '精细',
    points INTEGER NOT NULL DEFAULT 150,
    input_asset_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    output_asset_ids TEXT NOT NULL DEFAULT '[]',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS model_configs (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    api_base TEXT,
    api_key TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec("ALTER TABLE jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'standard'"); } catch {}
try { db.exec("ALTER TABLE jobs ADD COLUMN count INTEGER NOT NULL DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE jobs ADD COLUMN quality TEXT NOT NULL DEFAULT '精细'"); } catch {}
try { db.exec("ALTER TABLE jobs ADD COLUMN points INTEGER NOT NULL DEFAULT 150"); } catch {}
try { db.exec("ALTER TABLE jobs ADD COLUMN input_asset_ids TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE model_configs ADD COLUMN api_key TEXT"); } catch {}

const defaultModels = [
  ["image2", "GPT Image 2", "image2", "gpt-image-2", "", 1, "默认图片生成模型"],
  ["nano-banana", "Nano Banana Pro Beta", "nano-banana", "nano-banana-pro", "", 1, "高清重绘与构图增强"],
  ["seedream-5", "Seedream 5", "seedream", "seedream-5", "", 0, "预留新增模型入口"]
];

for (const model of defaultModels) {
  db.prepare(`
    INSERT OR IGNORE INTO model_configs (id, label, provider, model_id, api_base, enabled, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(...model);
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function insertAsset({ kind, filename, mimeType, data }) {
  const assetId = id("asset");
  db.prepare(`
    INSERT INTO assets (id, kind, filename, mime_type, size_bytes, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(assetId, kind, filename, mimeType, data.length, data);
  return assetId;
}

function createPlaceholderSvg(prompt) {
  const safe = String(prompt).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1463" height="600" viewBox="0 0 1463 600">
      <rect width="1463" height="600" fill="#282828"/>
      <rect x="36" y="36" width="1391" height="528" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
      <text x="72" y="132" fill="#c76efa" font-family="Arial, sans-serif" font-size="56" font-weight="700">AI图片大师</text>
      <text x="72" y="210" fill="#ffffff" font-family="Arial, sans-serif" font-size="28">Amazon A+ 1463x600 预览图</text>
      <text x="72" y="284" fill="rgba(255,255,255,0.72)" font-family="Arial, sans-serif" font-size="22">${safe.slice(0, 90)}</text>
      <text x="72" y="520" fill="rgba(255,255,255,0.72)" font-family="Arial, sans-serif" font-size="18">当前网络阻止模型接口访问时，系统返回此占位图用于链路测试。</text>
    </svg>
  `);
}

function pointsForMode(mode) {
  return {
    standard: 150,
    optimize: 300,
    color: 150,
    hd: 550,
    compare: 330,
    full: 600,
    stitch: 150
  }[mode] || 150;
}

async function handleGenerate(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const prompt = String(body.prompt || "Amazon A+ ecommerce banner").trim();
  const modelLabel = String(body.modelLabel || "Image 2");
  const sizeLabel = String(body.sizeLabel || "Amazon A+ 1463x600");
  const mode = String(body.mode || "standard");
  const count = Math.min(Math.max(Number(body.count || 1), 1), 4);
  const quality = String(body.quality || "精细");
  const inputAssetIds = Array.isArray(body.inputAssetIds) ? body.inputAssetIds : [];
  const points = pointsForMode(mode);
  const jobId = id("job");
  let status = "succeeded";
  let error = null;
  const outputAssetIds = [];

  for (let index = 0; index < count; index += 1) {
    let buffer;
    let mimeType = "image/svg+xml";
    try {
      const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
      url.searchParams.set("width", sizeLabel.includes("1463") ? "1463" : "1024");
      url.searchParams.set("height", sizeLabel.includes("1463") ? "600" : "1536");
      url.searchParams.set("model", modelLabel.includes("Nano") ? "flux" : "turbo");
      url.searchParams.set("seed", String(Date.now() + index));
      url.searchParams.set("nologo", "true");
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      buffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get("content-type") || "image/jpeg";
    } catch (err) {
      buffer = createPlaceholderSvg(`${prompt} #${index + 1}`);
      error = `Pollinations unavailable in current environment: ${err.message}`;
    }
    outputAssetIds.push(insertAsset({ kind: mode === "stitch" ? "stitched" : "generated", filename: `${jobId}-${index + 1}.svg`, mimeType, data: buffer }));
  }

  db.prepare(`
    INSERT INTO jobs (id, prompt, model_label, size_label, mode, count, quality, points, input_asset_ids, status, output_asset_ids, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(jobId, prompt, modelLabel, sizeLabel, mode, count, quality, points, JSON.stringify(inputAssetIds), status, JSON.stringify(outputAssetIds), error);
  json(res, 200, { jobId, status, outputAssetIds, points, error });
}

async function handleUpload(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const assets = [];
  for (const image of body.images || []) {
    const data = Buffer.from(String(image.data || ""), "base64");
    const assetId = insertAsset({
      kind: "upload",
      filename: image.filename || `${id("upload")}.png`,
      mimeType: image.mimeType || "image/png",
      data
    });
    assets.push({ id: assetId, filename: image.filename, mimeType: image.mimeType, sizeBytes: data.length });
  }
  json(res, 200, { assets });
}

function handleAsset(req, res, assetId) {
  const asset = db.prepare("SELECT filename, mime_type AS mimeType, data FROM assets WHERE id = ?").get(assetId);
  if (!asset) return json(res, 404, { error: "Asset not found" });
  res.writeHead(200, { "content-type": asset.mimeType, "cache-control": "no-store" });
  res.end(asset.data);
}

function handleJobs(_req, res) {
  const jobs = db.prepare(`
    SELECT id, prompt, model_label AS modelLabel, size_label AS sizeLabel, mode, count, quality, points, input_asset_ids AS inputAssetIds, status, output_asset_ids AS outputAssetIds, error, created_at AS createdAt
    FROM jobs ORDER BY created_at DESC LIMIT 40
  `).all().map((job) => ({ ...job, inputAssetIds: JSON.parse(job.inputAssetIds || "[]"), outputAssetIds: JSON.parse(job.outputAssetIds || "[]") }));
  json(res, 200, { jobs });
}

function handleAssets(_req, res) {
  const assets = db.prepare(`
    SELECT id, kind, filename, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt
    FROM assets ORDER BY created_at DESC LIMIT 120
  `).all();
  json(res, 200, { assets });
}

function handleAdminSummary(_req, res) {
  const jobCount = db.prepare("SELECT COUNT(*) AS count FROM jobs").get().count;
  const assetCount = db.prepare("SELECT COUNT(*) AS count FROM assets").get().count;
  const bytes = db.prepare("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM assets").get().bytes;
  json(res, 200, {
    users: [
      { id: "user_owner", name: "William", email: "william@lancha.test", role: "owner", credits: 42860, status: "active" },
      { id: "user_designer", name: "Designer", email: "designer@lancha.test", role: "operator", credits: 12000, status: "active" },
      { id: "user_api", name: "API Bot", email: "api@lancha.test", role: "api-only", credits: 8000, status: "limited" }
    ],
    metrics: { jobCount, assetCount, bytes, apiKeys: 2 }
  });
}

function handleModelConfigs(_req, res) {
  const models = db.prepare(`
    SELECT id, label, provider, model_id AS modelId, api_base AS apiBase, api_key AS apiKey, enabled, notes, updated_at AS updatedAt
    FROM model_configs
    ORDER BY CASE id WHEN 'image2' THEN 1 WHEN 'nano-banana' THEN 2 WHEN 'seedream-5' THEN 3 ELSE 9 END
  `).all().map((model) => ({
    ...model,
    apiKey: undefined,
    hasKey: Boolean(model.apiKey),
    maskedKey: model.apiKey ? `${model.apiKey.slice(0, 4)}...${model.apiKey.slice(-4)}` : "",
    enabled: Boolean(model.enabled)
  }));
  json(res, 200, { models });
}

async function updateModelConfig(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const modelId = String(body.id || "").trim();
  if (!modelId) return json(res, 400, { error: "id is required" });
  const existing = db.prepare(`
    SELECT label, provider, model_id AS modelId, api_base AS apiBase, api_key AS apiKey, enabled, notes
    FROM model_configs
    WHERE id = ?
  `).get(modelId);
  const apiKey = Object.prototype.hasOwnProperty.call(body, "apiKey")
    ? String(body.apiKey || "")
    : (existing?.apiKey || "");
  db.prepare(`
    INSERT INTO model_configs (id, label, provider, model_id, api_base, api_key, enabled, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      provider = excluded.provider,
      model_id = excluded.model_id,
      api_base = excluded.api_base,
      api_key = excluded.api_key,
      enabled = excluded.enabled,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    modelId,
    String(body.label ?? existing?.label ?? modelId),
    String(body.provider ?? existing?.provider ?? ""),
    String(body.modelId ?? existing?.modelId ?? modelId),
    String(body.apiBase ?? existing?.apiBase ?? ""),
    apiKey,
    Object.prototype.hasOwnProperty.call(body, "enabled") ? (body.enabled ? 1 : 0) : (existing?.enabled ?? 1),
    String(body.notes ?? existing?.notes ?? "")
  );
  handleModelConfigs(req, res);
}

async function testModelConfig(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const modelId = String(body.id || "").trim();
  const model = db.prepare(`
    SELECT id, label, provider, model_id AS modelId, api_base AS apiBase, api_key AS apiKey, enabled
    FROM model_configs
    WHERE id = ?
  `).get(modelId);
  if (!model) return json(res, 404, { ok: false, error: "model config not found" });
  if (!model.enabled) return json(res, 400, { ok: false, error: "model is disabled" });
  if (!model.apiKey) return json(res, 400, { ok: false, error: "api key is missing" });
  json(res, 200, {
    ok: true,
    model: model.label,
    provider: model.provider,
    modelId: model.modelId,
    apiBase: model.apiBase,
    message: "key config is present; live provider call is not executed in test mode"
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(staticRoot, pathname));
  if (!filePath.startsWith(staticRoot)) return json(res, 403, { error: "Forbidden" });
  if (!existsSync(filePath)) return json(res, 404, { error: "Not found" });
  const ext = path.extname(filePath);
  const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css" : "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  res.end(await readFile(filePath));
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});
    if (req.method === "POST" && req.url === "/api/generate") return handleGenerate(req, res);
    if (req.method === "POST" && req.url === "/api/uploads") return handleUpload(req, res);
    if (req.method === "GET" && req.url === "/api/jobs") return handleJobs(req, res);
    if (req.method === "GET" && req.url === "/api/assets") return handleAssets(req, res);
    if (req.method === "GET" && req.url === "/api/admin/summary") return handleAdminSummary(req, res);
    if (req.method === "GET" && req.url === "/api/admin/models") return handleModelConfigs(req, res);
    if (req.method === "POST" && req.url === "/api/admin/models") return updateModelConfig(req, res);
    if (req.method === "POST" && req.url === "/api/admin/models/test") return testModelConfig(req, res);
    const assetMatch = req.url.match(/^\/api\/assets\/([^/?]+)/);
    if (req.method === "GET" && assetMatch) return handleAsset(req, res, assetMatch[1]);
    return serveStatic(req, res);
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Standalone Image Studio running at http://127.0.0.1:${port}/`);
});
