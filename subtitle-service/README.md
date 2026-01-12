# Railway Subtitle Service

独立的 YouTube 字幕服务，使用 yt-dlp 获取字幕。

## 本地开发

```bash
cd subtitle-service
npm install
npm run dev
```

## 部署到 Railway

1. 在 Railway 创建新项目
2. 连接 GitHub 仓库（或使用 Railway CLI）
3. Railway 会自动检测 Dockerfile 并构建
4. 设置环境变量 `ALLOWED_ORIGINS` 为你的前端域名

## API 端点

- `GET /health` - 健康检查
- `GET /api/metadata?videoId=xxx` - 获取视频信息
- `GET /api/transcript?videoId=xxx&lang=en` - 获取字幕

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3001 |
| `ALLOWED_ORIGINS` | 允许的 CORS 来源 | * |
