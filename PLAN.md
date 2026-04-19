# Sugar Garden 扩展计划

> 本文是剩余工作的权威清单。Context window 满了 / 新对话接手，从这里读起。
> Updated: 2026-04-19

## 目标

- **种花总数**：18 → **35**
- **分布**：N=10, R=8, SR=6, SSR=6, UR=5
- **需要新增**：+2 N, +5 R, +3 SR, +4 SSR, +3 UR = **17 种**
- **概率**：改为**动态**（基于当天吃糖量），UR 基准 5%
- **主页新增面板**：显示"明天抽卡概率"，实时浮动
- **风格**：中日西混搭，每档都包含

---

## 一、新增品种清单（按档次 + 文化风格）

### N 级 · 需加 2 种 · 日常常见花

| # | 名字 | 风格 | 视觉描述 |
|---|---|---|---|
| 1 | 三叶草 Clover | 西/通用 | 三片绿心形叶 + 小白花，luck 意象 |
| 2 | 菊花 Chrysanthemum | 中 | 黄色层叠多瓣 |

### R 级 · 需加 5 种 · 真实但不常见

| # | 名字 | 风格 | 视觉描述 |
|---|---|---|---|
| 3 | 薰衣草 Lavender | 地中海 | 蓝紫色穗状花序，多朵小花竖列 |
| 4 | 鸢尾 Iris | 日/西 | 3 瓣立起 + 3 瓣下垂，紫色 + 黄中线 |
| 5 | 绣球花 Hydrangea | 日 | 蓝粉渐变球状簇生 |
| 6 | 紫罗兰 Violet | 西 | 五瓣心形，上浅下深紫 |
| 7 | 勿忘我 Forget-me-not | 西 | 5 片圆蓝瓣 + 亮黄心 |

### SR 级 · 需加 3 种 · 艺术感经典美花

| # | 名字 | 风格 | 视觉描述 |
|---|---|---|---|
| 8 | 玫瑰 Rose | 西 | 多层螺旋重瓣（红） |
| 9 | 牡丹 Peony | 中 | 极大多层粉色蓬松花 |
| 10 | 兰花 Orchid | 中/日 | 3 大瓣 + 紫唇瓣 + 花斑 |

### SSR 级 · 需加 4 种 · 带特殊元素 / 粒子

| # | 名字 | 风格 | 视觉描述 |
|---|---|---|---|
| 11 | 蝴蝶兰 Butterfly orchid | 日/东南亚 | 花瓣如蝶翼，一圈展开 |
| 12 | 莲花 Lotus | 中/佛 | 粉瓣层叠 + 下方水波纹 |
| 13 | 蒲公英球 Dandelion | 西 | 白绒球 + 种子 SMIL 飘散动画 |
| 14 | 火焰花 Flame flower | 神话 | 火焰形瓣 + 热浪抖动 |

### UR 级 · 需加 3 种 · 神话 / 魔法级

| # | 名字 | 风格 | 视觉描述 |
|---|---|---|---|
| 15 | 极光花 Aurora | 北欧 | 青绿渐蓝极光瓣 + 流光动画 |
| 16 | 曼珠沙华 Red spider lily | 中/日 | 朱红卷瓣 + 细长花蕊 + 红色粒子 |
| 17 | 月桂冠花 Laurel crown | 希腊 | 金色叶环 + 放射光芒 |

**混搭分布**：西式 6, 中式 4, 日式 4, 神话/北欧/希腊 3 = 混搭完整。

---

## 二、动态概率系统

### 表：当天品质 → 明天的抽卡概率分布

| 当天品质 | N | R | SR | SSR | UR | 备注 |
|---|---|---|---|---|---|---|
| perfect (<0.4) | 25% | 28% | 22% | 17% | **8%** | 最好的奖励 |
| great (<0.7) | 32% | 30% | 20% | 11% | **7%** | |
| ok (<0.9) | 40% | 30% | 17% | 8% | **5%** | 默认基准 |
| okish (<1.0) | 50% | 28% | 13% | 6% | **3%** | |
| wilted (<1.3) | 62% | 25% | 9% | 3% | **1%** | |
| dead (≥1.3) | 75% | 18% | 5% | 1.5% | **0.5%** | 仍给一线希望 |

所有行总和 = 100%。

### 解释

- 当天品质由 `qualityFromPacing(total, limit, expected)` 决定（现有逻辑，实时更新）
- 从午夜锁定到明天首次抽卡，用锁定的品质查表得到分布
- 仍保留原有 pull count 机制（1-5 次抽卡）：pullsForDate(...) 基于昨天品质

### 代码改动

- **data.jsx**：
  - 替换常量 `RARITY_PROB` 为函数 `rarityProbForQuality(q)`，返回对应行
  - 修改 `rollRarity(seed, quality)` 多接一个品质参数，用该行做加权随机
  - 修改 `rollFlower(familyId, date, pullIndex, quality)` 传品质

- **sync/app**：
  - 抽卡时调用 `addSpinAttempt(state, date, identity, quality)` 传入昨天的最终品质
  - 现有 `pullsForDate` 可复用同样的"昨天品质"计算

### 保底（可选，先不做）

每 30 次没抽到 SSR+ 下一次必出；每 80 次没出 UR 下一次必出。
v1 先不上，概率已经给 UR 5% 基准，没那么惨。

---

## 三、主页"明天抽卡概率"面板

### 位置

主页 TodayScreen 里，**放在分段进度条和"记一笔"按钮之间**（当前是紧挨着 SchoolCard 之下）。

### 视觉设计

```
┌─────────────────────────────────────────┐
│ 🎲 明天抽卡概率 · 今天的表现在影响       │
│                                         │
│ N 40%  R 30%  SR 17%  SSR 8%  UR 5%    │
│ ▁▁▁▁▁ ▁▁▁▁ ▁▁ ▁▁ ▁                      │
│ (绿)  (蓝) (紫)(橙)(彩)                 │
└─────────────────────────────────────────┘
```

- 5 个彩条按比例宽度，颜色 = 稀有度颜色（UR 彩虹）
- 下方数字百分比
- 顶部一行说明"🎲 明天抽卡概率 · 今天的表现在影响"
- **实时更新**：每次吃糖 / 改设置 → 重新计算，百分比重新渲染

### 实现

- 新组件 `<TomorrowProbPanel state={state} />`
- 内部：调用 `qualityForDay(state, today, now)` → `rarityProbForQuality(q)` → 渲染

---

## 四、Rollout 计划

### 批次 1（首推）：R tier 5 新种 + UR 基准 5%（静态）

**目的**：扩充最快见效的档次，让玩家感到内容变多；同时把 UR 概率抬到可见范围。

范围：
- 新增 R 品种 5 种（#3-7）
- 更新 `RARITY_PROB` 表静态值：UR 5%, SSR 8%, SR 17%, R 30%, N 40%
- 不改动态系统，不改主页面板
- 更新 gallery/README 显示新数量

估计 ~200 行代码，30-60 分钟。

### 批次 2：SR 3 种 + SSR 4 种

- 新增 #8-10 (SR) + #11-14 (SSR)
- 其中蒲公英（#13）+火焰花（#14）要粒子动画
- 估计 ~280 行，1-2 小时

### 批次 3：UR 3 种 + N 2 种

- 新增 #15-17 (UR) + #1-2 (N)
- UR 3 种都要动画（极光流光 / 曼珠沙华粒子 / 月桂冠光芒）
- 估计 ~250 行，1.5 小时

### 批次 4：动态概率系统 + 主页面板

- 重构 rarity roll → 接受 quality 参数
- `rarityProbForQuality` 函数 + 6 档概率表
- `<TomorrowProbPanel>` 组件
- 插入主页 TodayScreen
- 估计 ~150 行，1 小时

### 批次 5（可选）：README + gallery 更新

- README 花朵部分更新 35 品种分布
- gallery.html 若有必要调整（应自动适配）
- ~30 分钟

---

## 五、代码改动清单（每批要碰的文件）

| 批次 | 文件 |
|---|---|
| 1 | src/flowers.jsx (+5 shape), src/data.jsx (FLOWERS +5, RARITY_PROB bump) |
| 2 | src/flowers.jsx (+7 shape), src/data.jsx (FLOWERS +7) |
| 3 | src/flowers.jsx (+5 shape), src/data.jsx (FLOWERS +5) |
| 4 | src/data.jsx (rollRarity/rollFlower 重构 + 新函数), src/screens.jsx (新组件 + TodayScreen 引用), src/app.jsx (可能要传 quality 进 addSpinAttempt) |
| 5 | README.md, 可能 gallery.html |

---

## 六、不要忘记

- **schemaVersion 不用再 bump**：概率表改了、加新花种不影响存储数据的兼容性（旧 spin 的 speciesId 仍有效，rarity 标签没变）。
- **花种 `shape` 字段**：每新花需在 `renderFlowerHead` 的 switch 里加一个 case。
- **color palette 互相不要撞**：R 档主色偏蓝，但花本身颜色可以多样（薰衣草紫其实靠近 SR 色卡，但档次由边框决定，没问题）。
- **动画成本**：SMIL 动画（`<animate>`）在同一页面 > 20 个会拖慢移动端。SSR/UR 档才上，不要下放到 N/R。
- **测试**：每批推完至少进 gallery.html 看新花渲染对不对；主 app 抽卡里概率是不是真的被用上。

---

## 七、进度

- [x] 批次 0：框架搭好（5 级稀有度 + SpinWheel + FlowerField + HistoryScreen + 风吹动画）
- [ ] 批次 1：R tier 5 新种 + UR 5% 
- [ ] 批次 2：SR + SSR
- [ ] 批次 3：UR + N 补足
- [ ] 批次 4：动态概率系统 + 主页面板
- [ ] 批次 5：README / gallery 最终更新
