import cors from "cors";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import { createJob, finishJob, getAsset, insertAsset, listAssets, listJobs } from "./db.js";
import { generatePollinationsImage } from "./pollinations.js";
import { resolveSize, SIZE_OPTIONS } from "./sizes.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 12 }
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function imageMetadata(buffer) {
  return { width: null, height: null };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storage: "sqlite-blob", models: ["Image 2", "Nano Banana"], sizes: SIZE_OPTIONS });
});

app.post("/api/uploads", upload.array("images", 12), async (req, res, next) => {
  try {
    const files = req.files || [];
    const assets = [];

    for (const file of files) {
      if (!file.mimetype.startsWith("image/")) continue;
      const id = newId("asset");
      const meta = await imageMetadata(file.buffer);
      insertAsset({
        id,
        kind: "upload",
        filename: file.originalname || `${id}.png`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        width: meta.width,
        height: meta.height,
        data: file.buffer
      });
      assets.push({ id, kind: "upload", filename: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, ...meta });
    }

    res.json({ assets });
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate", async (req, res, next) => {
  const { prompt, modelLabel = "Image 2", sizeLabel = "1024x1536", count = 1, inputAssetIds = [], mode = "standard" } = req.body;
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  const safeCount = Math.min(Math.max(Number(count) || 1, 1), 6);
  const { width, height } = resolveSize(sizeLabel);
  const jobId = newId("job");

  createJob({
    id: jobId,
    prompt: cleanPrompt,
    modelLabel,
    sizeLabel,
    width,
    height,
    mode,
    status: "running",
    inputAssetIds: JSON.stringify(inputAssetIds)
  });

  try {
    const outputAssetIds = [];
    for (let index = 0; index < safeCount; index += 1) {
      const result = await generatePollinationsImage({
        prompt: mode === "amazon-a-plus" ? `${cleanPrompt}. Amazon A+ ecommerce detail page banner, premium product layout, 1463 by 600 composition.` : cleanPrompt,
        width,
        height,
        modelLabel,
        seed: Date.now() + index
      });

      const id = newId("asset");
      const meta = await imageMetadata(result.buffer);
      insertAsset({
        id,
        kind: "generated",
        filename: `${jobId}-${index + 1}.png`,
        mimeType: result.mimeType,
        sizeBytes: result.buffer.length,
        width: meta.width,
        height: meta.height,
        data: result.buffer
      });
      outputAssetIds.push(id);
    }

    finishJob(jobId, "succeeded", outputAssetIds);
    res.json({ jobId, status: "succeeded", outputAssetIds });
  } catch (error) {
    finishJob(jobId, "failed", [], error.message);
    next(error);
  }
});

app.post("/api/stitch", async (req, res, next) => {
  try {
    const { assetIds = [], prompt = "Amazon A+ stitched detail banner" } = req.body;
    const selected = assetIds.map((id) => getAsset(id)).filter(Boolean).slice(0, 4);
    if (!selected.length) {
      res.status(400).json({ error: "At least one asset is required." });
      return;
    }

    const width = 1463;
    const height = 600;
    const tileWidth = Math.floor(width / selected.length);
    const imageNodes = selected.map((asset, index) => {
      const href = `data:${asset.mimeType};base64,${Buffer.from(asset.data).toString("base64")}`;
      return `<image href="${href}" x="${index * tileWidth}" y="0" width="${tileWidth}" height="${height}" preserveAspectRatio="xMidYMid slice" />`;
    }).join("");
    const canvas = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#282828"/>
        ${imageNodes}
        <rect width="100%" height="100%" fill="none" stroke="rgba(255,255,255,0.08)"/>
        <text x="48" y="545" fill="#ffffff" font-family="Inter, Noto Sans SC, sans-serif" font-size="28" font-weight="700">${escapeXml(prompt).slice(0, 90)}</text>
      </svg>
    `);

    const outputId = newId("asset");
    insertAsset({
      id: outputId,
      kind: "stitched",
      filename: `${outputId}.svg`,
      mimeType: "image/svg+xml",
      sizeBytes: canvas.length,
      width,
      height,
      data: canvas
    });

    const jobId = newId("job");
    createJob({
      id: jobId,
      prompt,
      modelLabel: "Stitch",
      sizeLabel: "Amazon A+ 1463x600",
      width,
      height,
      mode: "stitch",
      status: "succeeded",
      inputAssetIds: JSON.stringify(assetIds)
    });
    finishJob(jobId, "succeeded", [outputId]);

    res.json({ jobId, outputAssetIds: [outputId] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assets", (_req, res) => {
  res.json({ assets: listAssets() });
});

app.get("/api/assets/:id", (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  res.setHeader("Content-Type", asset.mimeType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(asset.data);
});

app.get("/api/assets/:id/download", (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  res.setHeader("Content-Type", asset.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${asset.filename}"`);
  res.send(asset.data);
});

app.get("/api/jobs", (_req, res) => {
  res.json({ jobs: listJobs() });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "Unexpected server error." });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Image Studio API listening on http://localhost:${port}`);
});
