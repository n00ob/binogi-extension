const modeButtons = {
  off: document.getElementById('off'),
  highlight: document.getElementById('highlight'),
  stealth: document.getElementById('stealth')
};
const fastCompleteToggle = document.getElementById('fastComplete');

function updateUI(activeId) {
  Object.keys(modeButtons).forEach(id => {
    modeButtons[id].classList.toggle('active', id === activeId);
  });
}

function sendMode(mode) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      func: (m) => { window.postMessage({ type: "FROM_EXTENSION", mode: m }, "*"); },
      args: [mode]
    });
  });
  updateUI(mode);
  chrome.storage.local.set({ currentMode: mode });
}

function sendFastComplete(enabled) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      func: (v) => { window.postMessage({ type: "FROM_EXTENSION", fastComplete: v }, "*"); },
      args: [enabled]
    });
  });
  chrome.storage.local.set({ fastComplete: enabled });
}

modeButtons.off.addEventListener('click', () => sendMode('off'));
modeButtons.highlight.addEventListener('click', () => sendMode('highlight'));
modeButtons.stealth.addEventListener('click', () => sendMode('stealth'));

fastCompleteToggle.addEventListener('change', () => {
  sendFastComplete(fastCompleteToggle.checked);
});

chrome.storage.local.get(['currentMode', 'fastComplete'], (result) => {
  if (result.currentMode) updateUI(result.currentMode);
  fastCompleteToggle.checked = result.fastComplete === true;
});