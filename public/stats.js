const codeLabel = document.getElementById("code-label");
const loadingEl = document.getElementById("stats-loading");
const errorEl = document.getElementById("stats-error");
const contentEl = document.getElementById("stats-content");

const shortUrlEl = document.getElementById("short-url");
const originalUrlEl = document.getElementById("original-url");
const clickCountEl = document.getElementById("click-count");
const lastClickedEl = document.getElementById("last-clicked");
const createdAtEl = document.getElementById("created-at");
const copyShortBtn = document.getElementById("copy-short");
const visitShortLink = document.getElementById("visit-short");

// Extract code from /code/:code
const pathParts = window.location.pathname.split("/");
const code = pathParts[pathParts.length - 1] || "";

codeLabel.textContent = code || "(unknown)";

async function loadStats() {
  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  contentEl.classList.add("hidden");

  if (!code) {
    loadingEl.classList.add("hidden");
    errorEl.textContent = "Invalid code.";
    errorEl.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`/api/links/${encodeURIComponent(code)}`);
    const data = await res.json();

    if (!res.ok) {
      loadingEl.classList.add("hidden");
      errorEl.textContent = data.error || "Link not found.";
      errorEl.classList.remove("hidden");
      return;
    }

    loadingEl.classList.add("hidden");
    contentEl.classList.remove("hidden");

    shortUrlEl.textContent = data.shortUrl;
    shortUrlEl.href = data.shortUrl;
    originalUrlEl.textContent = data.originalUrl;
    originalUrlEl.href = data.originalUrl;
    clickCountEl.textContent = data.clickCount;

    lastClickedEl.textContent = data.lastClickedAt
      ? new Date(data.lastClickedAt).toLocaleString()
      : "Never";

    createdAtEl.textContent = data.createdAt
      ? new Date(data.createdAt).toLocaleString()
      : "-";

    visitShortLink.href = data.shortUrl;
  } catch (err) {
    console.error(err);
    loadingEl.classList.add("hidden");
    errorEl.textContent = "Failed to load stats.";
    errorEl.classList.remove("hidden");
  }
}

copyShortBtn.addEventListener("click", async () => {
  const text = shortUrlEl.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyShortBtn.textContent = "Copied!";
    setTimeout(() => (copyShortBtn.textContent = "Copy"), 1200);
  } catch {
    alert("Failed to copy");
  }
});

loadStats();
