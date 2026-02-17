/* app.js
   v2: Adds a simple client-side password gate + keeps localStorage mode working immediately.
   NOTE: This is NOT truly secure on a static site (GitHub Pages). It is a basic "front door".
*/

(() => {
  // ====== CONFIG ======
  const START_ID = 22807;
  const SKIP_MIN = 50000;
  const SKIP_MAX = 69999;
  const JUMP_TO = 70001;

  const STORAGE_KEY = "prospectIdLog.leads.v1";
  const COUNTER_KEY = "prospectIdLog.nextId.v1";

  // Future backend endpoints (we’ll implement later)
  // const API_BASE = "https://YOUR-WORKER.your-subdomain.workers.dev";
  // const USE_BACKEND = true;
  const USE_BACKEND = false; // keep false for now; localStorage mode

  // ====== SIMPLE PASSWORD GATE (client-side) ======
  // Hash of: Prospects2011!!#
  // (Hashing avoids storing the plain password in this file, but it’s still client-side.)
  const PW_HASH = "ca1f9cc8771aa8458554f3d53b96c89666a18280c0ce5f3ebc290c46224017fe";
  const UNLOCK_KEY = "prospectIdLog.unlocked.session";

  const gateOverlay = document.getElementById("gateOverlay");
  const gatePassword = document.getElementById("gatePassword");
  const gateBtn = document.getElementById("gateBtn");
  const gateError = document.getElementById("gateError");

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

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

  async function tryUnlock() {
    if (!gatePassword || !gateError) return;

    gateError.style.display = "none";
    const entered = (gatePassword.value || "").trim();
    if (!entered) return;

    const hash = await sha256Hex(entered);
    if (hash === PW_HASH) {
      unlockUI();
      refresh(); // load once unlocked
    } else {
      gateError.style.display = "block";
      gatePassword.select();
    }
  }

  if (gateBtn) gateBtn.addEventListener("click", tryUnlock);
  if (gatePassword) {
    gatePassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
  }

  // ====== DOM ======
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
  let allRows = [];     // full dataset
  let visibleRows = []; // filtered dataset (rendered)

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

  function skipIfNeeded(id) {
    if (id >= SKIP_MIN && id <= SKIP_MAX) return JUMP_TO;
    return id;
  }

  function format5(id) {
    return String(id).padStart(5, "0");
  }

  function getNextIdLocal() {
    let next = Number(localStorage.getItem(COUNTER_KEY));
    if (!Number.isFinite(next) || next <= 0) next = START_ID;

    next = skipIfNeeded(next);

    const assigned = next;
    let following = assigned + 1;
    following = skipIfNeeded(following);

    localStorage.setItem(COUNTER_KEY, String(following));
    return assigned;
  }

  function loadRowsLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRowsLocal(rows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }

  function setStatus(connected, message = "") {
    const badge = connected
      ? `<span class="badge-ok">Connected</span>`
      : `<span class="badge-warn">Local mode</span>`;

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
    if (!q) {
      visibleRows = [...allRows];
    } else {
      visibleRows = allRows.filter(r => rowToSearchString(r).includes(q));
    }
    render(visibleRows);
  }

  function sortNewestFirst(rows) {
    return [...rows].sort((a, b) => Number(b._id_num) - Number(a._id_num));
  }

  function buildRowFromForm(formData) {
    const enteredBy = normalize(formData.get("entered_by"));
    const enteredDateRaw = normalize(formData.get("entered_date"));
    const enteredDate = enteredDateRaw ? enteredDateRaw : todayISO();

    return {
      prospect_id: "",

      entered_by: enteredBy,
      entered_date: enteredDate,

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

      _id_num: 0,
      _created_at: new Date().toISOString(),
    };
  }

  function validateRowBasic(row) {
    if (!row.entered_by) return "Entered By is required.";
    if (!row.source) return "Source is required.";
    return "";
  }

  function downloadBlob(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const s = (value ?? "").toString();
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function exportCSV(rows) {
    const headers = [
      "Prospect ID",
      "Entered By",
      "Entered Date",
      "Source",
      "Builder Name",
      "Builder Phone",
      "First Name",
      "Last Name",
      "Street Address",
      "City",
      "State",
      "Zip",
      "Primary Phone",
      "Contact Email",
      "Notes",
    ];

    const lines = [];
    lines.push(headers.join(","));

    for (const r of rows) {
      const line = [
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
      ].map(csvEscape).join(",");
      lines.push(line);
    }

    return lines.join("\n");
  }

  // ====== BACKEND PLACEHOLDERS (not used yet) ======
  async function apiListLeads() {
    throw new Error("Backend not enabled yet.");
  }

  async function apiCreateLead(payload) {
    throw new Error("Backend not enabled yet.");
  }

  // ====== CORE ACTIONS ======
  function refreshLocal() {
    const rows = loadRowsLocal();
    for (const r of rows) {
      const n = Number((r.prospect_id ?? "").toString());
      r._id_num = Number.isFinite(n) ? n : (r._id_num ?? 0);
    }
    allRows = sortNewestFirst(rows);
    applyFilter();
    setStatus(false, "— running on this browser only (localStorage).");
  }

  async function refresh() {
    if (!USE_BACKEND) return refreshLocal();

    try {
      setStatus(true, "— loading from API…");
      const data = await apiListLeads();
      allRows = sortNewestFirst(data.map(r => ({
        ...r,
        prospect_id: r.prospect_id?.toString() ?? "",
        _id_num: Number(r.prospect_id) || 0,
      })));
      applyFilter();
      setStatus(true, "— live data loaded.");
    } catch (err) {
      console.error(err);
      setStatus(false, "— failed to load from API, staying in local mode.");
      refreshLocal();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const fd = new FormData(form);
      const row = buildRowFromForm(fd);

      const error = validateRowBasic(row);
      if (error) {
        alert(error);
        return;
      }

      if (!USE_BACKEND) {
        const assigned = getNextIdLocal();
        row.prospect_id = String(assigned);
        row._id_num = assigned;

        const existing = loadRowsLocal();
        existing.push(row);
        saveRowsLocal(existing);

        form.reset();
        await refresh();
        alert(`Created Prospect ID: ${format5(assigned)}`);
        return;
      }

      const payload = { ...row };
      delete payload.prospect_id;
      delete payload._id_num;
      delete payload._created_at;

      const created = await apiCreateLead(payload);
      form.reset();
      await refresh();
      alert(`Created Prospect ID: ${format5(Number(created.prospect_id))}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Lead";
    }
  }

  function handleDownloadCSV() {
    const csv = exportCSV(visibleRows);
    const filename = `prospect_id_log_${todayISO()}.csv`;
    downloadBlob(filename, "text/csv;charset=utf-8", csv);
  }

  function handleDownloadXlsx() {
    alert("Excel download will be enabled when we add the backend export endpoint. CSV works now.");
  }

  // ====== WIRE EVENTS ======
  form.addEventListener("submit", handleSubmit);

  searchBox.addEventListener("input", () => {
    applyFilter();
  });

  refreshBtn.addEventListener("click", () => refresh());

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
