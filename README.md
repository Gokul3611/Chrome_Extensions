# 📖 Simple English Dictionary — Browser Extension

A **zero-bloat, open-source** browser extension for Brave and Chrome that shows the standard English definition of any word instantly — right where you are reading.

No accounts. No tracking. No ads. Just the meaning of the word.

---

## ✨ Features

- **Double-click** any word on any webpage → definition pops up instantly
- **Highlight / drag** across any word → definition appears at your selection
- **Right-click** any selected word → choose **"Define '[word]'"**
- **Toolbar search** → click the extension icon and type any word manually
- Clean, minimal popup anchored to your cursor — closes on `Esc` or click outside
- Works on every webpage automatically after installation
- **Zero dependencies** — no frameworks, no npm, no build step
- **Resource efficient** — zero background CPU when idle; service worker sleeps between lookups

---

## 🚀 Installation (Load Unpacked)

> Works in **Brave**, **Chrome**, **Edge**, and any Chromium-based browser.

1. [Download or clone this repository](https://github.com/Gokul3611/Chrome_Extensions)
2. Open your browser and navigate to:
   ```
   brave://extensions     (Brave)
   chrome://extensions   (Chrome)
   ```
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the cloned **`Chrome_Extensions`** folder (the folder containing `manifest.json`)
6. Done ✅ — go to any webpage and double-click a word

---

## 🗂️ File Structure

```
Chrome_Extensions/
├── manifest.json     # Extension config (Manifest V3)
├── content.js        # In-page triggers and floating definition window
├── background.js     # Service worker — fetches definitions, caches results
├── popup.html        # Toolbar popup for manual word search
├── popup.js          # Toolbar popup controller
├── test.html         # Local test page (open in browser to verify)
├── .gitignore
├── LICENSE           # MIT
└── README.md
```

---

## 🔌 API

Definitions are fetched from two free, public, no-auth APIs with automatic fallback:

| Priority | API | Notes |
|:--------:|:----|:------|
| 1st | [Free Dictionary API](https://dictionaryapi.dev/) | Rich data — parts of speech, phonetics |
| 2nd | [Datamuse API](https://www.datamuse.com/api/) | High availability fallback |

No API key required. No data is sent except the single word you look up.

---

## 🛡️ Privacy

- **No data collection** of any kind
- **No analytics or telemetry**
- **No account required**
- Only network requests made are to the two public dictionary APIs listed above
- All results are cached locally in the service worker memory (cleared on browser restart)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Open an issue for bugs or feature requests
- Submit a pull request for improvements

To contribute:
```bash
git clone https://github.com/Gokul3611/Chrome_Extensions.git
cd Chrome_Extensions/simple-dictionary-extension
# Make your changes, then load unpacked in your browser to test
```

---

## 📄 License

[MIT](./LICENSE) — free to use, modify, and distribute.
