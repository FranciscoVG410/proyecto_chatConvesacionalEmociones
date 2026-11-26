const canvas = document.getElementById("vadChart");
const ctx = canvas.getContext("2d");
const chartContainer = canvas.parentElement;

let historyPoints = [];
let is3DMode = true;
let currentPeriod = "global";

const urlParams = new URLSearchParams(window.location.search);
const forcedPseudonym = (urlParams.get("pseudonym") || "").trim().toUpperCase();
const storedPseudonym = (localStorage.getItem("socius_pseudonym") || "").trim().toUpperCase();
let selectedPseudonym = forcedPseudonym || storedPseudonym || "";
const isPseudonymLocked = Boolean(forcedPseudonym || storedPseudonym);

const GENDER_BADGES = {
  m: "M",
  mujer: "M",
  femenino: "M",
  h: "H",
  hombre: "H",
  masculino: "H",
  nb: "NB",
  "no binario": "NB",
  nobinario: "NB",
  no_binario: "NB",
  pd: "PD",
  "prefiero no decirlo": "PD",
  prefiero_no_decirlo: "PD",
  "prefiero no responder": "PD"
};

function normalizePseudo(raw) {
  return (raw || "").trim().toUpperCase();
}

function formatGenderCode(rawGender) {
  if (!rawGender) return "";
  const normalized = String(rawGender).trim().toLowerCase();
  return GENDER_BADGES[normalized] || rawGender.trim().toUpperCase();
}

function escapeJsSingleQuote(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function extractGenderFromItem(item) {
  if (!item || typeof item !== "object") return "";
  return (
    item.gender ??
    item.genero ??
    item.género ??
    item.sex ??
    item.sexo ??
    item.participant_gender ??
    item.genero_participante ??
    item.profile?.gender ??
    item.profile?.genero ??
    ""
  );
}

function shouldAcceptPoint(pseudo, allowAutoLock = true) {
  const clean = normalizePseudo(pseudo);
  if (!selectedPseudonym) {
    if (!allowAutoLock || !clean || clean === "ANÓNIMO") {
      return false;
    }
    selectedPseudonym = clean;
    return true;
  }
  if (!isPseudonymLocked && clean && clean !== "ANÓNIMO" && clean !== selectedPseudonym) {
    selectedPseudonym = clean;
    historyPoints = [];
    return true;
  }
  return clean === selectedPseudonym;
}

function resizeCanvas() {
  const width = chartContainer.clientWidth;
  const height = chartContainer.clientHeight;
  if (width <= 0 || height <= 0) return;

  canvas.width = Math.floor(width);
  canvas.height = Math.floor(height);
  drawScene();
}

const chartResizeObserver = new ResizeObserver(() => {
  resizeCanvas();
});
chartResizeObserver.observe(chartContainer);
window.addEventListener("resize", resizeCanvas);

function toggleViewMode() {
  is3DMode = !is3DMode;
  const btn = document.getElementById("btn-toggle-view");
  btn.innerText = is3DMode ? "Vista: Cubo 3D" : "Vista: Planos 2D (V-A / D-A)";
  btn.style.backgroundColor = is3DMode ? "#4f46e5" : "#0d9488";
  drawScene();
}

function project3DToCabinet(v, a, d) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width * 0.28, height * 0.30);

  const centerX = width * 0.44;
  const centerY = height * 0.57;

  const angle = Math.PI / 4;
  const depthFactor = 0.45;
  const depthShift = (d + 1) * scale * depthFactor;

  const xScreen = centerX + v * scale + depthShift * Math.cos(angle);
  const yScreen = centerY - a * scale - depthShift * Math.sin(angle);

  return { x: xScreen, y: yScreen };
}

function drawScene() {
  if (is3DMode) {
    draw3DCubeScene();
  } else {
    drawDual2DScene();
  }
}

function drawDual2DScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;

  const boxSize = Math.min(width * 0.34, height * 0.62);
  const scale = boxSize / 2;

  const centerLeftX = width * 0.25;
  const centerRightX = width * 0.64;
  const centerY = height * 0.54;

  drawCartesianAxes(centerLeftX, centerY, scale, "Valencia (V)", "Activación (A)");
  drawPointsAndPath2D((pt) => ({
    x: centerLeftX + pt.v * scale,
    y: centerY - pt.a * scale
  }));

  drawCartesianAxes(centerRightX, centerY, scale, "Dominancia (D)", "Activación (A)");
  drawPointsAndPath2D((pt) => ({
    x: centerRightX + pt.d * scale,
    y: centerY - pt.a * scale
  }));
}

function drawCartesianAxes(centerX, centerY, scale, labelX, labelY) {
  ctx.save();
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(centerX - scale, centerY);
  ctx.lineTo(centerX + scale, centerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - scale);
  ctx.lineTo(centerX, centerY + scale);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = "#334155";
  ctx.font = "bold 11px Segoe UI";
  ctx.fillText(labelX, centerX + scale - 35, centerY + 18);
  ctx.fillText(labelY, centerX - 35, centerY - scale - 8);
}

function drawPointsAndPath2D(projectionFn) {
  if (historyPoints.length === 0) return;

  ctx.beginPath();
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);

  historyPoints.forEach((pt, index) => {
    const p = projectionFn(pt);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  historyPoints.forEach((pt, index) => {
    const p = projectionFn(pt);

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);

    if (pt.isCritical) {
      ctx.fillStyle = "#f59e0b";
      ctx.strokeStyle = "#b45309";
    } else if (index === historyPoints.length - 1) {
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#991b1b";
    } else {
      ctx.fillStyle = "#4f46e5";
      ctx.strokeStyle = "#312e81";
    }

    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  });
}

function draw3DCubeScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rawCorners = [
    { v: -1, a: -1, d: -1 }, { v: 1, a: -1, d: -1 }, { v: 1, a: 1, d: -1 }, { v: -1, a: 1, d: -1 },
    { v: -1, a: -1, d: 1 }, { v: 1, a: -1, d: 1 }, { v: 1, a: 1, d: 1 }, { v: -1, a: 1, d: 1 }
  ];

  const vertices = rawCorners.map((c) => project3DToCabinet(c.v, c.a, c.d));

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#16a34a";
  ctx.setLineDash([]);

  edges.forEach((edge) => {
    const p1 = vertices[edge[0]];
    const p2 = vertices[edge[1]];

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  ctx.save();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  const vAxisStart = project3DToCabinet(-1, 0, -1);
  const vAxisEnd = project3DToCabinet(1, 0, -1);
  ctx.beginPath(); ctx.moveTo(vAxisStart.x, vAxisStart.y); ctx.lineTo(vAxisEnd.x, vAxisEnd.y); ctx.stroke();

  const aAxisStart = project3DToCabinet(0, -1, -1);
  const aAxisEnd = project3DToCabinet(0, 1, -1);
  ctx.beginPath(); ctx.moveTo(aAxisStart.x, aAxisStart.y); ctx.lineTo(aAxisEnd.x, aAxisEnd.y); ctx.stroke();

  const dAxisStart = project3DToCabinet(0, 0, -1);
  const dAxisEnd = project3DToCabinet(0, 0, 1);
  ctx.beginPath(); ctx.moveTo(dAxisStart.x, dAxisStart.y); ctx.lineTo(dAxisEnd.x, dAxisEnd.y); ctx.stroke();

  ctx.restore();

  ctx.fillStyle = "#334155";
  ctx.font = "bold 11px Segoe UI";

  const labelV = project3DToCabinet(0, -1, -1);
  ctx.fillText("Valencia (V)", labelV.x - 25, labelV.y + 18);

  const labelA = project3DToCabinet(-1, 0, -1);
  ctx.fillText("Activación (A)", labelA.x - 75, labelA.y + 4);

  const labelD = project3DToCabinet(1, 1, 0);
  ctx.fillText("Dominancia (D)", labelD.x + 8, labelD.y - 4);

  drawPointsAndPath3D();
}

function drawPointsAndPath3D() {
  if (historyPoints.length === 0) return;

  ctx.beginPath();
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);

  historyPoints.forEach((pt, index) => {
    const projected = project3DToCabinet(pt.v, pt.a, pt.d);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.stroke();

  historyPoints.forEach((pt, index) => {
    const p = project3DToCabinet(pt.v, pt.a, pt.d);
    const pFloor = project3DToCabinet(pt.v, -1, pt.d);
    const pWall = project3DToCabinet(-1, pt.a, pt.d);

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(79, 70, 229, 0.45)";
    ctx.lineWidth = 1;

    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pFloor.x, pFloor.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pWall.x, pWall.y); ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);

    if (pt.isCritical) {
      ctx.fillStyle = "#f59e0b";
      ctx.strokeStyle = "#b45309";
    } else if (index === historyPoints.length - 1) {
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#991b1b";
    } else {
      ctx.fillStyle = "#4f46e5";
      ctx.strokeStyle = "#312e81";
    }

    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  });
}

function resetTelemetryDisplay() {
  document.getElementById("txt-prompt").innerText = "Esperando datos...";
  document.getElementById("txt-emotion").innerText = "---";
  document.getElementById("txt-coords").innerText = "V: 0.00 | A: 0.00 | D: 0.00";
  document.getElementById("txt-distance").innerText = "0.00";
}

function processPoint(item, allowAutoLock = true) {
  const dataObj = item.point || item.data || item;
  const itemPseudo = dataObj.pseudonym || item.pseudonym || "";

  if (!shouldAcceptPoint(itemPseudo, allowAutoLock)) {
    return;
  }

  const userMsg = dataObj.user_msg || dataObj.user_prompt || dataObj.prompt || "Sin mensaje";
  const emotion = dataObj.emotion || "---";

  const v = parseFloat(dataObj.v !== undefined ? dataObj.v : dataObj.x || 0);
  const a = parseFloat(dataObj.a !== undefined ? dataObj.a : dataObj.y || 0);
  const d = parseFloat(dataObj.d !== undefined ? dataObj.d : dataObj.z || 0);
  const isCritical = dataObj.is_critical || false;

  const distance = Math.sqrt(
    Math.pow(v - 0.6, 2) +
    Math.pow(a - -0.6, 2) +
    Math.pow(d - 0.5, 2)
  );

  document.getElementById("txt-prompt").innerText = `"${userMsg}"`;
  document.getElementById("txt-emotion").innerText = isCritical ? `${emotion} (ALERTA)` : emotion;
  document.getElementById("txt-coords").innerText = `V: ${v.toFixed(2)} | A: ${a.toFixed(2)} | D: ${d.toFixed(2)}`;
  document.getElementById("txt-distance").innerText = distance.toFixed(2);

  historyPoints.push({ v, a, d, isCritical });
  drawScene();
}

function renderParticipantList(participants, activePseudo, records = []) {
  const list = document.getElementById("participantList");
  if (!list) return;

  if (!participants || participants.length === 0) {
    list.innerHTML = `<li class="participant-empty">Sin participantes</li>`;
    return;
  }

  list.innerHTML = participants
    .map((p) => {
      const isObject = typeof p === "object" && p !== null;
      const pseudo = isObject
        ? (p.pseudonym ?? p.seudonimo ?? p.name ?? p.id ?? "")
        : String(p);

      let rawGender = isObject ? extractGenderFromItem(p) : "";

      if (!rawGender && Array.isArray(records) && records.length > 0) {
        const matchRecord = records.find((r) => {
          const recObj = r?.point || r?.data || r;
          const recPseudo = recObj?.pseudonym || r?.pseudonym || "";
          return normalizePseudo(recPseudo) === normalizePseudo(pseudo);
        });
        if (matchRecord) {
          const recObj = matchRecord.point || matchRecord.data || matchRecord;
          rawGender = extractGenderFromItem(recObj) || extractGenderFromItem(matchRecord);
        }
      }

      const code = formatGenderCode(rawGender);
      const label = code ? `${pseudo} (${code})` : pseudo;
      const isSelected = normalizePseudo(pseudo) === normalizePseudo(activePseudo);
      const safePseudo = escapeJsSingleQuote(pseudo);

      return `<li><button type="button" class="participant-item ${isSelected ? "active" : ""}" onclick="onParticipantChange('${safePseudo}')">${label}</button></li>`;
    })
    .join("");
}

function onParticipantChange(newPseudonym) {
  selectedPseudonym = normalizePseudo(newPseudonym);
  fetchHistory();
}

function setPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });
  fetchHistory();
}

function setDashboardLocked(locked) {
  const modal = document.getElementById("dashboardLoginModal");
  const content = document.getElementById("dashboardContent");
  if (modal) modal.style.display = locked ? "flex" : "none";
  if (content) content.classList.toggle("dashboard-locked", locked);
}

async function submitDashboardLogin() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  const errorEl = document.getElementById("loginErrorMsg");

  errorEl.style.display = "none";

  try {
    const response = await fetch("/api/dashboard/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      errorEl.innerText = "Usuario o contraseña incorrectos.";
      errorEl.style.display = "block";
      return;
    }

    setDashboardLocked(false);
    resizeCanvas();
    await fetchHistory();
  } catch (e) {
    errorEl.innerText = "Error de conexión con el servidor.";
    errorEl.style.display = "block";
  }
}

async function fetchHistory() {
  try {
    const params = new URLSearchParams({
      pseudonym: selectedPseudonym,
      period: currentPeriod
    });
    const response = await fetch(`/api/dashboard/data?${params.toString()}`);

    if (response.status === 401) {
      setDashboardLocked(true);
      return;
    }

    setDashboardLocked(false);
    const data = await response.json();

    if (data.selected_pseudonym) {
      selectedPseudonym = normalizePseudo(data.selected_pseudonym);
    }

    renderParticipantList(data.participants || [], selectedPseudonym, data.records || []);

    historyPoints = [];
    resetTelemetryDisplay();

    if (data.records && data.records.length > 0) {
      data.records.forEach((record) => processPoint(record, false));
      drawScene();
    } else {
      drawScene();
    }
  } catch (e) {
    console.error("Error al cargar historial:", e);
    resizeCanvas();
  }
}

setTimeout(resizeCanvas, 100);
fetchHistory();

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/analytics`);
ws.onmessage = function (event) {
  const rawData = JSON.parse(event.data);
  const item = rawData.point || rawData.data || rawData;
  processPoint(item, true);
};

function goToReport() {
  const pseudonymToUse = selectedPseudonym || localStorage.getItem("socius_pseudonym") || "";
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/report";
  form.target = "_blank";

  const fields = {
    pseudonym: pseudonymToUse,
    period: currentPeriod
  };

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}