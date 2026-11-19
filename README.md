# 身体课表 · 迈开腿 管住嘴

把跟练视频（B 站）和私教课排成一张**周课表**，顺手记**饮食**（手掌法）和**体重**，并自动帮你安排、复盘。一个移动端优先的 PWA，**纯本地、离线可用、不上传任何数据**。

线上地址：fit.hiesther.me

## 功能
- **课表**：横屏看整周课程表（练哪里、时长、预估大卡），竖屏看逐日清单。可拖拽改期、📌 固定、🎲 换一个、「有点累」一键换成轻松拉伸。
- **自动排课**（`src/scheduler.ts`）：规则简单可解释——同肌群间隔约 48h、两天暴汗不相邻、手动/私教/已完成的课为锚点不动，再按喜好 + 间隔 + 多样性 + 力量配额打分选卡。
- **卡片库**：粘贴 B 站链接/分享文案即可自动抓取标题封面时长并猜标签；也能手动建私教课卡片。**你自己新增的卡片会保存在本机，并包含在备份里。**
- **饮食**：蛋白质掌 / 蔬菜拳 / 主食捧 / 油脂拇指 的手掌法份数记录。
- **进度**：体重趋势（看 7 天平均）、训练量、周报。

## 数据与隐私
所有数据都存在**这台设备的浏览器 localStorage** 里，没有账号、没有服务器、离线也能用。换设备或备份用「数据 → 备份与搬家」：
- **导出备份 / 导入备份**：一个 JSON 文件，含全部数据（卡片库、课表、饮食、体重）——这才是搬家/还原用的。
- **导出周报**：Markdown，给人看或丢给 AI 用的摘要，**不能**导回。

## 技术栈
React 19 · TypeScript · Vite · `@dnd-kit/core`（拖拽）· PWA（manifest + service worker）。无后端依赖。

## 本地开发
```bash
npm install
npm run dev      # 本地预览
npm run build    # 构建到 dist/
npm test         # vitest 单测
npm run lint     # oxlint
```

## 部署
站点是 **GitHub Pages**，走"构建产物推到 `gh-pages` 分支"的方式：
- `main` = 源码；`gh-pages` = 编译好的 `dist/`（线上真正跑的是它）。
- 所以**只推 `main` 不会更新网站**，需要 `npm run build` 后把 `dist` 提交并推到 `gh-pages`。
- 自定义域名 `fit.hiesther.me` 在 GitHub Pages 设置里配置（仓库内无 CNAME 文件）。

## 目录结构
```
src/
  App.tsx          # 四个 tab 的外壳
  Board.tsx        # 课表看板（含自动排课、拖拽、体感）
  Timetable.tsx    # 横屏整周课程表
  Library.tsx      # 卡片库 + 推荐
  CardEditor.tsx   # 卡片编辑（B 站抓取 / 私教课）
  Diet.tsx         # 手掌法饮食
  Progress.tsx     # 体重趋势 + 周报
  Account.tsx      # 数据面板：备份与搬家
  scheduler.ts     # 排课规则
  store.ts         # 本地状态（localStorage 读写）
  summary.ts       # 周报快照
  seed.ts          # 内置 starter 卡片库
  types.ts         # 数据模型
  bili.ts / date.ts / energy.ts / ui.tsx
public/            # PWA manifest、service worker、图标
```
