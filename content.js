// Simple English Dictionary - Content Script

(() => {
  // Guard against duplicate injections
  if (window.__SIMPLE_DICT_INITIALIZED__) return;
  window.__SIMPLE_DICT_INITIALIZED__ = true;

  const POPUP_ID = "simple-dict-overlay-window";
  let activePopup = null;
  let lastLookupWord = "";
  let lastLookupTime = 0;
  let lastClickX = 0;
  let lastClickY = 0;
  let enabled = true;

  function refreshEnabled(callback) {
    if (!chrome.storage?.local) {
      callback(true);
      return;
    }
    chrome.storage.local.get({ enabled: true }, (settings) => {
      enabled = settings.enabled !== false;
      callback(enabled);
    });
  }

  function cleanWord(str) {
    if (!str) return "";
    return str.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "").toLowerCase();
  }

  function isInput(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable;
  }

  function removePopup() {
    const el = document.getElementById(POPUP_ID);
    if (el) el.remove();
    activePopup = null;
  }

  function showPopup(word, targetX, targetY) {
    removePopup();

    const popup = document.createElement("div");
    popup.id = POPUP_ID;

    const width = 320;
    const margin = 12;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let left = targetX !== undefined ? targetX - (width / 2) : (vpW - width) / 2;
    let top = targetY !== undefined ? targetY + 12 : 80;

    // Position above selection if overflowing below
    if (top + 240 > vpH && targetY > 260) {
      top = targetY - 260;
    }

    left = Math.max(margin, Math.min(left, vpW - width - margin));
    top = Math.max(margin, Math.min(top, vpH - 80));

    popup.style.cssText = `
      position: fixed !important;
      left: ${Math.round(left)}px !important;
      top: ${Math.round(top)}px !important;
      width: ${width}px !important;
      max-width: calc(100vw - 24px) !important;
      max-height: 400px !important;
      background: #f7f6f2 !important;
      color: #171717 !important;
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
      border: 1px solid #171717 !important;
      border-radius: 12px !important;
      box-shadow: 0 18px 45px rgba(23, 23, 23, 0.24) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      pointer-events: auto !important;
      text-align: left !important;
      box-sizing: border-box !important;
    `;

    popup.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:13px 15px; background:#ffffff; border-bottom:1px solid #dedbd4; box-sizing:border-box;">
        <span style="font-size:16px; font-weight:800; letter-spacing:-0.03em; color:#171717; text-transform:capitalize;">${escapeHtml(word)}</span>
        <button id="simple-dict-close-btn" title="Close (Esc)" style="background:transparent; border:none; font-size:20px; font-weight:400; color:#77736b; cursor:pointer; line-height:1; padding:0 2px;">&times;</button>
      </div>
      <div id="simple-dict-body" style="padding:12px 15px; overflow-y:auto; max-height:330px; color:#41413e; box-sizing:border-box;">
        <div style="color:#77736b; padding:10px 0;">Looking up definition...</div>
      </div>
    `;

    (document.body || document.documentElement).appendChild(popup);
    activePopup = popup;

    popup.querySelector("#simple-dict-close-btn").addEventListener("click", removePopup);

    fetchDefinition(word, (data, error) => {
      if (!popup.isConnected) return;
      const body = popup.querySelector("#simple-dict-body");
      if (!body) return;

      if (error || !data || !data.meanings || data.meanings.length === 0) {
        body.innerHTML = `<div style="color:#dc2626; padding:8px 0;">${escapeHtml(error || `No definition found for "${word}".`)}</div>`;
        return;
      }

      let html = "";
      data.meanings.forEach((m) => {
        let items = "";
        m.definitions.forEach((def) => {
          items += `<li style="margin-bottom:6px; color:#41413e; list-style-type:decimal;">${escapeHtml(def)}</li>`;
        });
        html += `
          <div style="margin-bottom:8px;">
            <div style="font-weight:700; font-size:10px; text-transform:uppercase; color:#77736b; margin-bottom:5px; letter-spacing:0.12em;">${escapeHtml(m.partOfSpeech)}</div>
            <ol style="padding-left:19px; margin:0 0 8px 0;">${items}</ol>
          </div>
        `;
      });

      body.innerHTML = html;
    });
  }

  function fetchDefinition(word, callback) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      let answered = false;
      const fallback = () => {
        if (answered) return;
        answered = true;
        directFetch(word, callback);
      };

      try {
        chrome.runtime.sendMessage({ type: "GET_DEFINITION", word }, (res) => {
          if (answered) return;
          if (!chrome.runtime.lastError && res) {
            answered = true;
            callback(res.success && res.data ? res.data : null, res.error || "Definition not found.");
          } else {
            fallback();
          }
        });
      } catch (e) {
        fallback();
      }

      setTimeout(fallback, 2000);
    } else {
      directFetch(word, callback);
    }
  }

  async function directFetch(word, callback) {
    try {
      const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`, {
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0 && items[0].defs && items[0].defs.length > 0) {
          const item = items[0];
          const posMap = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "definition" };
          const grouped = {};
          item.defs.forEach((d) => {
            const parts = d.split("\t");
            const code = parts[0] ? parts[0].trim() : "u";
            const text = parts[1] ? parts[1].trim() : d;
            const pos = posMap[code] || "general";
            if (!grouped[pos]) grouped[pos] = [];
            if (grouped[pos].length < 3) grouped[pos].push(text);
          });
          const meanings = Object.keys(grouped).map((k) => ({ partOfSpeech: k, definitions: grouped[k] }));
          callback({ word: item.word || word, meanings }, null);
          return;
        }
      }
    } catch (e) {}

    callback(null, `No definition found for "${word}".`);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getSelectedWord() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const raw = sel.toString().trim();
    if (!raw) return null;

    // Single English word only (no spaces, 2 to 35 letters)
    if (/\s/.test(raw)) return null;

    const cleaned = cleanWord(raw);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 35) return null;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
      word: cleaned,
      rect: rect
    };
  }

  function triggerLookup(defaultX, defaultY) {
    if (!enabled) return;
    const data = getSelectedWord();
    if (!data || !data.word) return;

    // Deduplicate rapid successive events (e.g. mouseup followed by dblclick within 400ms)
    const now = Date.now();
    if (data.word === lastLookupWord && (now - lastLookupTime) < 400 && activePopup) {
      return;
    }
    lastLookupWord = data.word;
    lastLookupTime = now;

    const x = (data.rect.width > 0) ? (data.rect.left + data.rect.width / 2) : defaultX;
    const y = (data.rect.height > 0) ? data.rect.bottom : defaultY;
    showPopup(data.word, x, y);
  }

  // TRIGGER 1: Mouse selection / Highlighting
  document.addEventListener("mouseup", (e) => {
    if (!enabled) return;
    if (isInput(e.target)) return;
    if (activePopup && activePopup.contains(e.target)) return;

    lastClickX = e.clientX;
    lastClickY = e.clientY;

    setTimeout(() => {
      triggerLookup(e.clientX, e.clientY);
    }, 20);
  });

  // TRIGGER 2: Double Click
  document.addEventListener("dblclick", (e) => {
    if (!enabled) return;
    if (isInput(e.target)) return;
    if (activePopup && activePopup.contains(e.target)) return;

    lastClickX = e.clientX;
    lastClickY = e.clientY;

    setTimeout(() => {
      let data = getSelectedWord();
      let word = data ? data.word : "";

      // Fallback: extract word under cursor if selection is collapsed
      if (!word && document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          range.expand("word");
          const raw = range.toString().trim();
          if (!/\s/.test(raw)) {
            word = cleanWord(raw);
          }
        }
      }

      if (word && word.length >= 2) {
        const now = Date.now();
        if (word === lastLookupWord && (now - lastLookupTime) < 400 && activePopup) {
          return;
        }
        lastLookupWord = word;
        lastLookupTime = now;
        showPopup(word, e.clientX, e.clientY);
      }
    }, 20);
  });

  // TRIGGER 3: Right-click Context Menu
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "SHOW_DEFINITION" && msg.word) {
        if (!enabled) return;
        const word = cleanWord(msg.word);
        if (word) {
          const data = getSelectedWord();
          const x = (data && data.rect.width > 0) ? (data.rect.left + data.rect.width / 2) : (lastClickX || window.innerWidth / 2);
          const y = (data && data.rect.height > 0) ? data.rect.bottom : (lastClickY || 100);
          showPopup(word, x, y);
        }
      }

      if (msg.type === "GET_CURRENT_SELECTION") {
        const data = getSelectedWord();
        sendResponse({ word: data ? data.word : "" });
        return false;
      }
    });
  }

  refreshEnabled(() => {});
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local" && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) removePopup();
    }
  });

  // Dismiss on outside click
  document.addEventListener("mousedown", (e) => {
    lastClickX = e.clientX;
    lastClickY = e.clientY;

    if (!activePopup) return;
    if (!activePopup.contains(e.target)) {
      removePopup();
    }
  });

  // Dismiss on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removePopup();
    }
  });
})();
