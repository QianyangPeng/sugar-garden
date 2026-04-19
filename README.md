# 糖糖花园 · Sugar Garden

一个多家庭共用、云端同步的儿童糖分摄入记录工具。

设计来自 [Claude Design](https://claude.ai/design)；后端是 Cloudflare Workers + D1。

**在线体验**：https://qianyangpeng.github.io/sugar-garden/

## What

- 四步引导输入小朋友姓名、生日、每日糖分上限（WHO 参考值）
- 每次吃糖记一笔（24 种预设食物 + 自定义克数）
- 每日一朵花：糖量越少花越精神，连续达标解锁稀有花种
- 家庭共享：爸爸、妈妈、长辈都可以加入同一个花园一起记录
- 数据在 D1，手机间实时同步
- 离线也能记，联网自动上传

## Architecture

```
手机 (iOS/Android)
  ├─ Safari/Chrome 打开 https://…/sugar-garden/
  ├─ 前端：单页 React（Babel 浏览器内编译，无构建步骤）
  ├─ 本地状态：localStorage（namespaced by family）
  └─ 邀请链接走 URL fragment (#join=…) —— 服务器日志看不到
          ↕ HTTPS
Cloudflare Worker (edge, 全球 300+ 节点)
  ├─ 路由：/family, /member, /entry, /school-sugar, /sync
  ├─ 鉴权：Bearer <familyToken>  →  服务器只存 sha256
  ├─ 防滥用：Turnstile (注册) + Rate Limit (IP 5/min, family 300/hr)
  └─ 清理：Cron 每周删除 60 天无活动的家庭
          ↕
Cloudflare D1 (SQLite at edge)
  families · members · entries · school_sugar
```

### Why these choices

- **Cloudflare Workers**: 免费 10 万请求/天对家用足够；全球边缘节点延迟低。
- **D1 (SQLite)**: 强一致性 + SQL 增量同步 (`WHERE updated_at > ?`) 比 KV 干净。
- **客户端生成 token**: 服务器永远看不到 token 明文，只存 sha256。即使我（部署者）查数据库也拿不到 token。
- **URL fragment 传邀请**: `#` 后的部分不会发送到服务器，CF 日志和 git 历史都不会记录邀请。
- **Append-only entries**: 客户端生成 UUID，两人同时录入零冲突。删除是软删除，同步时传播。
- **确定性花朵**: 种子用 `familyId + date`，同一家庭所有设备同一天看到同一朵花。

### Security notes

- 服务器**只存 token 哈希**，不存明文。
- Turnstile 防止机器人批量注册新家庭。
- 每家每小时最多 300 次写入，单 IP 每分钟最多 5 次注册。
- 免费档用完会自动降级 `/family` 返 503，不会爆账单。
- 邀请链接 = 密码：只发给信任的家人。泄露了用"重新生成邀请链接"吊销。
- **没有端到端加密**。部署者（你）有 D1 只读权限可以看到所有家庭的数据内容（不是 token）。如果你想做 E2E，是后续工作。

## Repo layout

```
sugar-garden/
├── index.html              # 单页前端入口（SG_CONFIG 在这里填）
├── manifest.json           # PWA 安装清单
├── sw.js                   # Service Worker（离线缓存）
├── icon.svg                # 应用图标
├── src/
│   ├── data.jsx            # 食物/花朵/状态/本地存储
│   ├── sync.jsx            # 身份、API、邀请链接、离线队列
│   ├── flowers.jsx         # SVG 花朵渲染
│   ├── screens.jsx         # 所有屏幕组件
│   └── app.jsx             # 顶层状态机、家庭门禁
├── worker/
│   ├── src/index.ts        # Worker 代码
│   ├── schema.sql          # D1 表结构
│   ├── wrangler.toml       # CF 绑定配置
│   └── package.json
├── .github/workflows/
│   └── pages.yml           # 推 main 自动部署到 Pages
└── HANDOFF.md              # 👉 你要做的事（5 步）
```

## Deploy your own

**看 [HANDOFF.md](./HANDOFF.md)** —— 一步步带你走。大概 20 分钟，不需要信用卡，全部免费档。

简要：
1. 注册 Cloudflare 账号，装 `wrangler`
2. 创建 D1 数据库 + KV 命名空间，ID 填进 `worker/wrangler.toml`
3. 在 Cloudflare Turnstile 创建站点，`wrangler secret put TURNSTILE_SECRET`
4. `wrangler deploy` 得到 Worker URL
5. 把 Worker URL + Turnstile siteKey 填进 `index.html` 里的 `SG_CONFIG`
6. push 到 GitHub，开启 Pages

## License

MIT
