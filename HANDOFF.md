# HANDOFF: 你要做的事

Claude 已经把所有代码写完了，但有些东西必须在**你自己的 Cloudflare 账号**里才能建起来。这份清单带你走完一遍，完成后花园就活了。

**估计时间**：20–30 分钟，全程免费档。

## 总览（不要跳过）

| 你要做的 | 耗时 | 难度 |
|---|---|---|
| ① 注册 Cloudflare + 装 wrangler | 5 min | ⭐ |
| ② 创建 D1 + KV | 3 min | ⭐ |
| ③ 创建 Turnstile 站点 | 3 min | ⭐ |
| ④ 填 wrangler.toml + 部署 Worker | 3 min | ⭐⭐ |
| ⑤ 填 index.html SG_CONFIG | 1 min | ⭐ |
| ⑥ 推 GitHub + 开 Pages | 5 min | ⭐⭐ |
| ⑦ 用手机测一下 | 2 min | ⭐ |

---

## ① 注册 Cloudflare 账号 + 装 wrangler

1. 去 https://dash.cloudflare.com/sign-up 注册（邮箱即可，不用绑信用卡）。
2. 在本机装 [Node.js 20+](https://nodejs.org/)（如果还没有）。
3. 进 `worker/` 目录装依赖并登录：
   ```bash
   cd worker
   npm install
   npx wrangler login
   ```
   浏览器会弹出授权页，点同意。

---

## ② 创建 D1 数据库 和 KV 命名空间

```bash
# 还在 worker/ 目录
npx wrangler d1 create sugar-garden
```

输出里会有一行 `database_id = "xxxxxxxx-xxxx-..."`，**记下这个 ID**。

```bash
npx wrangler kv namespace create sugar-garden-kv
```

输出里会有 `id = "xxxxx..."`，**也记下**。

把这两个 ID 填到 `worker/wrangler.toml` 里，把 `__REPLACE_ME_D1_ID__` 和 `__REPLACE_ME_KV_ID__` 替换掉。

然后初始化表结构：

```bash
npm run db:init
```

---

## ③ 创建 Cloudflare Turnstile 站点（防机器人注册）

1. 去 https://dash.cloudflare.com → 左侧 **Turnstile** → **Add site**。
2. Site name 随便填，Domain 填 `qianyangpeng.github.io`（或你的 Pages 域名）。
3. Widget mode: **Managed**（推荐），widget type: **Invisible**。
4. 点 Create。你会得到两个字符串：
   - **Site Key**（以 `0x4AAAAA...` 开头，前端用）
   - **Secret Key**（以 `0x4AAAAA...` 开头，后端用）

在 worker 目录把 Secret Key 存到 CF：

```bash
npx wrangler secret put TURNSTILE_SECRET
```

提示时粘贴 Secret Key，回车。

（Site Key 先留着，⑤ 要用。）

---

## ④ 部署 Worker

```bash
# 还在 worker/ 目录
npx wrangler deploy
```

成功后输出会有一行 `Published sugar-garden... → https://sugar-garden.<你的用户名>.workers.dev`。**记下这个 URL**。

测试一下：

```bash
curl https://sugar-garden.<你的用户名>.workers.dev/health
```

应返回 `{"ok":true,"now":...}`。

---

## ⑤ 在前端填 Worker URL + Turnstile Site Key

打开 `index.html`，找到：

```js
window.SG_CONFIG = {
  apiUrl: '',
  turnstileSiteKey: '',
};
```

填成：

```js
window.SG_CONFIG = {
  apiUrl: 'https://sugar-garden.<你的用户名>.workers.dev',
  turnstileSiteKey: '0x4AAAAAAA_你的SiteKey',
};
```

---

## ⑥ 推到 GitHub + 开启 Pages

1. 在 GitHub 新建仓库 `sugar-garden`（public，不要勾 Initialize）。
2. 在本地：

   ```bash
   cd C:\Users\qypen\Documents\Claude\sugar-garden
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/QianyangPeng/sugar-garden.git
   git push -u origin main
   ```

3. 去 https://github.com/QianyangPeng/sugar-garden/settings/pages：
   - **Source**: `GitHub Actions`（不是 Deploy from branch）
4. 回 Actions 标签页等 deploy 跑完（~1 min）。
5. 打开 https://qianyangpeng.github.io/sugar-garden/ 看效果。

如果 Pages 提示要等 Actions 触发，去 Actions 手动触发 "Deploy to GitHub Pages"。

---

## ⑦ 真机测试

1. iPhone Safari / Android Chrome 打开 https://qianyangpeng.github.io/sugar-garden/。
2. 点「开启新家庭」走完四步。
3. 进设置 → 邀请家人 → 复制链接。
4. 用另一台手机（或浏览器无痕窗口）打开这个链接 → 应该直接跳到"加入家人的花园"。
5. 两个设备都录一笔，过 30 秒内应互相看到。

如果两个设备录的都看得到，并且首页的"家人"列表里都有对方 → **成功 🎉**。

---

## 维护与监控

### 看 Worker 日志

```bash
cd worker && npx wrangler tail
```

### 查 D1 数据

```bash
npx wrangler d1 execute sugar-garden --remote --command "SELECT id, child_name, daily_limit FROM families"
```

### 免费额度用了多少

https://dash.cloudflare.com → Workers & Pages → Analytics

- Worker requests：10万/天
- D1 rows read：500万/天
- KV reads：10万/天

这些每天都远远用不完（家用预估 <1%）。

### 如果被攻击了

`index.html` 里把 `apiUrl` 暂时设成 `''`，前端会显示"后端尚未配置"，等你处理完。或去 CF dashboard 把 Worker 暂停。

`MAX_REGISTRATIONS_PER_DAY` 在 `wrangler.toml` 里调，默认 500。

---

## 出问题？

- **Worker 部署失败**："D1 database not found" → `wrangler.toml` 里的 database_id 没填对。
- **前端报 CORS 错误** → `wrangler.toml` 里 `ALLOWED_ORIGIN` 和你 Pages 的域名要完全一致（没有尾 `/`）。
- **Turnstile 一直转圈** → Site Key 和 Domain 对不上。CF dashboard → Turnstile → 站点设置里加 `qianyangpeng.github.io`。
- **"邀请链接无效"** → 邀请链接里的 token 在 DB 里找不到。可能对方点了"重新生成邀请链接"让你手上这个失效了。
