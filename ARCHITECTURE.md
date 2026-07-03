# AI Studio 架构复现说明

## 页面架构

目标站前台是单页工作台，核心结构如下：

1. 左侧账号栏
   - 品牌标题：`AI STUDIO`
   - 产品口号：`按图序写需求，直接出图`
   - 用户信息：姓名、邮箱、团队、角色
   - 可用点数
   - 最近流水：`job_capture`、`job_freeze`

2. 中间工作台
   - `1. 图片`：最多 7 张，点击上传、拖入上传、支持 PNG/JPG/WebP，单图 20MB，大图压缩。
   - `2. Prompt`：任务标题、提示词、3000 字计数、预设模板。
   - `3. 输出`：模型、尺寸、质量、生成方式、冻结点数说明。

3. 任务历史
   - 每条任务包含：标题、时间、状态、模型、尺寸、质量、点数、任务 ID。
   - 操作包含：载入重跑、复制 ID、复制 prompt、查看输入图、预览输出图、下载、继续修改。
   - 状态链路：草稿、排队中、生成中、已成功、已完成。

## 生成方式

| 模式 | 逻辑 | 点数 |
|---|---|---:|
| 标准生成 | GPT Image 2 按当前 prompt 生成 1 组结果 | 150 |
| 原稿/优化稿对比 | 当前 prompt + 优化后 prompt，共 2 组结果 | 300 |
| 参考图批量调色 | 图1锁定主体，图2起逐张提取色调 | 150 |
| 构图转高清 | GPT Image 2 先出构图稿，Nano Banana Pro 再出高清稿 | 550 |
| 双引擎对比 | GPT Image 2 + Nano Banana Pro 各 1 张 | 330 |
| 全量对比 | 原稿 + 优化稿 × 双引擎，共 4 张 | 600 |

## 后端模块

1. Upload
   - 接收图片，写入 SQLite `assets` 表。
   - 存储方式：原始二进制 BLOB。

2. Job
   - 创建任务，记录 prompt、模型、尺寸、质量、模式、点数、输入图、输出图。
   - 第一版状态直接完成；真实生产应进入队列：`draft -> queued -> running -> succeeded -> completed`。

3. Model Router
   - 前台显示 `GPT Image 2` 和 `Nano Banana Pro Beta`。
   - 第一版底层统一走 Pollinations；网络不可用时返回 SVG 占位图保证链路可测。

4. Assets
   - 提供图片空间列表。
   - 提供图片预览和下载。

5. Admin
   - 用户、角色、点数、API Key、任务数、存储量、失败率。
   - 当前版本是模拟后台数据，接口为 `/api/admin/summary`。

## 本地接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/uploads` | POST | 上传图片，写入 BLOB |
| `/api/generate` | POST | 创建生成任务 |
| `/api/jobs` | GET | 任务历史 |
| `/api/assets` | GET | 图片空间列表 |
| `/api/assets/:id` | GET | 图片预览/下载 |
| `/api/admin/summary` | GET | 后台概览 |
