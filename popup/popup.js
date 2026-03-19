// popup.js — Claude 用量喵喵 popup 邏輯

const $ = (sel) => document.querySelector(sel);
const cardsContainer = $('#cards-container');
const emptyState = $('#empty-state');
const errorState = $('#error-state');
const refreshBtn = $('#refresh-btn');
const statusDot = $('.status-dot');
const statusText = $('#status-text');
const lastUpdated = $('#last-updated');
const orgName = $('#org-name');

// Token section elements
const tokenSection = $('#token-section');
const tokenLabel = $('#token-label');
const officialLabel = $('#official-label');
const totalInput = $('#total-input');
const totalOutput = $('#total-output');
const totalCost = $('#total-cost');
const currentModel = $('#current-model');
const msgCount = $('#msg-count');
const dataSourceTag = $('#data-source-tag');
const tokenRecent = $('#token-recent');
const resetBtn = $('#reset-btn');

// ── 初始化 ──
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  loadTokenData();
  refreshBtn.addEventListener('click', handleRefresh);
  resetBtn.addEventListener('click', handleResetTokens);

  // 監聽 storage 變化（即時更新）
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tokenData) {
      renderTokenData(changes.tokenData.newValue);
    }
  });
});

// ── 載入已存的資料 ──
function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_USAGE' }, (data) => {
    if (chrome.runtime.lastError) {
      showError('無法連線到背景服務');
      return;
    }
    renderData(data);
  });
}

// ── 手動刷新 ──
async function handleRefresh() {
  refreshBtn.classList.add('spinning');
  setStatus('loading', '更新中喵...');

  chrome.runtime.sendMessage({ type: 'REFRESH' }, (data) => {
    refreshBtn.classList.remove('spinning');
    if (chrome.runtime.lastError) {
      showError('刷新失敗');
      return;
    }
    renderData(data);
  });
}

// ── 渲染主邏輯 ──
function renderData(data) {
  if (!data) {
    showEmpty();
    return;
  }

  if (data.error) {
    showError(data.error);
    return;
  }

  if (!data.tiers || data.tiers.length === 0) {
    // 如果沒有解析出 tier，但有 raw 資料，顯示 debug 資訊
    if (data.raw) {
      showRawData(data);
    } else {
      showEmpty();
    }
    return;
  }

  // 成功！顯示卡片
  emptyState.style.display = 'none';
  errorState.style.display = 'none';
  cardsContainer.style.display = 'flex';

  orgName.textContent = data.orgName || 'Personal';
  setStatus('ok', '已連線');
  updateLastUpdated(data.lastUpdated);

  cardsContainer.innerHTML = '';
  data.tiers.forEach(tier => {
    cardsContainer.appendChild(createCard(tier));
  });
}

// ── 建立用量卡片 ──
function createCard(tier) {
  const pct = tier.usagePercent ?? 0;
  const colorClass = getColorClass(pct);

  const card = document.createElement('div');
  card.className = `usage-card ${colorClass}`;

  // 重置時間
  let resetText = '';
  if (tier.resetAt) {
    resetText = formatResetTime(tier.resetAt);
  }

  // 模型名稱
  let modelText = '';
  if (tier.modelName) {
    modelText = tier.modelName;
  }

  card.innerHTML = `
    <div class="card-header">
      <span class="card-label">${escapeHtml(tier.label)}</span>
      <span class="card-percent ${colorClass}">${Math.round(pct)}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill ${colorClass}" style="width: 0%"></div>
    </div>
    <div class="card-details">
      ${resetText ? `
        <span class="card-detail-item">
          <span class="card-detail-icon">⏰</span>
          ${resetText}
        </span>
      ` : ''}
      ${modelText ? `
        <span class="card-detail-item">
          <span class="card-detail-icon">🤖</span>
          ${escapeHtml(modelText)}
        </span>
      ` : ''}
      ${tier.used != null && tier.limit != null ? `
        <span class="card-detail-item">
          <span class="card-detail-icon">📊</span>
          ${tier.used} / ${tier.limit}
        </span>
      ` : ''}
    </div>
  `;

  // 動畫：延遲展開進度條
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = card.querySelector('.progress-fill');
      fill.style.width = `${Math.min(pct, 100)}%`;
    });
  });

  return card;
}

// ── 顯示 raw 資料（debug 模式） ──
function showRawData(data) {
  emptyState.style.display = 'none';
  errorState.style.display = 'none';
  cardsContainer.style.display = 'flex';

  setStatus('ok', '已連線（原始資料）');
  updateLastUpdated(data.lastUpdated);
  orgName.textContent = data.orgName || 'Personal';

  cardsContainer.innerHTML = `
    <div class="usage-card green">
      <div class="card-header">
        <span class="card-label">🔍 原始回傳資料</span>
      </div>
      <pre style="font-size: 10px; color: var(--text-sub); 
           white-space: pre-wrap; word-break: break-all;
           max-height: 200px; overflow-y: auto;
           font-family: 'SF Mono', monospace; margin-top: 8px;
           background: #F8F5FF; padding: 8px; border-radius: 8px;">
${escapeHtml(JSON.stringify(data.raw, null, 2))}
      </pre>
      <p style="font-size: 10px; color: var(--text-light); margin-top: 8px; text-align: center;">
        API 回傳格式可能需要調整解析邏輯 🐱
      </p>
    </div>
  `;
}

// ── 空狀態 ──
function showEmpty() {
  cardsContainer.style.display = 'none';
  errorState.style.display = 'none';
  emptyState.style.display = 'block';
  setStatus('error', '未登入');
}

// ── 錯誤狀態 ──
function showError(msg) {
  cardsContainer.style.display = 'none';
  emptyState.style.display = 'none';
  errorState.style.display = 'block';
  $('#error-msg').textContent = msg;
  setStatus('error', '連線異常');
}

// ── Helpers ──
function getColorClass(pct) {
  if (pct < 50) return 'green';
  if (pct < 75) return 'yellow';
  if (pct < 90) return 'orange';
  return 'red';
}

function setStatus(type, text) {
  statusDot.className = `status-dot ${type === 'error' ? 'error' : type === 'loading' ? 'loading' : ''}`;
  statusText.textContent = text;
}

function updateLastUpdated(timestamp) {
  if (!timestamp) return;
  const ago = getTimeAgo(timestamp);
  lastUpdated.textContent = `${ago}前更新`;
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} 秒`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘`;
  const hr = Math.floor(min / 60);
  return `${hr} 小時`;
}

function formatResetTime(resetAt) {
  try {
    const date = new Date(resetAt);
    if (isNaN(date.getTime())) return '';

    const diff = date.getTime() - Date.now();
    if (diff <= 0) return '已重置';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m 後重置`;
    return `${minutes}m 後重置`;
  } catch {
    return '';
  }
}

// ── Token 資料 ──
function loadTokenData() {
  // 嘗試從 content script 直接取
  chrome.tabs.query({ url: 'https://claude.ai/*', active: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_TOKEN_DATA' }, (data) => {
        if (chrome.runtime.lastError || !data) {
          // fallback: 從 storage 取
          chrome.storage.local.get('tokenData', (result) => {
            renderTokenData(result.tokenData);
          });
          return;
        }
        renderTokenData(data);
      });
    } else {
      chrome.storage.local.get('tokenData', (result) => {
        renderTokenData(result.tokenData);
      });
    }
  });
}

function renderTokenData(data) {
  if (!data || (!data.totalInputTokens && !data.totalOutputTokens)) {
    tokenSection.style.display = 'none';
    tokenLabel.style.display = 'none';
    return;
  }

  tokenSection.style.display = 'block';
  tokenLabel.style.display = 'flex';
  officialLabel.style.display = 'flex';

  totalInput.textContent = formatNumber(data.totalInputTokens || 0);
  totalOutput.textContent = formatNumber(data.totalOutputTokens || 0);
  totalCost.textContent = `$${(data.totalCost || 0).toFixed(4)}`;
  currentModel.textContent = simplifyModelName(data.lastModel);
  msgCount.textContent = (data.messages || []).length;

  // 最近有用官方數字嗎？
  const hasOfficial = (data.messages || []).some(m => m.isOfficial);
  if (hasOfficial) {
    dataSourceTag.style.display = 'inline';
    dataSourceTag.textContent = '含官方數據';
    dataSourceTag.className = 'tag official';
  } else {
    dataSourceTag.style.display = 'inline';
    dataSourceTag.textContent = '估算值';
    dataSourceTag.className = 'tag';
  }

  // 最近訊息列表（最新 8 則）
  const recent = (data.messages || []).slice(-8).reverse();
  tokenRecent.innerHTML = '';
  recent.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'token-msg';
    const total = (msg.inputTokens || 0) + (msg.outputTokens || 0);
    div.innerHTML = `
      <span class="token-msg-model">${simplifyModelName(msg.model)}</span>
      <span class="token-msg-tokens">${formatNumber(total)} tokens</span>
      <span class="token-msg-cost">$${(msg.cost || 0).toFixed(4)}</span>
    `;
    tokenRecent.appendChild(div);
  });
}

function handleResetTokens() {
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'RESET_TOKEN_DATA' });
    }
  });
  chrome.storage.local.remove('tokenData');
  renderTokenData(null);
}

function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function simplifyModelName(model) {
  if (!model) return '—';
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.split('-').slice(0, 2).join(' ');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
