(() => {
  // ====== CONFIG ======
  const API_BASE = "https://prospect-id-cloud.nagprospects.workers.dev";

  const START_PROSPECT_ID = 22807;
  const START_SERVICE_ID = 60000;

  // Simple password (client-side)
  const PASSWORD = "Prospects2011!!#";
  const UNLOCK_KEY = "idLogs.unlocked.session";

  // ====== DOM: Gate ======
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
      refreshProspects();
      refreshService();
      setStatusesConnected();
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

  // ====== Tabs ======
  const tabProspects = document.getElementById("tabProspects");
  const tabService = document.getElementById("tabService");
  const viewProspects = document.getElementById("viewProspects");
  const viewService = document.getElementById("viewService");

  function setTab(which) {
    const isPros = which === "prospects";
    tabProspects.classList.toggle("active", isPros);
    tabService.classList.toggle("active", !isPros);
    viewProspects.classList.toggle("hidden", !isPros);
    viewService.classList.toggle("hidden", isPros);
  }

  tabProspects.addEventListener("click", () => setTab("prospects"));
  tabService.addEventListener("click", () => setTab("service"));

  // ====== Shared helpers ======
  function normalize(str) {
    return (str ?? "").toString().trim();
  }

  function escapeHtml(s) {
    return (s ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatProspectId(id) {
    const n = Number(id);
    if (!Number.isFinite(n)) return String(id);
    return String(n).padStart(5, "0");
  }

  function setStatusesConnected() {
    const statusLeft = document.getElementById("statusLeft");
    const svcStatusLeft = document.getElementById("svcStatusLeft");
    if (statusLeft) statusLeft.innerHTML = `Status: <span class="badge-ok">Connected</span> <span class="small">— cloud storage</span>`;
    if (svcStatusLeft) svcStatusLeft.innerHTML = `Status: <span class="badge-ok">Connected</span> <span class="small">— cloud storage</span>`;
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  // ======================================================
  // Prospects (existing)
  // ======================================================
  const leadForm = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");
  const searchBox = document.getElementById("searchBox");
  const refreshBtn = document.getElementById("refreshBtn");
  const downloadCsvBtn = document.getElementById("downloadCsvBtn");
  const logBody = document.getElementById("logBody");
  const countShown = document.getElementById("countShown");

  let prospectAll = [];
  let prospectVisible = [];

  function prospectSearchString(r) {
    return [
      r.prospect_id, r.entered_by, r.entered_date, r.source,
      r.builder_name, r.builder_phone,
      r.first_name, r.last_name,
      r.street_address, r.city, r.state, r.zip,
      r.primary_phone, r.contact_email, r.notes
    ].join(" ").toLowerCase();
  }

  function renderProspects(rows) {
    logBody.innerHTML = "";
    if (!rows.length) {
      logBody.innerHTML = `<tr><td colspan="15" style="padding:14px; color: rgba(159,176,208,.85);">No entries yet.</td></tr>`;
      countShown.textContent = "0";
      return;
    }

    logBody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(formatProspectId(r.prospect_id))}</td>
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

    countShown.textContent = String(rows.length);
  }

  function applyProspectFilter() {
    const q = normalize(searchBox.value).toLowerCase();
    prospectVisible = !q ? [...prospectAll] : prospectAll.filter(r => prospectSearchString(r).includes(q));
    renderProspects(prospectVisible);
  }

  async function refreshProspects() {
    if (!isUnlocked()) return;
    const url = `${API_BASE}/api/leads?fromId=${START_PROSPECT_ID}&limit=800&sort=desc`;
    const data = await fetchJson(url, { method: "GET" });
    prospectAll = [...(data || [])].sort((a, b) => Number(b.prospect_id) - Number(a.prospect_id));
    applyProspectFilter();
  }

  async function submitProspect(e) {
    e.preventDefault();
    if (!isUnlocked()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const fd = new FormData(leadForm);
      const payload = Object.fromEntries(fd.entries());
      payload.entered_by = normalize(payload.entered_by);
      payload.source = normalize(payload.source);

      if (!payload.entered_by) throw new Error("Entered By is required.");
      if (!payload.source) throw new Error("Source is required.");

      const created = await fetchJson(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      leadForm.reset();
      await refreshProspects();
      alert(`Created Prospect ID: ${formatProspectId(created.prospect_id)}`);
    } catch (err) {
      alert(`Submit failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Lead";
    }
  }

  function downloadProspectCSV() {
    window.open(`${API_BASE}/api/export.csv?fromId=${START_PROSPECT_ID}&sort=asc`, "_blank", "noopener,noreferrer");
  }

  leadForm.addEventListener("submit", submitProspect);
  searchBox.addEventListener("input", applyProspectFilter);
  refreshBtn.addEventListener("click", refreshProspects);
  downloadCsvBtn.addEventListener("click", downloadProspectCSV);

  // ======================================================
  // Service Customers (new)
  // ======================================================
  const serviceForm = document.getElementById("serviceForm");
  const serviceSubmitBtn = document.getElementById("serviceSubmitBtn");
  const svcSearchBox = document.getElementById("svcSearchBox");
  const svcRefreshBtn = document.getElementById("svcRefreshBtn");
  const svcDownloadCsvBtn = document.getElementById("svcDownloadCsvBtn");
  const svcBody = document.getElementById("svcBody");
  const svcCountShown = document.getElementById("svcCountShown");

  let serviceAll = [];
  let serviceVisible = [];

  function serviceSearchString(r) {
    return [
      r.service_id, r.first_name, r.last_name,
      r.street_address, r.city, r.state, r.zip,
      r.primary_phone, r.cell_phone, r.work_phone,
      r.contact_email, r.notes
    ].join(" ").toLowerCase();
  }

  function renderService(rows) {
    svcBody.innerHTML = "";
    if (!rows.length) {
      svcBody.innerHTML = `<tr><td colspan="12" style="padding:14px; color: rgba(159,176,208,.85);">No entries yet.</td></tr>`;
      svcCountShown.textContent = "0";
      return;
    }

    svcBody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.service_id)}</td>
        <td>${escapeHtml(r.first_name)}</td>
        <td>${escapeHtml(r.last_name)}</td>
        <td>${escapeHtml(r.street_address)}</td>
        <td>${escapeHtml(r.city)}</td>
        <td>${escapeHtml(r.state)}</td>
        <td>${escapeHtml(r.zip)}</td>
        <td>${escapeHtml(r.primary_phone)}</td>
        <td>${escapeHtml(r.cell_phone)}</td>
        <td>${escapeHtml(r.work_phone)}</td>
        <td>${escapeHtml(r.contact_email)}</td>
        <td>${escapeHtml(r.notes)}</td>
      </tr>
    `).join("");

    svcCountShown.textContent = String(rows.length);
  }

  function applyServiceFilter() {
    const q = normalize(svcSearchBox.value).toLowerCase();
    serviceVisible = !q ? [...serviceAll] : serviceAll.filter(r => serviceSearchString(r).includes(q));
    renderService(serviceVisible);
  }

  async function refreshService() {
    if (!isUnlocked()) return;
    const url = `${API_BASE}/api/service/customers?fromId=${START_SERVICE_ID}&limit=800&sort=desc`;
    const data = await fetchJson(url, { method: "GET" });
    serviceAll = [...(data || [])].sort((a, b) => Number(b.service_id) - Number(a.service_id));
    applyServiceFilter();
  }

  async function submitService(e) {
    e.preventDefault();
    if (!isUnlocked()) return;

    serviceSubmitBtn.disabled = true;
    serviceSubmitBtn.textContent = "Submitting…";

    try {
      const fd = new FormData(serviceForm);
      const payload = Object.fromEntries(fd.entries());

      payload.first_name = normalize(payload.first_name);
      payload.last_name = normalize(payload.last_name);

      if (!payload.first_name) throw new Error("First Name is required.");
      if (!payload.last_name) throw new Error("Last Name is required.");

      const created = await fetchJson(`${API_BASE}/api/service/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      serviceForm.reset();
      await refreshService();
      alert(`Created Service ID: ${created.service_id}`);
    } catch (err) {
      alert(`Submit failed: ${err.message}`);
    } finally {
      serviceSubmitBtn.disabled = false;
      serviceSubmitBtn.textContent = "Submit Service Customer";
    }
  }

  function downloadServiceCSV() {
    window.open(`${API_BASE}/api/service/export.csv?fromId=${START_SERVICE_ID}&sort=asc`, "_blank", "noopener,noreferrer");
  }

  serviceForm.addEventListener("submit", submitService);
  svcSearchBox.addEventListener("input", applyServiceFilter);
  svcRefreshBtn.addEventListener("click", refreshService);
  svcDownloadCsvBtn.addEventListener("click", downloadServiceCSV);

  // ===== INIT =====
  if (isUnlocked()) {
    if (gateOverlay) gateOverlay.style.display = "none";
    setStatusesConnected();
    refreshProspects();
    refreshService();
  } else {
    lockUI();
  }
})();
