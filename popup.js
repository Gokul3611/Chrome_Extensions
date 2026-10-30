// Simple English Dictionary - Toolbar Popup

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");
  const input = document.getElementById("word-input");
  const result = document.getElementById("result");

  // Check if active tab has highlighted text to auto-fill
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "GET_CURRENT_SELECTION" }, (resp) => {
        if (!chrome.runtime.lastError && resp?.word) {
          input.value = resp.word;
          searchWord(resp.word);
        }
      });
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (word) {
      searchWord(word);
    }
  });

  function searchWord(word) {
    result.innerHTML = '<div style="padding: 10px 0; color: #6b7280;">Searching...</div>';

    chrome.runtime.sendMessage({ type: "GET_DEFINITION", word }, (res) => {
      if (!res || !res.success || !res.data) {
        result.innerHTML = `<div class="error">${res?.error || "Definition not found."}</div>`;
        return;
      }

      const data = res.data;
      let html = `<div style="font-size: 15px; font-weight: bold; margin-bottom: 6px; text-transform: capitalize;">${data.word}</div>`;

      data.meanings.forEach((m) => {
        let items = "";
        m.definitions.forEach((d) => {
          items += `<li>${d}</li>`;
        });
        html += `
          <div class="pos-title">${m.partOfSpeech}</div>
          <ol>${items}</ol>
        `;
      });

      result.innerHTML = html;
    });
  }
});
