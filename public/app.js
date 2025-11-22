const baseUrlPrefixEl = document.getElementById("base-url-prefix");
const form = document.getElementById("create-form");
const urlInput = document.getElementById("url");
const codeInput = document.getElementById("code");
const submitBtn = document.getElementById("submit-btn");
const submitBtnText = document.getElementById("submit-btn-text");
const submitSpinner = document.getElementById("submit-spinner");
const formMessage = document.getElementById("form-message");

const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-btn");
const linksBody = document.getElementById("links-body");
const tableMessage = document.getElementById("table-message");

function setBaseUrlPrefix() {
  if (!baseUrlPrefixEl) return;
  baseUrlPrefixEl.textContent = `${window.location.origin}/`;
  baseUrlPrefixEl.classList.remove("hidden");
}

setBaseUrlPrefix();

function setFormMessage(text, type = "info") {
  formMessage.textContent = text || "";
  formMessage.className = "mt-3 text-sm";
  if (!text) return;
  if (type === "error") formMessage.classList.add("text-red-600");
  else if (type === "success") formMessage.classList.add("text-green-700");
  else formMessage.classList.add("text-slate-600");
}

function setTableMessage(text) {
  tableMessage.textContent = text || "";
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (isLoading) {
    submitBtnText.textContent = "Creating…";
    submitSpinner.classList.remove("hidden");
  } else {
    submitBtnText.textContent = "Shorten";
    submitSpinner.classList.add("hidden");
  }
}

function validateCode(code) {
  if (!code) return true;
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

function validateUrl(url) {
  if (!url) return false;
  let val = url.trim();
  if (!/^https?:\/\//i.test(val)) {
    val = "https://" + val;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(val);
    return true;
  } catch {
    return false;
  }
}

/* ------------------ LOAD LINKS ------------------ */

async function fetchLinks(opts = {}) {
  const { search } = opts;
  linksBody.innerHTML = `
    <tr>
      <td colspan="6" class="px-3 py-4 text-center text-xs text-slate-500">
        Loading links…
      </td>
    </tr>
  `;
  setTableMessage("");

  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/links?${params.toString()}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      linksBody.innerHTML = `
        <tr>
          <td colspan="6" class="px-3 py-4 text-center text-xs text-slate-500">
            No links yet. Create one above.
          </td>
        </tr>
      `;
      return;
    }

    linksBody.innerHTML = "";

    data.forEach((link) => {
      const tr = document.createElement("tr");
      tr.className = "border-t border-slate-100 hover:bg-slate-50/60";

      const lastClicked = link.lastClickedAt
        ? new Date(link.lastClickedAt).toLocaleString()
        : "Never";

      const targetDisplay = link.originalUrl.length > 60
        ? link.originalUrl.slice(0, 57) + "..."
        : link.originalUrl;

      tr.innerHTML = `
        <td class="px-3 py-2 align-top text-xs font-mono text-slate-800">
          <a href="/code/${link.code}" class="underline hover:text-slate-900">
            ${link.code}
          </a>
        </td>
        <td class="px-3 py-2 align-top text-xs">
          <a href="${link.shortUrl}" target="_blank" class="text-blue-600 underline break-all">
            ${link.shortUrl}
          </a>
        </td>
        <td class="px-3 py-2 align-top text-xs">
          <a href="${link.originalUrl}" target="_blank" class="text-slate-700 underline block truncate max-w-xs md:max-w-md">
            ${targetDisplay}
          </a>
        </td>
        <td class="px-3 py-2 align-top text-right text-xs font-medium">
          ${link.clickCount}
        </td>
        <td class="px-3 py-2 align-top text-xs text-slate-500 whitespace-nowrap">
          ${lastClicked}
        </td>
        <td class="px-3 py-2 align-top text-xs">
          <div class="flex flex-wrap gap-2">
            <button
              class="copy-btn px-2 py-1 rounded-md border border-slate-300 hover:bg-slate-100"
              data-code="${link.code}"
            >
              Copy
            </button>
            <a
              href="/code/${link.code}"
              class="px-2 py-1 rounded-md border border-slate-300 hover:bg-slate-100"
            >
              Stats
            </a>
            <button
              class="delete-btn px-2 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50"
              data-code="${link.code}"
            >
              Delete
            </button>
          </div>
        </td>
      `;

      linksBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    linksBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-3 py-4 text-center text-xs text-red-600">
          Failed to load links.
        </td>
      </tr>
    `;
  }
}

/* ------------------ FORM HANDLER ------------------ */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormMessage("");
  setLoading(true);

  const url = urlInput.value.trim();
  const code = codeInput.value.trim();

  if (!validateUrl(url)) {
    setLoading(false);
    return setFormMessage("Please enter a valid URL.", "error");
  }

  if (!validateCode(code)) {
    setLoading(false);
    return setFormMessage(
      "Custom code must be 6–8 characters and only letters/numbers.",
      "error"
    );
  }

  try {
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        code: code || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        setFormMessage("That code already exists. Please choose another.", "error");
      } else {
        setFormMessage(data.error || "Failed to create link.", "error");
      }
      setLoading(false);
      return;
    }

    setFormMessage(`Short URL created: ${data.shortUrl}`, "success");
    urlInput.value = "";
    codeInput.value = "";

    await fetchLinks({ search: searchInput.value.trim() });
  } catch (err) {
    console.error(err);
    setFormMessage("Something went wrong. Please try again.", "error");
  } finally {
    setLoading(false);
  }
});

/* ------------------ TABLE ACTIONS ------------------ */

linksBody.addEventListener("click", async (e) => {
  const copyBtn = e.target.closest(".copy-btn");
  const deleteBtn = e.target.closest(".delete-btn");

  if (copyBtn) {
    const code = copyBtn.dataset.code;
    const shortUrl = `${window.location.origin}/${code}`;
    console.log(shortUrl)
    try {
      await navigator.clipboard.writeText(shortUrl);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    } catch {
      alert("Failed to copy to clipboard");
    }
  }

  if (deleteBtn) {
    const code = deleteBtn.dataset.code;
    const ok = confirm(`Delete link "${code}"?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/links/${code}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete");
        return;
      }
      await fetchLinks({ search: searchInput.value.trim() });
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  }
});

/* ------------------ SEARCH & REFRESH ------------------ */

searchInput.addEventListener("input", () => {
  const value = searchInput.value.trim();
  setTableMessage("Filtering…");
  fetchLinks({ search: value }).then(() => {
    setTableMessage("");
  });
});

refreshBtn.addEventListener("click", () => {
  searchInput.value = "";
  fetchLinks();
});

/* ------------------ INITIAL LOAD ------------------ */

fetchLinks();
