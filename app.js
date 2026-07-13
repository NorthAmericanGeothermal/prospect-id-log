(() => {
  // ===== CONFIG =====
  const WORKER_BASE = "https://prospect-id-cloud.nagprospects.workers.dev";
  const PASSWORD = "Prospects2011!!#";
  const REMEMBER_KEY = "nageo_prospects_unlocked";
  const REMEMBER_DAYS = 30;

  // Supabase project — same as swift-api
  const SUPABASE_URL = "https://hpgwwegjsxyxovdattoc.supabase.co";
  const SUPABASE_KEY = "sb_publishable_D2PqYQoJjZ8koEM9NPvmeg_KB_Wa66H";
  const HCP_CREATE_FN = `${SUPABASE_URL}/functions/v1/hcp-create-customer`;

  // ── Element getters (safe — elements may be in modals) ──
  const el = (id) => document.getElementById(id);
  const statusLeft    = () => el("statusLeft");
  const countShown    = () => el("countShown");
  const searchBox     = () => el("searchBox");
  const leadForm      = () => el("leadForm");
  const serviceForm   = () => el("serviceForm");
  const formTitle     = () => el("formTitle");
  const formPill      = () => el("formPill");
  const prospectTable = () => el("prospectTable");
  const prospectBody  = () => el("prospectBody");
  const serviceTable  = () => el("serviceTable");
  const serviceBody   = () => el("serviceBody");
  const logTitle      = () => el("logTitle");
  const submitBtn     = () => el("submitBtn");
  const svcSubmitBtn  = () => el("svcSubmitBtn");
  const refreshBtn    = () => el("refreshBtn");
  const downloadCsvBtn  = () => el("downloadCsvBtn");
  const downloadXlsxBtn = () => el("downloadXlsxBtn");


  // ===== ELEMENTS =====
  const gateOverlay = document.getElementById("gateOverlay");
  const gatePassword = document.getElementById("gatePassword");
  const gateBtn = document.getElementById("gateBtn");
  const gateError = document.getElementById("gateError");

  const tabProspects = document.getElementById("tabProspects");
  const tabService = document.getElementById("tabService");







  // ===== STATE =====
  let unlocked = false;
  let view = "prospects"; // "prospects" | "service"
  let prospectRows = [];
  let serviceRows = [];

  // ===== UTIL =====
  const escapeHtml = (s) => {
    const str = (s == null) ? "" : String(s);
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const normalize = (v) => (v == null ? "" : String(v).trim());

  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const setStatus = (kind, msg) => {
    const cls = kind === "ok" ? "badge-ok" : (kind === "bad" ? "badge-bad" : "badge-warn");
    statusLeft().innerHTML = `Status: <span class="${cls}">${escapeHtml(msg)}</span>`;
  };

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCSV(headers, rows) {
    const esc = (value) => {
      const s = value == null ? "" : String(value);
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const lines = [];
    lines.push(headers.map(esc).join(","));
    for (const row of rows) lines.push(row.map(esc).join(","));
    return lines.join("\n");
  }

  function csvToXlsx(csvText) {
    const lines = csvText.split("\n").map(l => l.split(","));
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body><table border="1">
        ${lines.map(cols => `<tr>${cols.map(c => `<td>${escapeHtml(c.replace(/^"|"$/g, "").replaceAll('""','"'))}</td>`).join("")}</tr>`).join("")}
      </table></body></html>`;
    return new Blob([html], { type: "application/vnd.ms-excel" });
  }

  // ===== 30-DAY DEVICE MEMORY =====
  function saveRemember() {
    const expires = Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ expires }));
  }

  function checkRemember() {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return false;
      const { expires } = JSON.parse(raw);
      if (Date.now() < expires) return true;
      localStorage.removeItem(REMEMBER_KEY); // expired — clear it
      return false;
    } catch (e) {
      return false;
    }
  }

  // ===== PASSWORD GATE =====
  function unlock() {
    unlocked = true;
    saveRemember();
    gateOverlay.style.display = "none";
    setStatus("ok", "Unlocked");
    loadCurrentView();
  }

  function tryUnlock() {
    gateError.style.display = "none";
    const val = gatePassword.value || "";
    if (val === PASSWORD) unlock();
    else gateError.style.display = "block";
  }

  gateBtn.addEventListener("click", tryUnlock);
  gatePassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  });

  // ===== VIEW SWITCH =====
  function setActiveTab() {
    if (view === "prospects") {
      tabProspects.classList.add("active");
      tabService.classList.remove("active");

      leadForm().style.display = "";
      serviceForm().style.display = "none";

      prospectTable().style.display = "";
      serviceTable().style.display = "none";

      formTitle().childNodes[0].textContent = "New Prospect Lead Entry ";
      formPill.textContent = "Creates next 5-digit Prospect ID";
      submitBtn().textContent = "Submit Prospect";

      logTitle().innerHTML = `Prospect ID Log <span class="pill">Read-only</span>`;
      searchBox().placeholder = "Search ID / name / builder / phone…";
      const neb = document.getElementById("newEntryBtn");
      if (neb) neb.textContent = "＋ New Prospect";
      const mt = document.getElementById("entryModalTitle");
      const ms = document.getElementById("entryModalSub");
      if (mt) mt.textContent = "New Prospect Lead Entry";
      if (ms) ms.textContent = "Creates next 5-digit Prospect ID";
      const sb = document.getElementById("submitBtn");
      const sc = document.getElementById("svcSubmitBtn");
      if (sb) sb.style.display = "";
      if (sc) sc.style.display = "none";
    } else {
      tabProspects.classList.remove("active");
      tabService.classList.add("active");

      leadForm().style.display = "none";
      serviceForm().style.display = "";

      prospectTable().style.display = "none";
      serviceTable().style.display = "";

      formTitle().childNodes[0].textContent = "New Service Customer Entry ";
      formPill.textContent = "Creates next Service Customer ID";
      svcSubmitBtn().textContent = "Submit Service Customer";

      logTitle().innerHTML = `Service Customer ID Log <span class="pill">Read-only</span>`;
      searchBox().placeholder = "Search ID / name / phone / email…";
      const neb2 = document.getElementById("newEntryBtn");
      if (neb2) neb2.textContent = "＋ New Service Customer";
      const mt2 = document.getElementById("entryModalTitle");
      const ms2 = document.getElementById("entryModalSub");
      if (mt2) mt2.textContent = "New Service Customer Entry";
      if (ms2) ms2.textContent = "Creates next Service Customer ID";
      const sb2 = document.getElementById("submitBtn");
      const sc2 = document.getElementById("svcSubmitBtn");
      if (sb2) sb2.style.display = "none";
      if (sc2) sc2.style.display = "";
    }
  }

  tabProspects.addEventListener("click", () => {
    view = "prospects";
    setActiveTab();
    if (unlocked) renderAndCount();
  });

  tabService.addEventListener("click", () => {
    view = "service";
    setActiveTab();
    if (unlocked) renderAndCount();
  });

  // ===== API =====
  async function apiGet(path) {
    const res = await fetch(`${WORKER_BASE}${path}`, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GET ${path} failed (${res.status}): ${txt}`);
    }
    return res;
  }

  async function apiPost(path, payload) {
    const res = await fetch(`${WORKER_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `POST ${path} failed (${res.status})`);
    return data;
  }

  // ===== LOAD =====
  async function loadProspects() {
    const res = await apiGet("/api/leads?limit=1000&sort=desc");
    prospectRows = await res.json();
  }

  async function loadService() {
    const res = await apiGet("/api/service/customers?limit=1000&sort=desc");
    serviceRows = await res.json();
  }

  async function loadCurrentView() {
    try {
      setStatus("warn", "Loading…");
      if (view === "prospects") await loadProspects();
      else await loadService();
      setStatus("ok", "Ready");
      renderAndCount();
    } catch (e) {
      setStatus("bad", e.message || "Load failed");
      renderAndCount();
    }
  }

  // ===== RENDER + SEARCH =====
  function prospectSearchString(r) {
    return [
      r.prospect_id, r.entered_by, r.entered_date, r.source,
      r.builder_name, r.builder_phone, r.first_name, r.last_name,
      r.street_address, r.city, r.state, r.zip, r.primary_phone, r.contact_email, r.notes
    ].map(v => normalize(v).toLowerCase()).join(" | ");
  }

  function serviceSearchString(r) {
    return [
      r.service_id, r.entered_by, r.entered_date, r.first_name, r.last_name,
      r.street_address, r.city, r.state, r.zip,
      r.primary_phone, r.cell_phone, r.work_phone, r.contact_email, r.notes
    ].map(v => normalize(v).toLowerCase()).join(" | ");
  }

  function renderProspects(filtered) {
    if (!filtered.length) {
      prospectBody().innerHTML = `<tr><td colspan="15" style="padding:14px; color: rgba(159,176,208,.85);">No matching rows.</td></tr>`;
      return;
    }

    prospectBody().innerHTML = filtered.map(r => `
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
        <td>${notesCell(r.notes)}</td>
      </tr>
    `).join("");
  }

  function renderService(filtered) {
    if (!filtered.length) {
      serviceBody().innerHTML = `<tr><td colspan="14" style="padding:14px; color: rgba(159,176,208,.85);">No matching rows.</td></tr>`;
      return;
    }

    serviceBody().innerHTML = filtered.map(r => `
      <tr>
        <td>${escapeHtml(r.service_id)}</td>
        <td>${escapeHtml(r.entered_by)}</td>
        <td>${escapeHtml(r.entered_date)}</td>
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
        <td>${notesCell(r.notes)}</td>
      </tr>
    `).join("");
  }

  function renderAndCount() {
    const q = normalize(searchBox().value).toLowerCase();
    if (view === "prospects") {
      const filtered = q ? prospectRows.filter(r => prospectSearchString(r).includes(q)) : prospectRows.slice();
      renderProspects(filtered);
      countShown().textContent = String(filtered.length);
    } else {
      const filtered = q ? serviceRows.filter(r => serviceSearchString(r).includes(q)) : serviceRows.slice();
      renderService(filtered);
      countShown().textContent = String(filtered.length);
    }
  }

  document.addEventListener("input", function(e) { if (e.target && e.target.id === "searchBox") renderAndCount(); });

  // ===== SUBMIT: PROSPECT =====
  document.addEventListener("submit", async (e) => {
    const isLead = e.target.id === "leadForm";
    const isSvc  = e.target.id === "serviceForm";
    if (!isLead && !isSvc) return;
    e.preventDefault();
    if (!unlocked) return;

    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());

    if (isLead) {
      // ===== PROSPECT SUBMIT =====
      payload.entered_by  = normalize(payload.entered_by);
      payload.entered_date = normalize(payload.entered_date);
      payload.source      = normalize(payload.source);
      if (!payload.entered_by) return alert("Entered By is required.");
      if (!payload.source)     return alert("Source is required.");
      try {
        if (submitBtn()) { submitBtn().disabled = true; }
        setStatus("warn", "Submitting…");
        const out = await apiPost("/api/leads", payload);
        setStatus("ok", `Saved Prospect ID ${out.prospect_id} — creating HCP profile…`);
        leadForm().reset();
        closeEntryModal();
        await loadProspects();
        renderAndCount();
        createHCPCustomer(payload, ["prospect", out.prospect_id]);
      } catch (err) {
        setStatus("bad", err.message || "Submit failed");
        alert(`Submit failed: ${err.message || err}`);
      } finally {
        if (submitBtn()) { submitBtn().disabled = false; }
      }
    } else {
      // ===== SERVICE SUBMIT =====
      payload.entered_by  = normalize(payload.entered_by);
      payload.entered_date = normalize(payload.entered_date);
      payload.first_name  = normalize(payload.first_name);
      payload.last_name   = normalize(payload.last_name);
      if (!payload.entered_by)  return alert("Entered By is required.");
      if (!payload.first_name)  return alert("First Name is required.");
      if (!payload.last_name)   return alert("Last Name is required.");
      try {
        if (svcSubmitBtn()) { svcSubmitBtn().disabled = true; }
        setStatus("warn", "Submitting…");
        const out = await apiPost("/api/service/customers", payload);
        setStatus("ok", `Saved Service ID ${out.service_id} — creating HCP profile…`);
        serviceForm().reset();
        closeEntryModal();
        await loadService();
        renderAndCount();
        createHCPCustomer(payload, [out.service_id]);
      } catch (err) {
        setStatus("bad", err.message || "Submit failed");
        alert(`Submit failed: ${err.message || err}`);
      } finally {
        if (svcSubmitBtn()) { svcSubmitBtn().disabled = false; }
      }
    }
  });

  // ===== DOWNLOADS =====
  async function handleCsvDownload() {
    try {
      setStatus("warn", "Preparing CSV…");
      if (view === "prospects") {
        const res = await apiGet("/api/export.csv?sort=asc");
        const text = await res.text();
        downloadBlob("prospect_id_log.csv", new Blob([text], { type: "text/csv;charset=utf-8" }));
      } else {
        const res = await apiGet("/api/service/export.csv?sort=asc");
        const text = await res.text();
        downloadBlob("service_customer_log.csv", new Blob([text], { type: "text/csv;charset=utf-8" }));
      }
      setStatus("ok", "Download ready");
    } catch (e) {
      setStatus("bad", e.message || "Download failed");
      alert(`Download failed: ${e.message || e}`);
    }
  }

  async function handleXlsxDownload() {
    try {
      setStatus("warn", "Preparing Excel…");
      let csvText = "";
      if (view === "prospects") {
        const res = await apiGet("/api/export.csv?sort=asc");
        csvText = await res.text();
        downloadBlob("prospect_id_log.xls", csvToXlsx(csvText));
      } else {
        const res = await apiGet("/api/service/export.csv?sort=asc");
        csvText = await res.text();
        downloadBlob("service_customer_log.xls", csvToXlsx(csvText));
      }
      setStatus("ok", "Download ready");
    } catch (e) {
      setStatus("bad", e.message || "Download failed");
      alert(`Download failed: ${e.message || e}`);
    }
  }

  // ===== HCP CUSTOMER CREATION =====
  async function createHCPCustomer(payload, tags) {
    try {
      const res = await fetch(HCP_CREATE_FN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_KEY,
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({
          first_name:     payload.first_name    || "",
          last_name:      payload.last_name     || "",
          street_address: payload.street_address|| "",
          city:           payload.city          || "",
          state:          payload.state         || "",
          zip:            payload.zip           || "",
          primary_phone:  payload.primary_phone || "",
          contact_email:  payload.contact_email || "",
          notes:          payload.notes         || "",
          tags:           tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("HCP customer creation failed:", data);
        setStatus("warn", "Saved locally — HCP sync failed. Check console.");
      } else {
        setStatus("ok", `Saved & synced to HCP (ID: ${data.hcp_customer_id || "?"})`);
      }
    } catch (err) {
      console.warn("HCP create error:", err);
      setStatus("warn", "Saved locally — HCP sync error. Check console.");
    }
  }

    // ===== NOTES TOOLTIP HELPER =====
  function notesCell(notes) {
    const text = normalize(notes);
    if (!text) return '<span style="color:var(--text-muted,#aaa);font-size:11px;">&mdash;</span>';
    return `<span class="notes-cell"><span class="notes-yes">Yes</span><div class="notes-tip">${escapeHtml(text)}</div></span>`;
  }

  // Position notes tooltip near cursor
  document.addEventListener("mousemove", function(e) {
    const tip = document.querySelector(".notes-cell:hover .notes-tip");
    if (!tip) return;
    const x = e.clientX + 14;
    const y = e.clientY + 14;
    const overRight = x + 290 > window.innerWidth;
    tip.style.left = (overRight ? e.clientX - 294 : x) + "px";
    tip.style.top = (y + 120 > window.innerHeight ? e.clientY - 130 : y) + "px";
  });

  // ===== DELETE RECORD =====
  function openDeleteModal() {
    document.getElementById("del-step1").style.display = "";
    document.getElementById("del-step2").style.display = "none";
    document.getElementById("del-step3").style.display = "none";
    document.getElementById("del-pw").value = "";
    document.getElementById("del-id").value = "";
    document.getElementById("del-confirm").value = "";
    document.getElementById("del-err").textContent = "";
    document.getElementById("del-worker-hint").style.display = "none";
    document.getElementById("del-modal-bg").style.display = "flex";
  }

  function closeDeleteModal() {
    document.getElementById("del-modal-bg").style.display = "none";
  }

  function openEntryModal() {
    const bg = document.getElementById("entry-modal-bg");
    if (bg) bg.style.display = "flex";
  }

  function closeEntryModal() {
    const bg = document.getElementById("entry-modal-bg");
    if (bg) bg.style.display = "none";
  }

  function delStep1() {
    const pw = document.getElementById("del-pw").value;
    const err = document.getElementById("del-err");
    if (pw !== PASSWORD) { err.textContent = "Incorrect password."; return; }
    err.textContent = "";
    document.getElementById("del-step1").style.display = "none";
    document.getElementById("del-step2").style.display = "";
    document.getElementById("del-id").focus();
  }

  function delStep2() {
    const id = document.getElementById("del-id").value.trim();
    const err = document.getElementById("del-err");
    if (!id) { err.textContent = "Please enter the ID."; return; }
    const exists = view === "prospects"
      ? prospectRows.some(r => r.prospect_id === id)
      : serviceRows.some(r => r.service_id === id);
    if (!exists) { err.textContent = `ID "${id}" not found in current view.`; return; }
    err.textContent = "";
    document.getElementById("del-step2").style.display = "none";
    document.getElementById("del-step3").style.display = "";
    document.getElementById("del-confirm").focus();
  }

  async function delStep3() {
    const confirmVal = document.getElementById("del-confirm").value.trim();
    const id = document.getElementById("del-id").value.trim();
    const err = document.getElementById("del-err");
    if (confirmVal !== "DELETE") { err.textContent = "Type DELETE in all caps to confirm."; return; }
    err.textContent = "";
    const delBtn = document.getElementById("del-go-btn");
    delBtn.disabled = true; delBtn.textContent = "Deleting…";
    try {
      const path = view === "prospects"
        ? `/api/leads/${encodeURIComponent(id)}`
        : `/api/service/customers/${encodeURIComponent(id)}`;
      const res = await fetch(`${WORKER_BASE}${path}`, { method: "DELETE" });
      if (res.status === 404) {
        err.textContent = "Record not found — may already be deleted.";
        delBtn.disabled = false; delBtn.textContent = "Confirm Delete"; return;
      }
      if (res.status === 405 || res.status === 501) {
        err.textContent = "Worker doesn\'t support DELETE yet — see hint below.";
        document.getElementById("del-worker-hint").style.display = "";
        delBtn.disabled = false; delBtn.textContent = "Confirm Delete"; return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        err.textContent = `Delete failed (${res.status}): ${txt || "unknown error"}`;
        delBtn.disabled = false; delBtn.textContent = "Confirm Delete"; return;
      }
      if (view === "prospects") {
        prospectRows = prospectRows.filter(r => r.prospect_id !== id);
      } else {
        serviceRows = serviceRows.filter(r => r.service_id !== id);
      }
      renderAndCount();
      closeDeleteModal();
      setStatus("ok", `Record ${id} deleted.`);
    } catch (e) {
      err.textContent = "Network error: " + e.message;
      delBtn.disabled = false; delBtn.textContent = "Confirm Delete";
    }
  }

  // Wire toolbar buttons safely (they exist at this point since they're in static HTML)
  document.addEventListener("click", function(e) {
    var t = e.target.closest("button");
    if (!t) return;
    var id = t.id;
    if (id === "deleteRecordBtn") { openDeleteModal(); }
    else if (id === "newEntryBtn") { if (!unlocked) { alert("Please unlock the system first."); return; } openEntryModal(); }
    else if (id === "refreshBtn") { if (unlocked) loadCurrentView(); }
    else if (id === "downloadCsvBtn") { if (unlocked) handleCsvDownload(); }
    else if (id === "downloadXlsxBtn") { if (unlocked) handleXlsxDownload(); }
    else if (id === "submitBtn") { var lf = leadForm(); if(lf) lf.requestSubmit(); }
    else if (id === "svcSubmitBtn") { var sf = serviceForm(); if(sf) sf.requestSubmit(); }
  });

  // expose modal helpers globally
  window.openEntryModal = openEntryModal;
  window.closeEntryModal = closeEntryModal;
  window.closeDeleteModal = closeDeleteModal;
  window.delStep1 = delStep1;
  window.delStep2 = delStep2;
  window.delStep3 = delStep3;

  // ===== INIT =====
  setActiveTab();
  // Auto-unlock if this device remembered the password within 30 days
  if (checkRemember()) {
    unlock();
  } else {
    setStatus("warn", "Locked");
  }
})();
