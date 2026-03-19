// background.js — Claude 用量喵喵 service worker
// 定期從 claude.ai 抓取用量資料 + badge 輪播

const ALARM_NAME = 'refresh-usage';
const BADGE_ROTATE_NAME = 'rotate-badge';
const REFRESH_INTERVAL_MINUTES = 5;
const BADGE_ROTATE_SECONDS = 4;
const USAGE_API_URL = 'https://claude.ai/api/organizations';

let badgeIndex = 0;

// ── 初始化 ──
chrome.runtime.onInstalled.addListener(() => {
  console.log('🐱 Claude 用量喵喵已安裝！');
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: REFRESH_INTERVAL_MINUTES
  });
  chrome.alarms.create(BADGE_ROTATE_NAME, {
    delayInMinutes: 0.05,
    periodInMinutes: BADGE_ROTATE_SECONDS / 60
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    fetchUsageData();
  }
  if (alarm.name === BADGE_ROTATE_NAME) {
    rotateBadge();
  }
});

// ── 監聽 popup / content script 的訊息 ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'REFRESH') {
    fetchUsageData().then(data => sendResponse(data));
    return true;
  }
  if (msg.type === 'GET_USAGE') {
    chrome.storage.local.get('usageData', (result) => {
      sendResponse(result.usageData || null);
    });
    return true;
  }
  if (msg.type === 'TOKEN_UPDATE') {
    chrome.storage.local.set({ tokenData: msg.data });
    return false;
  }
  if (msg.type === 'GET_TOKEN_DATA') {
    chrome.storage.local.get('tokenData', (result) => {
      sendResponse(result.tokenData || null);
    });
    return true;
  }
});

// ── 核心：抓取用量資料 ──
async function fetchUsageData() {
  try {
    const orgsRes = await fetch(USAGE_API_URL, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!orgsRes.ok) throw new Error(`Orgs fetch failed: ${orgsRes.status}`);

    const orgs = await orgsRes.json();
    if (!orgs || orgs.length === 0) throw new Error('No organizations found');

    const orgId = orgs[0].uuid;

    const usageRes = await fetch(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      { credentials: 'include', headers: { 'Content-Type': 'application/json' } }
    );
    if (!usageRes.ok) throw new Error(`Usage fetch failed: ${usageRes.status}`);

    const usage = await usageRes.json();
    const data = parseUsageData(usage);
    data.lastUpdated = Date.now();
    data.orgName = orgs[0].name || 'Personal';

    await chrome.storage.local.set({ usageData: data });

    notifyContentScript(data);

    console.log('🐱 用量已更新', data);
    return data;

  } catch (err) {
    console.error('🐱 抓取失敗:', err.message);
    const errorData = { error: err.message, lastUpdated: Date.now() };
    await chrome.storage.local.set({ usageData: errorData });
    setBadge('?', '#999');
    return errorData;
  }
}

function notifyContentScript(data) {
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'USAGE_UPDATE', data }).catch(() => {});
    });
  });
}

function parseUsageData(raw) {
  const result = { tiers: [] };

  if (raw.five_hour) {
    result.tiers.push({
      type: 'five_hour',
      label: '⏱️ 5 小時 Session',
      usagePercent: raw.five_hour.utilization ?? null,
      resetAt: raw.five_hour.resets_at ?? null,
    });
  }
  if (raw.seven_day) {
    result.tiers.push({
      type: 'seven_day',
      label: '📅 7 天用量',
      usagePercent: raw.seven_day.utilization ?? null,
      resetAt: raw.seven_day.resets_at ?? null,
    });
  }
  if (raw.extra_usage && raw.extra_usage.is_enabled) {
    result.tiers.push({
      type: 'extra_usage',
      label: '💳 額外用量',
      usagePercent: raw.extra_usage.utilization ?? null,
      used: raw.extra_usage.used_credits ?? null,
      limit: raw.extra_usage.monthly_limit ?? null,
    });
  }
  return result;
}

async function rotateBadge() {
  const result = await chrome.storage.local.get(['usageData', 'tokenData']);
  const data = result.usageData;
  const tokenData = result.tokenData;

  if (!data || data.error || !data.tiers || data.tiers.length === 0) {
    setBadge('?', '#999');
    return;
  }

  const items = [];

  const fiveHour = data.tiers.find(t => t.type === 'five_hour');
  if (fiveHour?.usagePercent != null) {
    const pct = Math.round(fiveHour.usagePercent);
    items.push({ text: `5h${pct}`, color: colorForPct(pct) });
  }

  const sevenDay = data.tiers.find(t => t.type === 'seven_day');
  if (sevenDay?.usagePercent != null) {
    const pct = Math.round(sevenDay.usagePercent);
    items.push({ text: `7d${pct}`, color: colorForPct(pct) });
  }

  const extra = data.tiers.find(t => t.type === 'extra_usage');
  if (extra?.usagePercent != null) {
    const pct = Math.round(extra.usagePercent);
    items.push({ text: `$${pct}%`, color: colorForPct(pct) });
  }

  if (tokenData?.totalCost > 0) {
    const cost = tokenData.totalCost;
    const costStr = cost < 1 ? cost.toFixed(2) : cost.toFixed(1);
    items.push({ text: `$${costStr}`, color: '#B8A0D8' });
  }

  if (items.length === 0) {
    setBadge('✓', '#7DBDA3');
    return;
  }

  badgeIndex = badgeIndex % items.length;
  const item = items[badgeIndex];
  setBadge(item.text, item.color);
  badgeIndex++;
}

function colorForPct(pct) {
  if (pct < 50) return '#7DBDA3';
  if (pct < 75) return '#E6C44A';
  if (pct < 90) return '#DA7756';
  return '#C15F3C';
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
}
