# 🐱 Claude 用量喵喵 — Usage Tracker

用可愛的方式追蹤你的 Claude 用量！

## 功能

- 📊 即時顯示 session 用量百分比、週用量上限
- ⏰ 重置倒數計時
- 🎨 可愛的漸層進度條 + shimmer 動畫
- 🟢🟡🟠🔴 色彩分級一目了然
- 🔄 每 5 分鐘自動刷新 + 手動刷新
- 🔒 所有資料存在本機，不會傳到任何外部伺服器

## 安裝方式（開發者模式）

1. 打開 Chrome，輸入 `chrome://extensions/`
2. 右上角開啟「開發人員模式」
3. 點「載入未封裝項目」
4. 選擇這個資料夾
5. 確認你已經登入 [claude.ai](https://claude.ai)
6. 點選工具列上的 🐱 圖示即可查看用量

## 運作原理

Extension 利用你在 claude.ai 的登入 session（cookie），
定期呼叫 Claude 的內部 usage API 取得用量資料。

**不需要額外設定任何 API key 或 session key。**

## 技術架構

```
manifest.json        — Chrome Extension MV3 設定
background.js        — Service Worker，負責抓資料 + 更新 badge
popup/
  popup.html         — Popup 頁面結構
  popup.css          — Kawaii 風格樣式
  popup.js           — 渲染邏輯
icons/               — 可愛貓咪 icon
```

## 注意事項

- Anthropic 的內部 API 沒有公開文件，格式可能隨時改變
- 如果 popup 顯示「原始回傳資料」，表示 API 格式需要調整解析邏輯
- 第一次使用時，請先到 claude.ai 登入，然後點 extension 的刷新按鈕

## 自訂

想改風格？主要改 `popup/popup.css` 裡的 CSS variables：

```css
:root {
  --bg-cream: #FFF8F0;      /* 背景色 */
  --pink-accent: #FF7BAC;    /* 主色調 */
  --mint-accent: #2DD4A0;    /* 安全色（綠） */
  /* ... 更多顏色在 CSS 裡 */
}
```

## License

MIT — 自由使用，歡迎改造 🐱
