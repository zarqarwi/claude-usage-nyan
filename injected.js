// injected.js — 在頁面 main world 執行，monkey-patch fetch
// 透過 CustomEvent 把 token 資料傳回 content script

(function () {
  'use strict';

  // ── Token 估算 ──
  function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    let tokens = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 0x3000 && code < 0x9FFF) {
        tokens += 0.67; // CJK
      } else {
        tokens += 0.25; // Latin
      }
    }
    return Math.ceil(tokens);
  }

  // ── 價格表 ──
  const PRICING = {
    'opus':   { input: 5,  output: 25 },
    'sonnet': { input: 3,  output: 15 },
    'haiku':  { input: 1,  output: 5  },
    'default':{ input: 3,  output: 15 }
  };

  function getPrice(model) {
    if (!model) return PRICING['default'];
    const m = model.toLowerCase();
    if (m.includes('opus')) return PRICING['opus'];
    if (m.includes('sonnet')) return PRICING['sonnet'];
    if (m.includes('haiku')) return PRICING['haiku'];
    return PRICING['default'];
  }

  function calcCost(inputTokens, outputTokens, model) {
    const price = getPrice(model);
    return (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
  }

  // ── 發送 token 資料回 content script ──
  function emitToken(data) {
    window.dispatchEvent(new CustomEvent('__claude_nyan_token__', { detail: data }));
  }

  // ── Monkey-patch fetch ──
  const originalFetch = window.fetch;
  let lastModel = null;

  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input?.url || '';

    // 只攔截對話相關的 API
    const isChat = url.includes('/api/organizations/') &&
                   (url.includes('/chat_conversations/') || url.includes('/completion'));

    if (!isChat) {
      return originalFetch.apply(this, args);
    }

    try {
      let inputText = '';
      let model = null;

      if (init?.body) {
        try {
          const bodyStr = typeof init.body === 'string' ? init.body : null;
          if (bodyStr) {
            const bodyJson = JSON.parse(bodyStr);
            if (bodyJson.prompt) inputText = bodyJson.prompt;
            else if (bodyJson.messages) {
              inputText = bodyJson.messages
                .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
                .join(' ');
            }
            model = bodyJson.model || null;
            if (model) lastModel = model;
          }
        } catch (e) {}
      }

      const inputTokens = estimateTokens(inputText);
      const response = await originalFetch.apply(this, args);
      const cloned = response.clone();

      // 非同步處理 response
      processResponse(cloned, inputTokens, model).catch(() => {});

      return response;
    } catch (err) {
      return originalFetch.apply(this, args);
    }
  };

  async function processResponse(response, inputTokens, model) {
    let outputText = '';

    try {
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'content_block_delta' && event.delta?.text) {
                outputText += event.delta.text;
              }
              if (event.completion) {
                outputText += event.completion;
              }
              // 官方 usage 資訊
              if (event.type === 'message_delta' && event.usage) {
                const official = event.usage;
                if (official.output_tokens) {
                  emitToken({
                    timestamp: Date.now(),
                    inputTokens: official.input_tokens || inputTokens,
                    outputTokens: official.output_tokens,
                    model: model || lastModel || 'unknown',
                    cost: calcCost(official.input_tokens || inputTokens, official.output_tokens, model),
                    isOfficial: true
                  });
                  return;
                }
              }
            } catch (e) {}
          }
        }
      } else {
        const json = await response.json();
        if (json.content) {
          outputText = json.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('');
        }
        if (json.usage?.output_tokens) {
          emitToken({
            timestamp: Date.now(),
            inputTokens: json.usage.input_tokens || inputTokens,
            outputTokens: json.usage.output_tokens,
            model: model || lastModel || 'unknown',
            cost: calcCost(json.usage.input_tokens || inputTokens, json.usage.output_tokens, model),
            isOfficial: true
          });
          return;
        }
      }
    } catch (e) {}

    // 沒有官方 usage → 用估算
    const outputTokens = estimateTokens(outputText);
    if (inputTokens > 0 || outputTokens > 0) {
      emitToken({
        timestamp: Date.now(),
        inputTokens,
        outputTokens,
        model: model || lastModel || 'unknown',
        cost: calcCost(inputTokens, outputTokens, model),
        isOfficial: false
      });
    }
  }

  window.__claudeNyanPatched = true;
  console.log('🐱 Claude 用量喵喵 fetch interceptor 已注入！');
})();
