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
    result.textContent = "";
    const loading = document.createElement("div");
    loading.style.cssText = "padding: 10px 0; color: #6b7280;";
    loading.textContent = "Searching...";
    result.appendChild(loading);

    chrome.runtime.sendMessage({ type: "GET_DEFINITION", word }, (res) => {
      if (!res || !res.success || !res.data) {
        result.textContent = "";
        const error = document.createElement("div");
        error.className = "error";
        error.textContent = res?.error || "Definition not found.";
        result.appendChild(error);
        return;
      }

      const data = res.data;
      result.textContent = "";
      const title = document.createElement("div");
      title.style.cssText = "font-size: 15px; font-weight: bold; margin-bottom: 6px; text-transform: capitalize;";
      title.textContent = data.word;
      result.appendChild(title);

      data.meanings.forEach((m) => {
        const posTitle = document.createElement("div");
        posTitle.className = "pos-title";
        posTitle.textContent = m.partOfSpeech;
        result.appendChild(posTitle);

        const list = document.createElement("ol");
        m.definitions.forEach((d) => {
          const item = document.createElement("li");
          item.textContent = d;
          list.appendChild(item);
        });
        result.appendChild(list);
      });
    });
  }
});
