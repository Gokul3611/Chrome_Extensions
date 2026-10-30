// Simple English Dictionary - Background Service Worker

const cache = new Map();

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "define-word",
      title: "Define '%s'",
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) {
        // Ignored, avoids crashing
      }
    });
  });
}

// Register context menu and inject into open tabs
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();

  // Inject content script into ALL currently open tabs immediately
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("brave://")) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["content.js"]
        }).catch(() => {});
      }
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

// Handle right-click context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "define-word" && tab?.id) {
    const rawWord = (info.selectionText || "").trim();
    if (!rawWord) return;

    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_DEFINITION",
      word: rawWord
    }).catch(() => {
      // If script wasn't injected, inject now and retry
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"]
      }).then(() => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            type: "SHOW_DEFINITION",
            word: rawWord
          }).catch(() => {});
        }, 100);
      }).catch(() => {});
    });
  }
});

// Fetch definition on request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_DEFINITION") {
    const raw = (request.word || "").trim();
    const word = raw.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "").toLowerCase();

    if (!word) {
      sendResponse({ success: false, error: "Please select an English word." });
      return false;
    }

    if (cache.has(word)) {
      sendResponse({ success: true, data: cache.get(word) });
      return false;
    }

    fetchDefinition(word)
      .then((data) => {
        if (cache.size > 300) {
          cache.delete(cache.keys().next().value);
        }
        cache.set(word, data);
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message || "Definition not found." });
      });

    return true; // Keep message channel open for async response
  }
});

async function fetchDefinition(word) {
  // 1. Try Free Dictionary API
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const entry = json[0];
        const meanings = [];
        (entry.meanings || []).forEach((m) => {
          const partOfSpeech = m.partOfSpeech || "";
          const defs = (m.definitions || []).slice(0, 3).map((d) => d.definition);
          if (defs.length > 0) {
            meanings.push({ partOfSpeech, definitions: defs });
          }
        });
        if (meanings.length > 0) {
          return { word: entry.word || word, meanings };
        }
      }
    }
  } catch (e) {}

  // 2. Try Datamuse API (fast, robust fallback)
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
        if (meanings.length > 0) {
          return { word: item.word || word, meanings };
        }
      }
    }
  } catch (e) {}

  throw new Error(`No definition found for "${word}".`);
}
