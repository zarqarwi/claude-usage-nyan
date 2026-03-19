# 🐱 Claude 用量喵喵 — Claude Usage Nyan

**一個可愛的 Chrome Extension，讓你隨時掌握 Claude 的用量狀態。**

> 身為 Claude 重度使用者，最怕的就是聊到一半突然撞到 rate limit。這個小工具讓你在工具列上就能看到目前的用量，不用再自己去 Settings 頁面刷。

---

## 開發背景：為什麼又做一個用量追蹤器？

### 市場調研

我們在動手之前，先花時間調查了市場上所有類似的工具。結論是：**這個賽道已經很擠了，但每個工具都只解決了一部分問題。**

macOS 原生 menu bar app 至少有十幾個：ClaudePulse、Claude Island、SessionWatcher、Claude Usage Tracker、ClaudeBar、ClaudeMeter、c9watch、claude-status⋯⋯功能從用量追蹤、session 監控到 Dynamic Island 風格 overlay 都有。

Chrome Extension 也有好幾個：Claude Usage Tracker（lugia19）、Dashboard for Claude、Claude Usage Monitor、Claude Counter 等。

但我們發現四個明確的缺口：

1. **跨平台** — 原生 app 全部是 macOS only，Windows / Linux 使用者完全沒得用。Chrome Extension 天然跨平台。
2. **雙資料來源對照** — 大部分工具只做「官方用量百分比」或「即時 token 估算」其中一個。沒有人把兩個放在一起讓你比較差異。
3. **中文介面** — 所有現有工具都是英文 UI，沒有針對台灣 / 亞洲市場做在地化。
4. **團隊用量管理** — Anthropic 自己的 analytics dashboard 只給 Teams / Enterprise admin 看，一般用戶跟小團隊沒有好用的共享儀表板。

所以我們的定位很簡單：**跨平台、雙資料來源、中文優先、自用夠好就分享。**

### 資安與即時性

開發過程中我們認真評估了兩個關鍵問題：

**資安風險** — Extension 需要讀取 claude.ai 的 session cookie 來存取 API，這是所有同類工具都需要的。我們的做法是：所有資料只存本機 `chrome.storage.local`、不使用任何第三方服務、不傳送任何資料到外部、完整開源讓你看得到每一行程式碼。

**資料即時性** — Anthropic 的 usage API 本身就有延遲，官方 Settings 頁面的百分比跟實際消耗之間有幾分鐘的 lag。這也是為什麼有人回報「明明只用了 16% 卻被 rate limit」。我們沒辦法解決 Anthropic 端的延遲，但透過雙資料來源的對照，至少你能看到差異有多大。

---

## 雙管道架構：官方數據 vs 網頁推算

這是這個 Extension 最核心的設計——同時從兩條管道取得用量資料，並排顯示讓你比較。

```
┌──────────────────────────────────────────────────────────────┐
│                  Claude Usage Extension                       │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────┐     │
│  │    content.js        │    │    background.js         │     │
│  │   (isolated world)   │    │   (service worker)       │     │
│  │                      │    │                          │     │
│  │   監聽 token 事件    │    │   Poll 官方 API          │     │
│  │   + 注入浮動條       │    │   每 5 分鐘自動更新      │     │
│  └──────────┬───────────┘    └──────────┬───────────────┘     │
│             │                            │                    │
│             ▼                            ▼                    │
│  ┌─────────────────────┐    ┌─────────────────────────┐     │
│  │    injected.js       │    │   Source A：官方用量      │     │
│  │   (main world)       │    │                          │     │
│  │                      │    │   Polls /api/org/*/usage  │     │
│  │   Source B：即時攔截  │    │   Session % + Weekly %   │     │
│  │   Patch fetch        │    │   Reset countdown        │     │
│  │   攔截 API request   │    │   每 5 min + 手動刷新    │     │
│  │   計算 token + 費用  │    │                          │     │
│  └──────────┬───────────┘    └──────────┬───────────────┘     │
│             │                            │                    │
│             └────────────┬───────────────┘                    │
│                          ▼                                    │
│               ┌───────────────────┐                          │
│               │ chrome.storage    │                          │
│               │    .local         │                          │
│               │                   │                          │
│               │ 合併兩個來源的資料│                          │
│               └────────┬──────────┘                          │
│                        ▼                                     │
│               ┌───────────────────┐                          │
│               │   popup UI        │                          │
│               │   Badge 輪播      │                          │
│               │   浮動狀態條      │                          │
│               └───────────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

### Source A：官方用量（background.js）

`background.js` 作為 Service Worker，定期呼叫 Anthropic 的內部 usage API：

```
GET https://claude.ai/api/organizations/{orgId}/usage
```

這個 API 回傳三個維度的用量資訊：

| 欄位 | 說明 |
|------|------|
| `five_hour.utilization` | 5 小時滾動窗口的使用百分比 |
| `seven_day.utilization` | 7 天滾動窗口的使用百分比 |
| `extra_usage.utilization` | 額外用量 credits 的消耗百分比 |

這些數字跟你在 `claude.ai/settings/usage` 看到的是同一個來源。優點是官方權威數據，缺點是有延遲。

### Source B：即時推算（injected.js）

`injected.js` 被注入到 claude.ai 頁面的 main world，透過 monkey-patch `window.fetch` 來攔截每一次跟 Claude 的對話 API 呼叫：

1. **攔截 request** — 解析你送出的訊息，估算 input tokens
2. **攔截 response** — 讀取 SSE streaming 回應，累加 output tokens
3. **計算費用** — 根據模型（Opus / Sonnet / Haiku）的定價表估算費用
4. **透過 CustomEvent 傳回** — `injected.js`（main world）→ `content.js`（isolated world）→ `chrome.storage.local`

Token 估算用簡易規則：英文約 4 字元 = 1 token，中文約 1.5 字元 = 1 token。如果 API response 有官方 `usage` 欄位就直接用官方數字。

這條管道的優點是即時（每則對話立刻更新），缺點是 token 數是估算值，跟官方有誤差。

**兩個管道並排顯示，讓你自己觀察差異有多大——這就是做這個工具的核心目的。**

---

## 功能一覽

**📡 官方用量卡片**
- ⏱️ 5 小時 Session 用量（% + 重置倒數）
- 📅 7 天用量上限（% + 重置倒數）
- 💳 額外用量 credits（已用 / 上限）
- 自動每 5 分鐘更新 + 手動刷新

**⚡ 即時 Token 追蹤**
- 每則對話的 input / output token 估算
- 預估費用計算（Opus $5/$25、Sonnet $3/$15、Haiku $1/$5 per MTok）
- 對話歷史列表，可區分官方數據 vs 估算值

**🔄 Badge 輪播**
- 工具列 icon 每 4 秒自動切換：`5h8%` → `7d52%` → `$84%` → `$0.17`
- 顏色分級：🟢 <50% → 🟡 <75% → 🟠 <90% → 🔴 >90%
- 不用點開 popup 就能一眼掌握狀態

**🐱 頁面浮動條**
- 在 claude.ai 右下角常駐半透明狀態條
- 點貓貓可收合 / 展開
- 支援 dark mode
- 不遮擋聊天區域

**🔒 隱私安全**
- 所有資料存在瀏覽器本機 `chrome.storage.local`
- 不傳送任何資料到外部伺服器
- 不使用 analytics、Firebase、或任何第三方服務
- 完整開源

---

## 安裝方式

### Step 1：下載

```bash
git clone https://github.com/zarqarwi/claude-usage-nyan.git
```

或直接 [下載 ZIP](https://github.com/zarqarwi/claude-usage-nyan/archive/refs/heads/main.zip) 後解壓縮。

### Step 2：載入到 Chrome

1. 打開 Chrome，網址列輸入 `chrome://extensions/`
2. 右上角開啟 **「開發人員模式」**
3. 點 **「載入未封裝項目」**
4. 選擇剛才下載的 `claude-usage-nyan` 資料夾

### Step 3：開始使用

1. 確認你已經登入 [claude.ai](https://claude.ai)
2. 工具列上會出現橘虎斑貓 🐱 圖示（看不到的話，按拼圖按鈕 🧩 釘選）
3. 點圖示看 popup 用量卡片
4. Badge 會自動輪播顯示各項用量百分比
5. claude.ai 頁面右下角會出現常駐浮動狀態條

> **提醒：** 每次 Chrome 更新後可能需要重新載入 extension。到 `chrome://extensions/` 按重新載入按鈕（↻）即可。

---

## 檔案說明

| 檔案 | 用途 |
|------|------|
| `manifest.json` | Chrome Extension MV3 設定 |
| `background.js` | Service Worker：官方 API polling + Badge 輪播 |
| `content.js` | 橋接層（isolated world）：接收 token 事件 + 浮動條 |
| `injected.js` | Main world：monkey-patch fetch 攔截 API 呼叫 |
| `popup/popup.html` | Popup 頁面結構 |
| `popup/popup.css` | Claude terra cotta 風格樣式 |
| `popup/popup.js` | 渲染邏輯 |
| `icons/` | 橘虎斑貓 icon（16 / 48 / 128 px） |

---

## 支援方案

- ✅ Claude Pro ($20/月)
- ✅ Claude Max ($100/月)
- ✅ Claude Teams
- ✅ Claude Free（部分功能）

---

## 注意事項

- Anthropic 的內部 usage API 沒有公開文件，格式可能隨時改變。如果 popup 顯示「原始回傳資料」，表示 API 格式變了需要調整解析邏輯。
- 即時 Token 追蹤是估算值，跟官方數字可能有差異——這也是做這個工具的目的之一，讓你看到差異。
- 只追蹤 claude.ai 網頁版的對話，Claude Code (CLI) 不在追蹤範圍。
- 需要讀取你在 claude.ai 的 session cookie 來存取 API，但所有資料都留在本機。

---

## 自訂配色

修改 `popup/popup.css` 裡的 CSS variables：

```css
:root {
  --bg-cream: #F4F3EE;       /* 背景色（Claude Pampas） */
  --terra-accent: #C15F3C;    /* 主色調（Claude Crail） */
  --mint-accent: #3A9E7A;     /* 安全色 */
}
```

---

## License

MIT — 自由使用，歡迎改造 🐱

---

## 作者

Paul Kuo — [paulkuo.tw](https://paulkuo.tw)

用 Claude 協作開發。從市場調研、競品分析、技術架構、UI 設計、icon 繪製到程式碼實作，全程 AI pair programming 完成。
