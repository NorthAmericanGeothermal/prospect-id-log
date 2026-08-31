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
    const sl = statusLeft();
    if (sl) sl.innerHTML = `Status: <span class="${cls}">${escapeHtml(msg)}</span>`;
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

      if(leadForm()) leadForm().style.display = "";
      if(serviceForm()) serviceForm().style.display = "none";

      if(prospectTable()) prospectTable().style.display = "";
      if(serviceTable()) serviceTable().style.display = "none";

      if(formTitle()) formTitle().childNodes[0].textContent = "New Prospect Lead Entry ";
      const fp = el('formPill'); if(fp) fp.textContent = "Creates next 5-digit Prospect ID";
      if(submitBtn()) submitBtn().textContent = "Submit Prospect →";

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

      if(leadForm()) leadForm().style.display = "none";
      if(serviceForm()) serviceForm().style.display = "";

      if(prospectTable()) prospectTable().style.display = "none";
      if(serviceTable()) serviceTable().style.display = "";

      if(formTitle()) formTitle().childNodes[0].textContent = "New Service Customer Entry ";
      const fp2 = el('formPill'); if(fp2) fp2.textContent = "Creates next Service Customer ID";
      if(svcSubmitBtn()) svcSubmitBtn().textContent = "Submit Service Customer →";

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
    const sb = document.getElementById("hcpSyncBtn");
    if (sb) sb.dataset.mode = "prospect";
    setActiveTab();
    if (unlocked) renderAndCount();
  });

  tabService.addEventListener("click", () => {
    view = "service";
    const sb = document.getElementById("hcpSyncBtn");
    if (sb) sb.dataset.mode = "service";
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
  let _submitting = false;
  document.addEventListener("submit", async (e) => {
    const isLead = e.target.id === "leadForm";
    const isSvc  = e.target.id === "serviceForm";
    if (!isLead && !isSvc) return;
    e.preventDefault();
    if (!unlocked) return;
    if (_submitting) return; // prevent double-fire
    _submitting = true;

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
        // Only sync to HCP if we have at least a name
    if ((payload.first_name || payload.last_name || payload.contact_email || payload.primary_phone)) {
      createHCPCustomer(payload, [String(out.prospect_id), "Prospect"]);
    }
      } catch (err) {
        setStatus("bad", err.message || "Submit failed");
        alert(`Submit failed: ${err.message || err}`);
      } finally {
        if (submitBtn()) { submitBtn().disabled = false; }
        _submitting = false;
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
        if ((payload.first_name || payload.last_name || payload.contact_email || payload.primary_phone)) {
      createHCPCustomer(payload, [String(out.service_id)]);
    }
      } catch (err) {
        setStatus("bad", err.message || "Submit failed");
        alert(`Submit failed: ${err.message || err}`);
      } finally {
        if (svcSubmitBtn()) { svcSubmitBtn().disabled = false; }
        _submitting = false;
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
  var _pendingHCPPayload = null;
  var _pendingHCPTags = null;

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
          first_name:     payload.first_name     || "",
          last_name:      payload.last_name      || "",
          street_address: payload.street_address || "",
          city:           payload.city           || "",
          state:          payload.state          || "",
          zip:            payload.zip            || "",
          primary_phone:  payload.primary_phone  || "",
          contact_email:  payload.contact_email  || "",
          notes:          payload.notes          || "",
          tags:           tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("HCP customer creation failed:", data);
        setStatus("warn", "Saved locally — HCP sync failed. Check console.");
        return;
      }
      if (data.duplicates_found && data.candidates && data.candidates.length > 0) {
        // Store for later use by modal buttons
        _pendingHCPPayload = payload;
        _pendingHCPTags = tags;
        showDuplicateModal(data.candidates, tags);
        return;
      }
      if (data.skipped) {
        setStatus("ok", "Saved locally (no HCP profile — no identifying info provided).");
        return;
      }
      setStatus("ok", `Saved & synced to HCP (ID: ${data.hcp_customer_id || "?"})`);
    } catch (err) {
      console.warn("HCP create error:", err);
      setStatus("warn", "Saved locally — HCP sync error. Check console.");
    }
  }

  async function tagExistingHCPCustomer(hcpId) {
    closeDuplicateModal();
    try {
      setStatus("warn", "Tagging existing HCP profile…");
      const res = await fetch(HCP_CREATE_FN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_KEY,
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({
          action: "tag_existing",
          hcp_customer_id: hcpId,
          tags: _pendingHCPTags || [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setStatus("warn", "Could not tag existing HCP profile. Check console.");
        console.warn("Tag existing failed:", data);
      } else {
        setStatus("ok", `Tagged existing HCP profile (ID: ${hcpId})`);
      }
    } catch (err) {
      console.warn("Tag existing error:", err);
      setStatus("warn", "Saved locally — HCP tag error. Check console.");
    }
    _pendingHCPPayload = null;
    _pendingHCPTags = null;
  }

  async function createNewHCPAnyway() {
    closeDuplicateModal();
    if (!_pendingHCPPayload || !_pendingHCPTags) return;
    const payload = _pendingHCPPayload;
    const tags = _pendingHCPTags;
    _pendingHCPPayload = null;
    _pendingHCPTags = null;
    try {
      setStatus("warn", "Creating new HCP profile…");
      const res = await fetch(HCP_CREATE_FN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_KEY,
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({
          action: "force_create",
          first_name:     payload.first_name     || "",
          last_name:      payload.last_name      || "",
          street_address: payload.street_address || "",
          city:           payload.city           || "",
          state:          payload.state          || "",
          zip:            payload.zip            || "",
          primary_phone:  payload.primary_phone  || "",
          contact_email:  payload.contact_email  || "",
          notes:          payload.notes          || "",
          tags:           tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("warn", "Saved locally — HCP create failed. Check console.");
      } else {
        setStatus("ok", `New HCP profile created (ID: ${data.hcp_customer_id || "?"})`);
      }
    } catch (err) {
      setStatus("warn", "Saved locally — HCP create error. Check console.");
    }
  }

  function showDuplicateModal(candidates, tags) {
    var body = document.getElementById("dup-modal-body");
    if (!body) return;
    var html = '<p style="font-size:13px;color:var(--text-mid);margin-bottom:14px;">We found <strong>' + candidates.length + '</strong> possible existing HCP profile' + (candidates.length !== 1 ? "s" : "") + ' that may match. Choose one to tag, or create a new profile.</p>';
    candidates.forEach(function(c) {
      var name = ((c.first_name || "") + " " + (c.last_name || "")).trim() || "Unknown";
      var addrs = c.addresses && c.addresses.length ? c.addresses[0] : null;
      var addr = addrs ? [addrs.street, addrs.city, addrs.state, addrs.zip].filter(Boolean).join(", ") : "";
      var score = c._score || 0;
      html += '<div style="border:1.5px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">';
      html += '<div style="flex:1">';
      html += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:3px;">' + name + '</div>';
      if (addr) html += '<div style="font-size:12px;color:var(--text-muted);">' + addr + '</div>';
      if (c.email) html += '<div style="font-size:12px;color:var(--text-muted);">' + c.email + '</div>';
      if (c.mobile_number) html += '<div style="font-size:12px;color:var(--text-muted);">' + c.mobile_number + '</div>';
      html += '<div style="font-size:10px;color:var(--accent);margin-top:4px;font-weight:600;">' + score + ' field' + (score !== 1 ? "s" : "") + ' matched</div>';
      html += '</div>';
      html += '<button onclick="window.tagExistingHCPCustomer(\'' + c.id + '\')" style="flex-shrink:0;padding:8px 14px;background:var(--navy);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Tag this profile</button>';
      html += '</div></div>';
    });
    body.innerHTML = html;
    document.getElementById("dup-modal-bg").style.display = "flex";
  }

  function closeDuplicateModal() {
    var bg = document.getElementById("dup-modal-bg");
    if (bg) bg.style.display = "none";
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
    const idUpper = id.toUpperCase().trim();
    const exists = view === "prospects"
      ? prospectRows.some(r => (r.prospect_id || "").toString().trim() === idUpper)
      : serviceRows.some(r => (r.service_id || "").toString().trim() === idUpper);
    if (!exists) { err.textContent = `ID "${id}" not found. Check the current tab (Prospects vs Service) and try again.`; return; }
    // store normalized
    document.getElementById("del-id").value = idUpper;
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
      const idNorm = id.toUpperCase().trim();
      if (view === "prospects") {
        prospectRows = prospectRows.filter(r => (r.prospect_id || "").toString().trim() !== idNorm);
      } else {
        serviceRows = serviceRows.filter(r => (r.service_id || "").toString().trim() !== idNorm);
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
    else if (id === "hcpSyncBtn") { if (unlocked) openHCPSyncModal(); }
    else if (id === "hcpSyncImportBtn") { if (unlocked) importHCPSelected(); }
    else if (id === "downloadCsvBtn") { if (unlocked) handleCsvDownload(); }
    else if (id === "downloadXlsxBtn") { if (unlocked) handleXlsxDownload(); }
    else if (id === "submitBtn") { var lf = leadForm(); if(lf) { var ev = new Event("submit", {bubbles:true, cancelable:true}); lf.dispatchEvent(ev); } }
    else if (id === "svcSubmitBtn") { var sf = serviceForm(); if(sf) { var ev2 = new Event("submit", {bubbles:true, cancelable:true}); sf.dispatchEvent(ev2); } }
  });

  // ===== HCP SYNC FROM HCP =====
  var _hcpSyncCandidates = [];

  async function openHCPSyncModal() {
    const btn = document.getElementById("hcpSyncBtn");
    const mode = (btn && btn.dataset && btn.dataset.mode) ? btn.dataset.mode : view;
    const tag = mode === "prospect" ? "Prospect" : "Service";
    const modal = document.getElementById("hcpSyncModal");
    const body = document.getElementById("hcpSyncBody");
    const title = document.getElementById("hcpSyncTitle");
    title.textContent = `Sync "${tag}" customers from HCP`;
    body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">Searching HCP for customers with the <strong>' + tag + '</strong> tag but no ID number yet…</div>';
    modal.classList.add("open");

    try {
      setStatus("warn", "Searching HCP…");
      const res = await apiGet("/api/hcp-sync-preview?tag=" + encodeURIComponent(tag));
      const data = await res.json();
      _hcpSyncCandidates = data.candidates || [];

      if (!_hcpSyncCandidates.length) {
        body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">✅ No unregistered <strong>' + tag + '</strong> customers found in HCP. Everyone already has an ID.</div>';
        setStatus("ok", "Sync complete — nothing to import.");
        return;
      }

      renderSyncPreview(_hcpSyncCandidates, tag);
      setStatus("ok", _hcpSyncCandidates.length + " unregistered customer(s) found.");
    } catch(e) {
      body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--red);">❌ Could not search HCP: ' + escapeHtml(e.message) + '</div>';
      setStatus("bad", "HCP sync search failed.");
    }
  }

  function renderSyncPreview(candidates, tag) {
    const body = document.getElementById("hcpSyncBody");
    let html = '<p style="font-size:13px;color:var(--text-mid);margin-bottom:14px;">Found <strong>' + candidates.length + '</strong> HCP customer' + (candidates.length !== 1 ? 's' : '') + ' with the <strong>' + tag + '</strong> tag but no ID number. Uncheck any you do not want to import, then click Import.</p>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;padding-right:4px;">';
    candidates.forEach(function(c, i) {
      var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Unknown';
      var addr = '';
      if (c.addresses && c.addresses.length) {
        addr = [c.addresses[0].street, c.addresses[0].city, c.addresses[0].state, c.addresses[0].zip].filter(Boolean).join(', ');
      }
      html += '<label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:1.5px solid var(--border);border-radius:var(--radius);cursor:pointer;background:#fff;">';
      html += '<input type="checkbox" checked data-idx="' + i + '" style="margin-top:3px;width:16px;height:16px;flex-shrink:0;accent-color:var(--navy);">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:14px;font-weight:700;color:var(--text);">' + escapeHtml(name) + '</div>';
      if (addr) html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(addr) + '</div>';
      if (c.email) html += '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml(c.email) + '</div>';
      if (c.mobile_number) html += '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml(c.mobile_number) + '</div>';
      html += '</div></label>';
    });
    html += '</div>';
    body.innerHTML = html;
    document.getElementById("hcpSyncImportBtn").style.display = "";
  }

  async function importHCPSelected() {
    const checkboxes = document.querySelectorAll("#hcpSyncBody input[type=checkbox]");
    const selected = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) selected.push(_hcpSyncCandidates[parseInt(cb.dataset.idx)]);
    });
    if (!selected.length) { alert("No customers selected."); return; }

    const btn2 = document.getElementById("hcpSyncBtn");
    const mode = (btn2 && btn2.dataset && btn2.dataset.mode) ? btn2.dataset.mode : view;
    const body = document.getElementById("hcpSyncBody");
    const importBtn = document.getElementById("hcpSyncImportBtn");
    importBtn.disabled = true;
    const total = selected.length;
    let imported = 0;
    let failed = 0;
    let failedNames = [];

    // Show progress UI
    function renderProgress(current, name) {
      const pct = Math.round((current / total) * 100);
      body.innerHTML =
        '<div style="padding:1.5rem 1rem;">' +
        '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">Importing customers…</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">Please wait — do not close this window.</div>' +
        '<div style="background:var(--border);border-radius:20px;height:10px;overflow:hidden;margin-bottom:10px;">' +
          '<div id="syncProgressBar" style="height:100%;background:#7c3aed;border-radius:20px;transition:width .3s;width:' + pct + '%"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:16px;">' +
          '<span>' + current + ' of ' + total + ' done</span>' +
          '<span>' + pct + '%</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--text-muted);background:#f8fafc;border-radius:8px;padding:10px 14px;border:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          '⟳ ' + escapeHtml(name || "Processing…") +
        '</div>' +
        '</div>';
    }

    renderProgress(0, selected[0] ? ((selected[0].first_name || "") + " " + (selected[0].last_name || "")).trim() : "");
    setStatus("warn", "Importing 0 of " + total + "…");

    // Process one at a time so we can show progress
    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      const name = ((c.first_name || "") + " " + (c.last_name || "")).trim();
      renderProgress(i, name);

      try {
        const data = await apiPost("/api/hcp-sync-import", {
          candidates: [c],
          mode: mode,
        });
        if (data.imported) imported++;
        else { failed++; failedNames.push(name); }
      } catch(e) {
        failed++;
        failedNames.push(name);
        console.warn("Import failed for", name, e);
      }

      setStatus("warn", "Importing " + (i + 1) + " of " + total + "…");
    }

    // Done
    renderProgress(total, "Complete!");
    body.innerHTML =
      '<div style="padding:2rem;text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:14px;">' + (failed === 0 ? "✅" : "⚠️") + '</div>' +
      '<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px;">' +
        imported + ' customer' + (imported !== 1 ? "s" : "") + ' imported!' +
      '</div>' +
      (failed > 0
        ? '<div style="font-size:13px;color:var(--red);margin-top:8px;">' + failed + ' could not be imported: ' + failedNames.map(escapeHtml).join(", ") + '</div>'
        : '<div style="font-size:13px;color:var(--green);margin-top:6px;">All done — IDs assigned and HCP profiles tagged.</div>'
      ) +
      '</div>';

    setStatus("ok", imported + " of " + total + " imported from HCP.");
    importBtn.disabled = false;
    if (unlocked) loadCurrentView();
  }

  // expose modal helpers globally

  window.openEntryModal = openEntryModal;
  window.tagExistingHCPCustomer = tagExistingHCPCustomer;
  window.createNewHCPAnyway = createNewHCPAnyway;
  window.closeDuplicateModal = closeDuplicateModal;
  window.closeEntryModal = closeEntryModal;
  window.closeDeleteModal = closeDeleteModal;
  window.delStep1 = delStep1;
  window.delStep2 = delStep2;
  window.delStep3 = delStep3;
  window.importHCPSelected = importHCPSelected;
  window.openHCPSyncModal = openHCPSyncModal;

  // ===== INIT =====
  try {
    setActiveTab();
  } catch(e) { console.error("setActiveTab error:", e); }

  // Auto-unlock if this device remembered the password within 30 days
  try {
    if (checkRemember()) {
      unlock();
    } else {
      setStatus("warn", "Locked");
    }
  } catch(e) {
    console.error("Init error:", e);
    // Fallback — make sure gate is visible even if init crashes
    var go = document.getElementById("gateOverlay");
    if (go) go.style.display = "flex";
  }
})();
