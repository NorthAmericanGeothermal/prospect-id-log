/* app.js
   v4: Uses Cloudflare Worker + D1 for shared cloud storage across computers.
   Keeps simple client-side password gate.
*/

(() => {
  // ====== CONFIG ======
  const START_ID = 22807;

  // Cloud API base (your deployed Worker)
  const API_BASE = "https://prospect-id-cloud.nagprospects.workers.dev";
  const USE_BACKEND = true;

  // Simple password (client-side)
  const PASSWORD = "Prospects2011!!#";
  const UNLOCK_KEY = "prospectIdLog.unlocked.session";

  // ====== DOM (Gate) ======
  const gateOverlay = document.getElementById("gateOverlay");
  const gatePassword = document.getElementById("gatePassword");
  const gateBtn = document.getElementById("gateBtn");
  const gateError = document.getElementById("gateError");

  function isUnlocked() {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  }

  function lockUI() {
    if (gateOverlay) gateOverlay.style.display = "flex";
    if (gateError) gateError.style.display = "none";
    if (gatePassword) {
      gatePassword.value = "";
      setTimeout(() => gatePassword.focus(), 0);
    }
  }

  function unlockUI() {
    sessionStorage.setItem(UNLOCK_KEY, "1");
    if (gateOverlay) gateOverlay.style.display = "none";
  }

  function tryUnlock() {
    if (!gatePassword || !gateError) return;

    gateError.style.display = "none";
    const entered = (gatePassword.value || "").trim();

    if (entered === PASSWORD) {
      unlockUI();
      refresh(); // load once unlocked
    } else {
      gateError.style.display = "block";
      gatePassword.select();
    }
  }

  if (gateBtn) {
    gateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      tryUnlock();
    });
  }
  if (gatePassword) {
    gatePassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryUnlock();
      }
    });
  }

  // ====== DOM (Main app) ======
  const form = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");

  const logBody = document.getElementById("logBody");
  const countShown = document.getElementById("countShown");
  const statusLeft = document.getElementById("statusLeft");

  const searchBox = document.getElementById("searchBox");
  const refreshBtn = document.getElementById("refreshBtn");
  const downloadCsvBtn = document.getElementById("downloadCsvBtn");
  const downloadXlsxBtn = document.getElementById("downloadXlsxBtn");

  // ====== STATE ======
  let allRows = [];
  let visibleRows = [];

  // ====== HELPERS ======
  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function normalize(str) {
    return (str ?? "").toString().trim();
  }

  function format5(id) {
    return String(id).padStart(5, "0");
  }

  function setStatus(connected, message = "") {
    const badge = connected
      ? `<span class="badge-ok">Connected</span>`
      : `<span class="badge-warn">Not connected</span>`;
    statusLeft.innerHTML = `Status: ${badge} <span class="small">${message}</span>`;
  }

  function rowToSearchString(r) {
    return [
      r.prospect_id,
      r.entered_by,
      r.entered_date,
      r.source,
      r.builder_name,
      r.builder_phone,
      r.first_name,
      r.last_name,
      r.street_address,
      r.city,
      r.state,
      r.zip,
      r.primary_phone,
      r.contact_email,
      r.notes,
    ].join(" ").toLowerCase();
  }

  function escapeHtml(s) {
    return (s ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render(rows) {
    logBody.innerHTML = "";

    if (!rows.length) {
      logBody.innerHTML = `
        <tr>
          <td colspan="15" style="padding:14px; color: rgba(159,176,208,.85);">
            No entries yet. Submit a lead on the left to start the log.
          </td>
        </tr>`;
      countShown.textContent = "0";
      return;
    }

    const html = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.prospect_id)}</td>
        <td>${escapeHtml(r.entered_by)}</td>
        <td>${escapeHtml(r.entered_date)}</td>
        <td>${escapeHtml(r.source)}</td>
        <td>${escapeHtml(r.builder_name)}</td>
        <td>${escapeHtml(r.builder_phone)}</td>
        <td>${escapeHtml(r.first_name)}</td>
        <td>${escapeHtml(r.last_name)}</td>
        <td>${escapeHtml(r.street_address)}</td>
        <td>${escapeHtml(r.city)}</td>
        <td>${escapeHtml(r.state)}</td>
        <td>${escapeHtml(r.zip)}</td>
        <td>${escapeHtml(r.primary_phone)}</td>
        <td>${escapeHtml(r.contact_email)}</td>
        <td>${escapeHtml(r.notes)}</td>
      </tr>
    `).join("");

    logBody.innerHTML = html;
    countShown.textContent = String(rows.length);
  }

  function applyFilter() {
    const q = normalize(searchBox.value).toLowerCase();
    visibleRows = !q ? [...allRows] : allRows.filter(r => rowToSearchString(r).includes(q));
    render(visibleRows);
  }

  function sortNewestFirst(rows) {
    return [...rows].sort((a, b) => Number(b.prospect_id) - Number(a.prospect_id));
  }

  function buildPayloadFromForm(formData) {
    const enteredDateRaw = normalize(formData.get("entered_date"));
    const entered_date = enteredDateRaw ? enteredDateRaw : ""; // backend auto-fills if blank

    return {
      entered_by: normalize(formData.get("entered_by")),
      entered_date,
      source: normalize(formData.get("source")),

      builder_name: normalize(formData.get("builder_name")),
      builder_phone: normalize(formData.get("builder_phone")),

      first_name: normalize(formData.get("first_name")),
      last_name: normalize(formData.get("last_name")),

      street_address: normalize(formData.get("street_address")),
      city: normalize(formData.get("city")),
      state: normalize(formData.get("state")),
      zip: normalize(formData.get("zip")),

      primary_phone: normalize(formData.get("primary_phone")),
      contact_email: normalize(formData.get("contact_email")),

      notes: normalize(formData.get("notes")),
    };
  }

  function validatePayloadBasic(payload) {
    if (!payload.entered_by) return "Entered By is required.";
    if (!payload.source) return "Source is required.";
    return "";
  }

  // ====== API ======
  async function apiListLeads() {
    const url = `${API_BASE}/api/leads?fromId=${START_ID}&limit=500&sort=desc`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async function apiCreateLead(payload) {
    const res = await fetch(`${API_BASE}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json(); // { prospect_id: #### }
  }

  function apiExportCsvUrl() {
    return `${API_BASE}/api/export.csv?fromId=${START_ID}&sort=asc`;
  }

  // ====== CORE ACTIONS ======
  async function refresh() {
    if (!USE_BACKEND) return;

    try {
      setStatus(true, "— loading from cloud…");
      const data = await apiListLeads();
      allRows = sortNewestFirst((data || []).map(r => ({
        ...r,
        prospect_id: (r.prospect_id ?? "").toString(),
      })));
      applyFilter();
      setStatus(true, "— cloud data loaded.");
    } catch (err) {
      console.error(err);
      setStatus(false, "— failed to load cloud data (check Worker URL / CORS).");
      // Keep existing table if any
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const fd = new FormData(form);
      const payload = buildPayloadFromForm(fd);

      const error = validatePayloadBasic(payload);
      if (error) {
        alert(error);
        return;
      }

      const created = await apiCreateLead(payload);
      form.reset();
      await refresh();

      alert(`Created Prospect ID: ${format5(Number(created.prospect_id))}`);
    } catch (err) {
      console.error(err);
      alert("Submit failed. Check your internet connection and try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Lead";
    }
  }

  function handleDownloadCSV() {
    // Open CSV directly from backend (always up to date)
    window.open(apiExportCsvUrl(), "_blank", "noopener,noreferrer");
  }

  function handleDownloadXlsx() {
    alert("Excel download will be enabled next (we'll add /api/export.xlsx). CSV works now.");
  }

  // ====== WIRE EVENTS ======
  form.addEventListener("submit", handleSubmit);
  searchBox.addEventListener("input", applyFilter);
  refreshBtn.addEventListener("click", refresh);
  downloadCsvBtn.addEventListener("click", handleDownloadCSV);
  downloadXlsxBtn.addEventListener("click", handleDownloadXlsx);

  // ====== INIT ======
  if (isUnlocked()) {
    if (gateOverlay) gateOverlay.style.display = "none";
    refresh();
  } else {
    lockUI();
  }
})();
