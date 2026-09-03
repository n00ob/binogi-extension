window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CONTENT_SCRIPT_READY") {
    sendModeToPage();
  }
});

function sendModeToPage() {
  chrome.storage.local.get(['quizMode'], (result) => {
    const mode = result.quizMode || 'highlight';
    window.postMessage({ type: "FROM_EXTENSION", mode: mode }, "*");
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === "UPDATE_MODE") {
    window.postMessage({ type: "FROM_EXTENSION", mode: request.mode }, "*");
  }
});

sendModeToPage();