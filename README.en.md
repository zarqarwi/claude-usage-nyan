🌐 **Language**: [繁體中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

# 🐱 Claude Usage Nyan — Usage Tracker

Track your Claude usage in a cute way!

## Features

- 📊 Real-time session usage percentage & weekly usage cap
- ⏰ Reset countdown timer
- 🎨 Cute gradient progress bars + shimmer animation
- 🟢🟡🟠🔴 Color-coded at a glance
- 🔄 Auto-refresh every 5 minutes + manual refresh
- 🔒 All data stays local — nothing sent to external servers

## Installation (Developer Mode)

1. Open Chrome, go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this folder
5. Make sure you're logged in to [claude.ai](https://claude.ai)
6. Click the 🐱 icon in the toolbar to view your usage

## How It Works

The extension uses your existing claude.ai login session (cookies) to periodically call Claude's internal usage API for usage data.

**No additional API key or session key needed.**

## Architecture

```
manifest.json        — Chrome Extension MV3 config
background.js        — Service Worker: fetches data + updates badge
popup/
  popup.html         — Popup page structure
  popup.css          — Kawaii-style design
  popup.js           — Rendering logic
content.js           — Bridge layer (isolated world): floating bar on claude.ai
injected.js          — Main world script: intercepts API responses for token tracking
icons/               — Cute cat icons
```

## Notes

- Anthropic's internal API has no public documentation; the format may change at any time
- If the popup shows "Raw response data", it means the API format needs parsing logic adjustment
- On first use, please log in to claude.ai first, then click the extension's refresh button

## Customization

Want to change the style? Edit the CSS variables in `popup/popup.css`:

```css
:root {
  --bg-cream: #FFF8F0;      /* Background */
  --pink-accent: #FF7BAC;    /* Primary accent */
  --mint-accent: #2DD4A0;    /* Safe color (green) */
  /* ... more colors in the CSS */
}
```

## License

MIT — Free to use, feel free to remix 🐱
