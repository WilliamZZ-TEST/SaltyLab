# AI 图片大师 - 前后端分离第一版

仓库名建议：`SaltyLab`

## 发布到 GitHub / Gitee

当前项目提供无需本地 Git 的 API 发布脚本。

GitHub：

```powershell
powershell -ExecutionPolicy Bypass -File tools\publish-github-api.ps1 -Owner 你的GitHub用户名 -Token 你的GitHubToken
```

Gitee：

```powershell
powershell -ExecutionPolicy Bypass -File tools\publish-gitee-api.ps1 -Owner 你的Gitee用户名 -Token 你的GiteeToken
```

GitHub Pages 使用 `.github/workflows/pages.yml` 自动部署 `docs/` 目录。
Gitee Pages 通常需要在仓库页面手动开启：`服务 > Gitee Pages`。

## 已实现范围

- 前台工作台：上传图片、Prompt、模型选择、尺寸选择、生成方式、历史记录。
- 多图输入：点击上传、拖拽上传、粘贴图片。
- 模型显示：前台显示 `Image 2` 与 `Nano Banana`。
- 生成接口：第一版底层统一调用 Pollinations。
- 图片存储：SQLite 数据库，图片以原始二进制 `BLOB` 存储。
- 输出：缩略图、点击放大、下载。
- 历史记录：缩略图、Prompt、尺寸、模型、状态。
- Amazon A+：支持 `1463x600` 输出尺寸，并提供多图拼接接口。

## 目录结构

```text
image-studio/
  backend/
    src/
      db.js             SQLite BLOB 存储
      pollinations.js   Pollinations 图片生成代理
      server.js         API 服务
      sizes.js          输出尺寸映射
  frontend/
    src/
      App.jsx           前台工作台
      styles.css        UI 主题与布局
```

## 启动方式

需要本机有 Node.js 与 npm。

如果没有 Node.js，先运行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\ensure-environment.ps1
```

脚本会依次尝试官方源和国内镜像源：

```text
https://nodejs.org/dist/latest-v24.x/node-v24.18.0-win-x64.zip
https://nodejs.org/dist/v24.18.0/node-v24.18.0-win-x64.zip
https://npmmirror.com/mirrors/node/latest-v24.x/node-v24.18.0-win-x64.zip
https://npmmirror.com/mirrors/node/v24.18.0/node-v24.18.0-win-x64.zip
```

如果自动下载仍失败，请手动下载其中一个文件并保存到：

```text
runtime/downloads/node-v24.18.0-win-x64.zip
```

然后运行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\install-dependencies.ps1
```

一键启动开发服务：

```powershell
powershell -ExecutionPolicy Bypass -File tools\start-dev.ps1
```

如果当前环境禁止 npm 访问外网，可以启动零依赖版本：

```powershell
powershell -ExecutionPolicy Bypass -File tools\start-standalone.ps1
```

或手动执行：

```bash
npm run setup
npm run dev
```

默认地址：

- 前台：`http://127.0.0.1:5173`
- 后端：`http://localhost:8787`

## 后端接口

| 接口 | 方法 | 作用 |
|---|---|---|
| `/api/health` | GET | 健康检查 |
| `/api/uploads` | POST | 上传多张图片 |
| `/api/generate` | POST | 调用 Pollinations 生成图片 |
| `/api/stitch` | POST | 多图拼接为 Amazon A+ 1463x600 |
| `/api/jobs` | GET | 获取历史任务 |
| `/api/assets` | GET | 获取图片空间元数据 |
| `/api/assets/:id` | GET | 读取图片 |
| `/api/assets/:id/download` | GET | 下载图片 |

## 当前约束

- 第一版不做真实登录与后台账号管理。
- `Image 2` 与 `Nano Banana` 只是前台模型名，底层统一路由到 Pollinations。
- SQLite BLOB 适合第一版验证；生产环境图片量大后建议迁移到对象存储。
- Pollinations 公开接口对多图输入的支持有限，因此第一版会存储输入图并生成任务记录，生成本身以 Prompt 为主。
- 后端使用 Node.js 内置 `node:sqlite`，因此需要 Node.js 24 或更新版本。
