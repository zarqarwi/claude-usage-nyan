# 🐱 Claude 用量喵喵 — Claude Usage Nyan

**一個可愛的 Chrome Extension，讓你隨時掌握 Claude 的用量狀態。**

> 身為 Claude 重度使用者，最怕的就是聊到一半突然撞到 rate limit。這個小工具讓你在工具列上就能看到目前的用量，不用再自己去 Settings 頁面刷。

---

## 為什麼做這個

市面上有不少 Claude 用量追蹤工具，但幾乎都是 macOS 原生 app，Windows / Linux 使用者沒得用。而且大部分只追蹤「官方用量百分比」或「即時 token 數」其中一種——我們兩個都做，讓你直接看到差異。

這個 Extension 同時提供兩個資料來源：

| 來源 | 資料 | 更新頻率 |
|------|------|---------|
| **Source A：官方 API** | 5 小時 Session %、7 天用量 %、額外用量 | 每 5 分鐘自動 poll |
| **Source B：即時攔截** | 每則對話的 token 數、模型名稱、預估費用 | 每次對話即時計算 |

兩者並排顯示，你可以觀察官方數字和實際花費之間的延遲差異。

---

## 功能一覽

**📡 官方用量卡片**
- ⏱️ 5 小時 Session 用量（% + 重置倒數）
- 📅 7 天用量上限（% + 重置倒數）
- 💳 額外用量 credits（已用 / 上限）

**⚡ 即時 Token 追蹤**
- 每則對話的 input / output token 估算
- 預估費用計算（Opus $5/$25、Sonnet $3/$15、Haiku $1/$5 per MTok）
- 對話歷史列表，可區分官方數據 vs 估算值

**🔄 Badge 輪播**
- 工具列 icon 每 4 秒自動切換：`5h8%` → `7d52%` → `$84%` → `$0.17`
- 顏色分級：🟢 <50% → 🟡 <75% → 🟠 <90% → 🔴 >90%

**🐱 頁面浮動條**
- 在 claude.ai 右下角常駐半透明狀態條
- 點貓貓可收合 / 展開
- 支援 dark mode

**🔒 隱私安全**
- 所有資料存在瀏覽器本機 `chrome.storage.local`
- 不傳送任何資料到外部伺服器
- 不使用 analytics、Firebase、或任何第三方服務
- 完整開源，歡迎檢視

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
2. 工具列上會出現橘虎斑貓 🐱 圖示
3. 點圖示就能看到用量 popup
4. Badge 會自動輪播顯示用量百分比

> **小提示：** 如果看不到貓貓圖示，按工具列的拼圖按鈕（🧩）把「Claude 用量喵喵」釘選起來。

---

## 技術架構

```
┌──────────────────┐    ┌───────────────────┐
│   content.js     │    │  background.js    │
│  (isolated)      │    │ (service worker)  │
│                  │    │                   │
│  監聽 token      │    │  Poll 官方 API    │
│  事件 + 浮動條   │    │  每 5 分鐘        │
└────────┬─────────┘    └────────┬──────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌───────────────────┐
│  injected.js     │    │ chrome.storage    │
│  (main world)    │    │    .local         │
│                  │    │                   │
│  Patch fetch     │──▶ │  合併兩個來源     │
│  攔截 API 呼叫   │    │  的資料           │
└──────────────────┘    └────────┬──────────┘
                                 │
                                 ▼
                        ┌───────────────────┐
                        │   popup UI        │
                        │   Badge 輪播      │
                        │   浮動狀態條      │
                        └───────────────────┘
```

### 檔案說明

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
- 所有資料不會傳到外部伺服器，但 extension 需要讀取你在 claude.ai 的 session cookie 來存取 API。

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

用 Claude 協作開發。從市場調查、技術架構、UI 設計、icon 繪製到程式碼，全程 AI pair programming 完成。
