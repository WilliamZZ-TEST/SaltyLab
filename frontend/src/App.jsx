import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeHelp,
  Boxes,
  CheckCircle2,
  Clipboard,
  CloudUpload,
  Copy,
  Download,
  FileImage,
  ImagePlus,
  Layers3,
  Loader2,
  Maximize2,
  PanelRight,
  RefreshCcw,
  Send,
  Sparkles,
  Upload,
  Wand2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

const sizeOptions = [
  "2K",
  "4K",
  "3840x2160",
  "2160x3840",
  "1024x1536",
  "1536x1024",
  "Amazon A+ 1463x600"
];

const modeCards = [
  { id: "standard", title: "标准生成", note: "通用图片生成" },
  { id: "amazon-a-plus", title: "Amazon A+", note: "1463x600 电商详情页模块" },
  { id: "batch", title: "多图生成", note: "同一提示词批量出图" }
];

function assetUrl(id) {
  return `${API_BASE}/api/assets/${id}`;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function App() {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploadedAssets, setUploadedAssets] = useState([]);
  const [prompt, setPrompt] = useState("请根据上传图片生成一张适合 Amazon A+ 详情页的横幅，保持商品真实，画面干净，有高级电商质感。");
  const [modelLabel, setModelLabel] = useState("Image 2");
  const [sizeLabel, setSizeLabel] = useState("Amazon A+ 1463x600");
  const [count, setCount] = useState(1);
  const [mode, setMode] = useState("amazon-a-plus");
  const [jobs, setJobs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const [error, setError] = useState("");

  const selectedAssetIds = useMemo(() => uploadedAssets.map((asset) => asset.id), [uploadedAssets]);

  const loadData = useCallback(async () => {
    const [jobsResponse, assetsResponse] = await Promise.all([
      fetch(`${API_BASE}/api/jobs`),
      fetch(`${API_BASE}/api/assets`)
    ]);
    const jobsData = await jobsResponse.json();
    const assetsData = await assetsResponse.json();
    setJobs(jobsData.jobs || []);
    setAssets(assetsData.assets || []);
  }, []);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  useEffect(() => {
    const onPaste = (event) => {
      const pasted = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (pasted.length) addFiles(pasted);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function addFiles(incoming) {
    const imageFiles = incoming.filter((file) => file.type.startsWith("image/")).slice(0, 12);
    const mapped = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name || "pasted-image.png",
      preview: URL.createObjectURL(file),
      size: file.size
    }));
    setFiles((current) => [...current, ...mapped].slice(0, 12));
    setError("");
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function uploadPendingFiles() {
    if (!files.length) return uploadedAssets;
    const formData = new FormData();
    files.forEach((item) => formData.append("images", item.file, item.name));
    const response = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      body: formData
    });
    if (!response.ok) throw new Error("图片上传失败");
    const data = await response.json();
    setUploadedAssets((current) => [...data.assets, ...current]);
    setFiles([]);
    await loadData();
    return data.assets;
  }

  async function generate() {
    setError("");
    setIsGenerating(true);
    try {
      const uploaded = await uploadPendingFiles();
      const inputAssetIds = [...uploaded.map((asset) => asset.id), ...selectedAssetIds];
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          modelLabel,
          sizeLabel,
          count,
          mode,
          inputAssetIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成失败");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function stitch() {
    setError("");
    setIsGenerating(true);
    try {
      const uploaded = await uploadPendingFiles();
      const assetIds = [...uploaded.map((asset) => asset.id), ...selectedAssetIds];
      if (!assetIds.length) throw new Error("请先上传或选择至少一张图片");
      const response = await fetch(`${API_BASE}/api/stitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds, prompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "拼接失败");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  function copyJobPrompt(text) {
    navigator.clipboard?.writeText(text);
  }

  const latestOutputs = jobs.flatMap((job) => job.outputAssetIds || []).slice(0, 6);

  return (
    <div className="app-shell">
      <video className="video-bg" autoPlay muted loop playsInline>
        <source src="https://cdn.pixabay.com/video/2024/02/16/201245-913585856_large.mp4" type="video/mp4" />
      </video>
      <div className="backdrop" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <div>
            <p>AI STUDIO</p>
            <h1>AI图片大师</h1>
          </div>
        </div>
        <div className="credit-box">
          <span>可用点数</span>
          <strong>42860</strong>
        </div>
        <nav>
          <button className="active"><Wand2 size={18} /> 生成图片</button>
          <button><Layers3 size={18} /> 批量生成</button>
          <button><Boxes size={18} /> 图片空间</button>
          <button><PanelRight size={18} /> API 输入</button>
        </nav>
        <div className="recent">
          <h2>最近流水</h2>
          {jobs.slice(0, 5).map((job) => (
            <div key={job.id}>
              <span>{job.mode}</span>
              <b>{job.status === "succeeded" ? "成功" : job.status}</b>
            </div>
          ))}
        </div>
      </aside>

      <main className="workbench">
        <header className="topbar">
          <div>
            <p>WORKBENCH</p>
            <h2>新建任务</h2>
          </div>
          <button className="submit-ticket"><Send size={16} /> 提交真实任务</button>
        </header>

        <section className="grid">
          <motion.div className="panel upload-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="panel-title">
              <h3>1. 图片</h3>
              <span>{files.length + uploadedAssets.length}/12</span>
            </div>
            <button
              type="button"
              className={`dropzone ${isDragging ? "dragging" : ""}`}
              onClick={openFilePicker}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(Array.from(event.dataTransfer.files || []));
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(event) => addFiles(Array.from(event.target.files || []))}
              />
              <CloudUpload size={34} />
              <strong>点击上传 / 拖入 / 粘贴图片</strong>
              <span>支持 PNG/JPG/WebP，最多 12 张，单图 20MB</span>
            </button>
            <AnimatePresence>
              {!!files.length && (
                <motion.div className="thumb-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {files.map((item) => (
                    <div className="thumb" key={item.id}>
                      <img src={item.preview} alt={item.name} />
                      <button onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}><X size={14} /></button>
                      <span>{formatBytes(item.size)}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div className="panel prompt-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <div className="panel-title">
              <h3>2. Prompt</h3>
              <span>{prompt.length}/3000</span>
            </div>
            <div className="chips">
              {["自由编辑", "单人换装", "多图拼接", "换印花", "锁面料", "A+详情页"].map((chip) => (
                <button key={chip}><Sparkles size={14} /> {chip}</button>
              ))}
            </div>
            <input className="task-title" placeholder="任务标题，可空" />
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 3000))} />
          </motion.div>

          <motion.div className="panel settings-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="panel-title">
              <h3>3. 输出</h3>
              <span>图像生成</span>
            </div>
            <label>图像引擎</label>
            <select value={modelLabel} onChange={(event) => setModelLabel(event.target.value)}>
              <option>Image 2</option>
              <option>Nano Banana</option>
            </select>
            <label>尺寸</label>
            <select value={sizeLabel} onChange={(event) => setSizeLabel(event.target.value)}>
              {sizeOptions.map((size) => <option key={size}>{size}</option>)}
            </select>
            <label>数量</label>
            <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value}>{value}</option>)}
            </select>
            <div className="mode-grid">
              {modeCards.map((card) => (
                <button className={mode === card.id ? "selected" : ""} key={card.id} onClick={() => setMode(card.id)}>
                  <Sparkles size={16} />
                  <strong>{card.title}</strong>
                  <span>{card.note}</span>
                </button>
              ))}
            </div>
            <div className="cost-box">
              <span>本次标准生成</span>
              <strong>{150 * count} 点</strong>
            </div>
          </motion.div>
        </section>

        <section className="actions">
          <button className="primary" disabled={isGenerating} onClick={generate}>
            {isGenerating ? <Loader2 className="spin" size={20} /> : <Wand2 size={20} />}
            开始生成
          </button>
          <button className="secondary" disabled={isGenerating} onClick={stitch}>
            <ImagePlus size={20} />
            多图拼接 1463x600
          </button>
          <button className="ghost" onClick={() => { setFiles([]); setUploadedAssets([]); }}>
            <RefreshCcw size={18} /> 清空
          </button>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="output-strip">
          <div className="section-title">
            <h3>生成结果</h3>
            <span>点击缩略图放大查看</span>
          </div>
          <div className="result-grid">
            {latestOutputs.length ? latestOutputs.map((assetId) => (
              <motion.button className="result-card" key={assetId} whileHover={{ y: -4 }} onClick={() => setActivePreview(assetId)}>
                <img src={assetUrl(assetId)} alt="生成图片" />
                <span><Maximize2 size={14} /> 预览</span>
              </motion.button>
            )) : (
              <div className="empty">
                <FileImage size={46} />
                <p>生成的图片将在这里显示</p>
              </div>
            )}
          </div>
        </section>

        <section className="history">
          <div className="section-title">
            <h3>任务历史</h3>
            <span>{jobs.length}/40</span>
          </div>
          {jobs.map((job) => (
            <article className="job-card" key={job.id}>
              <div className="job-head">
                <div>
                  <h4>{job.prompt}</h4>
                  <p>{job.createdAt} · {job.modelLabel} · {job.sizeLabel}</p>
                </div>
                <div className={`status ${job.status}`}><CheckCircle2 size={15} /> {job.status}</div>
              </div>
              <p className="job-prompt">{job.prompt}</p>
              <div className="job-thumbs">
                {(job.outputAssetIds || []).map((assetId) => (
                  <button key={assetId} onClick={() => setActivePreview(assetId)}>
                    <img src={assetUrl(assetId)} alt="历史输出" />
                  </button>
                ))}
              </div>
              <div className="job-actions">
                {(job.outputAssetIds || []).map((assetId) => (
                  <a key={assetId} href={`${API_BASE}/api/assets/${assetId}/download`}>
                    <Download size={15} /> 下载
                  </a>
                ))}
                <button onClick={() => copyJobPrompt(job.prompt)}><Copy size={15} /> 复制 prompt</button>
              </div>
            </article>
          ))}
        </section>
      </main>

      <AnimatePresence>
        {activePreview && (
          <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-body" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <button className="modal-close" onClick={() => setActivePreview(null)}><X size={20} /></button>
              <img src={assetUrl(activePreview)} alt="放大预览" />
              <a href={`${API_BASE}/api/assets/${activePreview}/download`}><Download size={16} /> 下载图片</a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
