// content.js — 橋接層（isolated world）
// 1. 監聽 injected.js 的 token 資料
// 2. 在 claude.ai 頁面注入浮動狀態條

// ── Session data ──
let sessionData = {
  messages: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
  lastModel: null,
  sessionStart: Date.now()
};

chrome.storage.local.get('tokenData', (result) => {
  if (result.tokenData) sessionData = result.tokenData;
});

// ── 監聽 injected.js 的 token 事件 ──
window.addEventListener('__claude_nyan_token__', (e) => {
  const msg = e.detail;
  if (!msg) return;

  sessionData.messages.push(msg);
  sessionData.totalInputTokens += msg.inputTokens || 0;
  sessionData.totalOutputTokens += msg.outputTokens || 0;
  sessionData.totalCost += msg.cost || 0;
  sessionData.lastModel = msg.model || sessionData.lastModel;
  sessionData.lastUpdated = Date.now();

  if (sessionData.messages.length > 200) {
    sessionData.messages = sessionData.messages.slice(-200);
  }

  chrome.storage.local.set({ tokenData: sessionData });
  chrome.runtime.sendMessage({ type: 'TOKEN_UPDATE', data: sessionData }).catch(() => {});
  updateFloatingBar();
});

// ── 監聽 background 的官方用量更新 ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN_DATA') {
    sendResponse(sessionData);
    return true;
  }
  if (msg.type === 'RESET_TOKEN_DATA') {
    sessionData = {
      messages: [], totalInputTokens: 0, totalOutputTokens: 0,
      totalCost: 0, lastModel: null, sessionStart: Date.now()
    };
    chrome.storage.local.set({ tokenData: sessionData });
    updateFloatingBar();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'USAGE_UPDATE') {
    updateFloatingBar(msg.data);
  }
});

// ══════════════════════════════════════
// 浮動狀態條
// ══════════════════════════════════════

let floatingBar = null;
let cachedUsage = null;

function createFloatingBar() {
  if (floatingBar) return floatingBar;

  const bar = document.createElement('div');
  bar.id = 'claude-nyan-bar';
  bar.innerHTML = `
    <div id="nyan-bar-inner">
      <span id="nyan-bar-cat">🐱</span>
      <span class="nyan-pill" id="nyan-5h" title="5 小時 Session">⏱ —</span>
      <span class="nyan-pill" id="nyan-7d" title="7 天用量">📅 —</span>
      <span class="nyan-pill" id="nyan-extra" title="額外用量">💳 —</span>
      <span class="nyan-divider">│</span>
      <span class="nyan-pill nyan-token" id="nyan-cost" title="即時 Token 費用">⚡ $0</span>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #claude-nyan-bar {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 99999;
      font-family: -apple-system, 'SF Pro Text', sans-serif;
      font-size: 12px;
      pointer-events: auto;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    #claude-nyan-bar:hover {
      transform: translateY(-2px);
    }
    #claude-nyan-bar.nyan-minimized #nyan-bar-inner {
      padding: 4px 8px;
    }
    #claude-nyan-bar.nyan-minimized .nyan-pill,
    #claude-nyan-bar.nyan-minimized .nyan-divider {
      display: none;
    }
    #nyan-bar-inner {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 252, 248, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(193, 95, 60, 0.15);
      border-radius: 20px;
      padding: 5px 12px;
      box-shadow: 0 2px 12px rgba(61, 46, 34, 0.1);
      cursor: default;
      user-select: none;
    }
    @media (prefers-color-scheme: dark) {
      #nyan-bar-inner {
        background: rgba(45, 40, 35, 0.92);
        border-color: rgba(218, 119, 86, 0.2);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
      }
      .nyan-pill { color: #D4C8B8 !important; }
      .nyan-pill.green { background: rgba(61, 158, 122, 0.2) !important; color: #7DBDA3 !important; }
      .nyan-pill.yellow { background: rgba(230, 196, 74, 0.2) !important; color: #E6C44A !important; }
      .nyan-pill.orange { background: rgba(218, 119, 86, 0.2) !important; color: #DA7756 !important; }
      .nyan-pill.red { background: rgba(193, 95, 60, 0.2) !important; color: #C15F3C !important; }
      .nyan-divider { color: #5A524A !important; }
    }
    #nyan-bar-cat {
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    #nyan-bar-cat:hover {
      transform: scale(1.2) rotate(10deg);
    }
    .nyan-pill {
      background: rgba(244, 243, 238, 0.8);
      color: #7A6B5D;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 11px;
      white-space: nowrap;
      transition: all 0.3s ease;
    }
    .nyan-pill.green { background: rgba(61, 158, 122, 0.1); color: #3A9E7A; }
    .nyan-pill.yellow { background: rgba(230, 196, 74, 0.12); color: #B59A18; }
    .nyan-pill.orange { background: rgba(218, 119, 86, 0.12); color: #C15F3C; }
    .nyan-pill.red { background: rgba(193, 95, 60, 0.15); color: #A03020; }
    .nyan-pill.nyan-token { background: rgba(184, 160, 216, 0.12); color: #8A70B0; }
    .nyan-divider { color: #D4C8B8; font-size: 10px; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(bar);

  bar.querySelector('#nyan-bar-cat').addEventListener('click', () => {
    bar.classList.toggle('nyan-minimized');
  });

  floatingBar = bar;
  return bar;
}

function colorClassForPct(pct) {
  if (pct < 50) return 'green';
  if (pct < 75) return 'yellow';
  if (pct < 90) return 'orange';
  return 'red';
}

function updateFloatingBar(usageData) {
  if (usageData) cachedUsage = usageData;

  if (!document.body) {
    setTimeout(() => updateFloatingBar(usageData), 500);
    return;
  }

  const bar = createFloatingBar();

  if (cachedUsage?.tiers) {
    const fiveHour = cachedUsage.tiers.find(t => t.type === 'five_hour');
    const sevenDay = cachedUsage.tiers.find(t => t.type === 'seven_day');
    const extra = cachedUsage.tiers.find(t => t.type === 'extra_usage');

    if (fiveHour?.usagePercent != null) {
      const pct = Math.round(fiveHour.usagePercent);
      const el = bar.querySelector('#nyan-5h');
      el.textContent = `⏱ ${pct}%`;
      el.className = `nyan-pill ${colorClassForPct(pct)}`;
    }
    if (sevenDay?.usagePercent != null) {
      const pct = Math.round(sevenDay.usagePercent);
      const el = bar.querySelector('#nyan-7d');
      el.textContent = `📅 ${pct}%`;
      el.className = `nyan-pill ${colorClassForPct(pct)}`;
    }
    if (extra?.usagePercent != null) {
      const pct = Math.round(extra.usagePercent);
      const el = bar.querySelector('#nyan-extra');
      el.textContent = `💳 ${pct}%`;
      el.className = `nyan-pill ${colorClassForPct(pct)}`;
    }
  }

  const costEl = bar.querySelector('#nyan-cost');
  if (sessionData.totalCost > 0) {
    const cost = sessionData.totalCost;
    costEl.textContent = `⚡ $${cost < 1 ? cost.toFixed(3) : cost.toFixed(2)}`;
  }
}

chrome.storage.local.get('usageData', (result) => {
  if (result.usageData && !result.usageData.error) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => updateFloatingBar(result.usageData));
    } else {
      updateFloatingBar(result.usageData);
    }
  }
});

console.log('🐱 Claude 用量喵喵 content script 已載入！');
