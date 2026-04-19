const stateUrl = "/api/state";
const consoleEl = document.getElementById("consoleOutput");
const runtimePills = document.getElementById("runtimePills");
const pitchCards = document.getElementById("pitchCards");
const storyBoard = document.getElementById("storyBoard");
const summaryCards = document.getElementById("summaryCards");
const shipmentsTable = document.getElementById("shipmentsTable");
const anchorsList = document.getElementById("anchorsList");
const transactionsList = document.getElementById("transactionsList");
const shipmentSelect = document.getElementById("shipmentSelect");
const blueprintEl = document.getElementById("blueprint");
const builderForm = document.getElementById("builderForm");
const telemetryForm = document.getElementById("telemetryForm");
const virtualForm = document.getElementById("virtualForm");
const virtualCatalogEl = document.getElementById("virtualCatalog");
const virtualPreviewEl = document.getElementById("virtualPreview");
const virtualPreviewBtn = document.getElementById("virtualPreviewBtn");
const virtualRunBtn = document.getElementById("virtualRunBtn");
const virtualDeviceSelect = document.getElementById("virtualDeviceSelect");
const virtualScenarioSelect = document.getElementById("virtualScenarioSelect");
const mainnetStatusEl = document.getElementById("mainnetStatus");
const mainnetReadinessEl = document.getElementById("mainnetReadiness");
const mainnetSnapshotEl = document.getElementById("mainnetSnapshot");
const refreshMainnetBtn = document.getElementById("refreshMainnetBtn");
const readSnapshotBtn = document.getElementById("readSnapshotBtn");

let lastPayload = null;
let lastVirtualPreview = null;
let lastMainnetStatus = null;

const pitchData = [
  {
    title: "Problem",
    body: "Cargo damage claims are usually argued after the fact, with weak evidence and too many manual handoffs.",
  },
  {
    title: "Solution",
    body: "SafeTrack combines active IoT telemetry, AI risk scoring, and one operational dashboard for logistics teams.",
  },
  {
    title: "Proof",
    body: "Important events can be anchored to 0G storage and wired into a settlement contract on 0G mainnet.",
  },
];

const storyData = [
  {
    step: "1",
    title: "Simulate an active shipment",
    body: "Use Virtual Sensor Lab to show fake ESP32 or gateway traffic moving through a route.",
  },
  {
    step: "2",
    title: "Run AI scoring",
    body: "Turn the latest telemetry point into a risk score, explanation, and operator action.",
  },
  {
    step: "3",
    title: "Anchor evidence",
    body: "Freeze the critical proof package so the shipment state becomes auditable, not just visible.",
  },
  {
    step: "4",
    title: "Prepare settlement logic",
    body: "Generate or execute calldata to register, sync, anchor, and release through the escrow contract.",
  },
];

function logToConsole(title, payload) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  consoleEl.textContent = `${title}\n${body}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function renderPitch() {
  pitchCards.innerHTML = pitchData
    .map(
      (item) => `
        <div class="pitch-card">
          <strong>${item.title}</strong>
          <p>${item.body}</p>
        </div>
      `,
    )
    .join("");
}

function renderStoryBoard() {
  storyBoard.innerHTML = storyData
    .map(
      (item) => `
        <div class="story-card">
          <span class="story-step">${item.step}</span>
          <strong>${item.title}</strong>
          <p>${item.body}</p>
        </div>
      `,
    )
    .join("");
}

function renderRuntime(runtime) {
  runtimePills.innerHTML = [
    ["AI", `${runtime.aiMode} / ${runtime.aiModel}`],
    ["Storage", runtime.storageMode],
    ["Contract", runtime.contractMode],
    ["Chain", `${runtime.chainId}`],
  ]
    .map(([label, value]) => `<div class="pill"><strong>${label}</strong>: ${value}</div>`)
    .join("");
}

function renderSummary(state) {
  const latestAnchor = state.anchors.at(-1);
  const latestTx = state.preparedTransactions.at(-1);
  const cards = [
    ["Shipments", state.shipments.length],
    ["Telemetry rows", state.telemetry.length],
    ["Anchors", latestAnchor ? `${latestAnchor.mode}` : "none"],
    ["Last TX", latestTx ? latestTx.action : "none"],
  ];

  summaryCards.innerHTML = cards
    .map(
      ([label, value]) => `
        <div class="stat">
          <strong>${value}</strong>
          <span>${label}</span>
        </div>
      `,
    )
    .join("");
}

function renderShipmentSelect(state) {
  const current = shipmentSelect.value;
  shipmentSelect.innerHTML = state.shipments
    .map((shipment) => `<option value="${shipment.shipmentId}">${shipment.shipmentId}</option>`)
    .join("");

  if (current && state.shipments.some((item) => item.shipmentId === current)) {
    shipmentSelect.value = current;
    return;
  }

  if (state.shipments[0]) {
    shipmentSelect.value = state.shipments[0].shipmentId;
  }
}

function badge(level) {
  return `<span class="badge ${level}">${level}</span>`;
}

function renderShipments(state) {
  shipmentsTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Shipment</th>
          <th>Device</th>
          <th>Risk</th>
          <th>Alert</th>
          <th>Contract</th>
          <th>Evidence</th>
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>
        ${state.shipments
          .map(
            (shipment) => `
              <tr>
                <td><strong>${shipment.shipmentId}</strong><br /><small>${shipment.routeLabel}</small></td>
                <td>${shipment.deviceId}</td>
                <td>${shipment.riskScore}</td>
                <td>${badge(shipment.alertLevel)}</td>
                <td>${shipment.contractState}</td>
                <td>${shipment.lastEvidenceRoot ? shipment.lastEvidenceRoot.slice(0, 12) + "..." : "-"}</td>
                <td>${shipment.aiSummary}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderVirtualCatalog(virtualLab) {
  const deviceCards = virtualLab.devices
    .map(
      (device) => `
        <div class="stack-item">
          <strong>${device.label}</strong>
          <p>${device.deviceId} | ${device.firmware}</p>
          <p>${device.sensorPack.join(", ")}</p>
          <p>${device.notes}</p>
        </div>
      `,
    )
    .join("");

  const scenarioCards = virtualLab.scenarios
    .map(
      (scenario) => `
        <div class="stack-item">
          <strong>${scenario.title}</strong>
          <p>${scenario.routeLabel}</p>
          <p>${scenario.description}</p>
          <p>Risk hint: ${badge(scenario.riskHint)}</p>
        </div>
      `,
    )
    .join("");

  virtualCatalogEl.innerHTML = `${deviceCards}${scenarioCards}`;

  virtualDeviceSelect.innerHTML = virtualLab.devices
    .map((device) => `<option value="${device.deviceId}">${device.label}</option>`)
    .join("");

  virtualScenarioSelect.innerHTML = virtualLab.scenarios
    .map((scenario) => `<option value="${scenario.name}">${scenario.title}</option>`)
    .join("");
}

function renderVirtualPreview(preview) {
  if (!preview) {
    virtualPreviewEl.innerHTML =
      "<div class='stack-item'><strong>No preview yet.</strong><p>Click Preview Scenario to inspect the virtual telemetry route before it is ingested.</p></div>";
    return;
  }

  const rows = preview.samples
    .slice(0, 6)
    .map(
      (sample) => `
        <tr>
          <td>${sample.sequence}</td>
          <td>${sample.gForce}</td>
          <td>${sample.temperatureC}</td>
          <td>${sample.batteryPct}</td>
          <td>${sample.tamperDetected ? "yes" : "no"}</td>
        </tr>
      `,
    )
    .join("");

  virtualPreviewEl.innerHTML = `
    <div class="stack-item">
      <strong>${preview.scenario.title}</strong>
      <p>${preview.routeLabel}</p>
      <p>${preview.device.label} | ${preview.device.deviceId}</p>
      <p>Points: ${preview.metrics.points} | Max G: ${preview.metrics.maxGForce} | Max Temp: ${preview.metrics.maxTemperatureC}</p>
      <p>Min Battery: ${preview.metrics.minBatteryPct} | Tamper events: ${preview.metrics.tamperEvents}</p>
    </div>
    <div class="stack-item table-wrap">
      <table class="micro-table">
        <thead>
          <tr>
            <th>#</th>
            <th>G</th>
            <th>Temp</th>
            <th>Battery</th>
            <th>Tamper</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderAnchors(state) {
  anchorsList.innerHTML =
    state.anchors
      .slice()
      .reverse()
      .slice(0, 6)
      .map(
        (anchor) => `
          <div class="stack-item">
            <strong>${anchor.shipmentId}</strong>
            <p>${anchor.mode}</p>
            <p>${anchor.rootHash}</p>
            <p>${anchor.referenceUri}</p>
            <p>${anchor.note}</p>
          </div>
        `,
      )
      .join("") || "<div class='stack-item'><strong>No anchors yet.</strong><p>Run Anchor Evidence to freeze a proof package.</p></div>";
}

function renderTransactions(state) {
  transactionsList.innerHTML =
    state.preparedTransactions
      .slice()
      .reverse()
      .slice(0, 6)
      .map(
        (tx) => `
          <div class="stack-item">
            <strong>${tx.action}</strong>
            <p>${tx.mode}</p>
            <p>to: ${tx.to || "(not configured)"}</p>
            <p>data: ${tx.data.slice(0, 26)}...</p>
            <p>${tx.note}</p>
            ${tx.explorerUrl ? `<p><a class="inline-link" href="${tx.explorerUrl}" target="_blank" rel="noreferrer">Open explorer</a></p>` : ""}
          </div>
        `,
      )
      .join("") || "<div class='stack-item'><strong>No prepared tx yet.</strong><p>Prepare register, sync, anchor, or release to inspect calldata.</p></div>";
}

function renderBuilder(builder) {
  builderForm.safeGForce.value = builder.safeGForce;
  builderForm.warningGForce.value = builder.warningGForce;
  builderForm.maxTemperatureC.value = builder.maxTemperatureC;
  builderForm.maxHumidityPct.value = builder.maxHumidityPct;
  builderForm.minBatteryPct.value = builder.minBatteryPct;
  builderForm.criticalRiskScore.value = builder.criticalRiskScore;
  builderForm.releaseRiskScore.value = builder.releaseRiskScore;
  builderForm.requireEvidenceBeforeSettlement.checked = builder.requireEvidenceBeforeSettlement;
}

function renderBlueprint(blueprint) {
  blueprintEl.innerHTML = blueprint.stages
    .map(
      (stage) => `
        <div class="pipeline-item">
          <strong>${stage.name}</strong>
          <p>${stage.purpose}</p>
          <code>${stage.route}</code>
        </div>
      `,
    )
    .join("");
}

function renderMainnet(status, error) {
  if (error) {
    mainnetStatusEl.innerHTML = `<div class="status-card"><strong>Mainnet probe failed</strong><p>${error}</p></div>`;
    mainnetReadinessEl.innerHTML = "";
    mainnetSnapshotEl.innerHTML = "";
    return;
  }

  if (!status) {
    mainnetStatusEl.innerHTML = "<div class='status-card'><strong>No mainnet data yet.</strong></div>";
    mainnetReadinessEl.innerHTML = "";
    mainnetSnapshotEl.innerHTML = "";
    return;
  }

  mainnetStatusEl.innerHTML = `
    <div class="status-card">
      <strong>RPC ready on 0G Mainnet</strong>
      <p>Docs verified on ${status.docs.verifiedOn}</p>
      <div class="status-inline">
        <span class="status-chip">Chain ${status.network.chainId}</span>
        <span class="status-chip">Block ${status.network.latestBlock}</span>
        <span class="status-chip">Gas ${status.network.gasPrice0G} 0G</span>
      </div>
      <code>${status.network.rpcUrl}</code>
      <p><a class="inline-link" href="${status.docs.mainnetOverview}" target="_blank" rel="noreferrer">Mainnet docs</a></p>
    </div>
    <div class="status-card">
      <strong>Official storage contracts</strong>
      <p>Flow contract is the main proof that the app is pointing at live 0G infrastructure.</p>
      <code>${status.officialContracts.storageFlow.address}</code>
      <p><a class="inline-link" href="${status.officialContracts.storageFlow.explorerUrl}" target="_blank" rel="noreferrer">Open official Flow contract</a></p>
    </div>
    <div class="status-card">
      <strong>Configured app contract</strong>
      <p>${status.configuredContract.address || "No SAFE_TRACK_ESCROW_ADDRESS set yet."}</p>
      <div class="status-inline">
        <span class="status-chip">Mode ${status.configuredContract.mode}</span>
        <span class="status-chip">Bytecode ${status.configuredContract.bytecodeDetected ? "detected" : "missing"}</span>
      </div>
      ${status.configuredContract.explorerUrl ? `<p><a class="inline-link" href="${status.configuredContract.explorerUrl}" target="_blank" rel="noreferrer">Open configured contract</a></p>` : ""}
    </div>
  `;

  mainnetReadinessEl.innerHTML = `
    <div class="status-card">
      <strong>Deploy readiness</strong>
      <p>${status.deployReadiness.canDeploy ? "Wallet config exists. You can deploy now." : "App is not ready to deploy yet."}</p>
      <code>${status.deployReadiness.suggestedCommand}</code>
      <p>${status.deployReadiness.missing.length ? `Missing: ${status.deployReadiness.missing.join(", ")}` : "No required env missing for deployment."}</p>
    </div>
    <div class="status-card">
      <strong>Writer wallet</strong>
      <p>${status.wallet.configured ? status.wallet.address : "No writer wallet configured."}</p>
      <p>${status.wallet.balance0G ? `Balance: ${status.wallet.balance0G} 0G` : "Balance unavailable until private key is configured."}</p>
    </div>
  `;

  if (status.snapshot) {
    mainnetSnapshotEl.innerHTML = `
      <div class="status-card">
        <strong>Shipment ${status.snapshot.shipmentId}</strong>
        <p>Exists: ${status.snapshot.exists ? "yes" : "no"} | Status: ${status.snapshot.status}</p>
        <p>Risk: ${status.snapshot.riskScoreBps} bps | Threshold: ${status.snapshot.riskThresholdBps} bps</p>
        <p>Latest G milli: ${status.snapshot.latestGForceMilli}</p>
        <p>Tamper: ${status.snapshot.tamperDetected ? "true" : "false"}</p>
        <code>${status.snapshot.evidenceRoot}</code>
        <p>${status.snapshot.evidenceUri || "No evidence URI stored."}</p>
      </div>
    `;
  } else {
    mainnetSnapshotEl.innerHTML = `
      <div class="status-card">
        <strong>No on-chain shipment snapshot</strong>
        <p>${status.snapshotError || "Select a shipment and deploy/configure SAFE_TRACK_ESCROW_ADDRESS to read a real snapshot."}</p>
      </div>
    `;
  }
}

function setDefaultTelemetry(state) {
  const shipment = state.shipments[0];
  if (!shipment) return;
  telemetryForm.shipmentId.value = shipment.shipmentId;
  telemetryForm.deviceId.value = shipment.deviceId;
  telemetryForm.source.value = "sensor-active";
  telemetryForm.gForce.value = 2.1;
  telemetryForm.temperatureC.value = 24.5;
  telemetryForm.humidityPct.value = 58;
  telemetryForm.batteryPct.value = 74;
  telemetryForm.latitude.value = -6.2;
  telemetryForm.longitude.value = 106.8;
  telemetryForm.tamperDetected.checked = false;
}

function setDefaultVirtualForm(payload) {
  const shipment = payload.state.shipments[0];
  const defaultScenario = payload.virtualLab.scenarios[1] || payload.virtualLab.scenarios[0];
  const defaultDevice =
    payload.virtualLab.devices.find(
      (device) => device.deviceId === defaultScenario.defaultDeviceId,
    ) || payload.virtualLab.devices[0];

  if (!virtualForm.shipmentId.value) {
    virtualForm.shipmentId.value = shipment ? `${shipment.shipmentId}-VIRTUAL` : "SHIP-VIRTUAL-001";
  }

  if (!virtualForm.points.value) {
    virtualForm.points.value = 8;
  }

  if (!virtualScenarioSelect.value) {
    virtualScenarioSelect.value = defaultScenario.name;
  }

  if (!virtualDeviceSelect.value) {
    virtualDeviceSelect.value = defaultDevice.deviceId;
  }

  if (!virtualForm.source.value) {
    virtualForm.source.value = "sensor-active";
  }

  virtualForm.predictAfterRun.checked = true;
}

function getVirtualPayload() {
  const formData = new FormData(virtualForm);
  const payload = Object.fromEntries(formData.entries());
  payload.predictAfterRun = virtualForm.predictAfterRun.checked;
  return payload;
}

function render(payload) {
  lastPayload = payload;
  renderPitch();
  renderStoryBoard();
  renderRuntime(payload.runtime);
  renderSummary(payload.state);
  renderShipmentSelect(payload.state);
  renderShipments(payload.state);
  renderAnchors(payload.state);
  renderTransactions(payload.state);
  renderBuilder(payload.state.builder);
  renderBlueprint(payload.blueprint);
  renderVirtualCatalog(payload.virtualLab);
  renderVirtualPreview(lastVirtualPreview);
  setDefaultTelemetry(payload.state);
  setDefaultVirtualForm(payload);
}

async function loadMainnetStatus(shipmentId, shouldLog = false) {
  try {
    const suffix = shipmentId ? `?shipmentId=${encodeURIComponent(shipmentId)}` : "";
    const result = await request(`/api/mainnet/status${suffix}`);
    lastMainnetStatus = result.status;
    renderMainnet(lastMainnetStatus);
    if (shouldLog) {
      logToConsole("0G mainnet status", result);
    }
  } catch (error) {
    renderMainnet(null, error.message);
    if (shouldLog) {
      logToConsole("0G mainnet status failed", error.message);
    }
  }
}

async function loadState() {
  const payload = await request(stateUrl);
  render(payload);
  await loadMainnetStatus(shipmentSelect.value);
  logToConsole("State loaded", payload);
}

builderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(builderForm);
  const payload = Object.fromEntries(formData.entries());
  payload.requireEvidenceBeforeSettlement = builderForm.requireEvidenceBeforeSettlement.checked;
  const result = await request("/api/builder/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  render({ ...lastPayload, state: result.state });
  await loadMainnetStatus(shipmentSelect.value);
  logToConsole("Builder config updated", result);
});

telemetryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(telemetryForm);
  const payload = Object.fromEntries(formData.entries());
  payload.tamperDetected = telemetryForm.tamperDetected.checked;
  const result = await request("/api/telemetry/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await loadState();
  logToConsole("Telemetry ingested", result);
});

document.getElementById("refreshStateBtn").addEventListener("click", loadState);

document.getElementById("resetDemoBtn").addEventListener("click", async () => {
  const result = await request("/api/demo/reset", { method: "POST", body: "{}" });
  lastVirtualPreview = null;
  await loadState();
  logToConsole("Demo reset", result);
});

document.querySelectorAll(".sample-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const result = await request("/api/telemetry/sample", {
      method: "POST",
      body: JSON.stringify({
        shipmentId: shipmentSelect.value || "SHIP-001",
        profile: button.dataset.profile,
        source: "sensor-active",
      }),
    });
    await loadState();
    logToConsole("Sample telemetry created", result);
  });
});

document.querySelectorAll(".action-btn[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const shipmentId = shipmentSelect.value;
    const action = button.dataset.action;
    let url = "";

    if (action === "predict") url = "/api/ai/predict";
    if (action === "anchor") url = "/api/data/anchor";
    if (action === "validate") url = "/api/contracts/validate";

    const result = await request(url, {
      method: "POST",
      body: JSON.stringify({ shipmentId }),
    });
    await loadState();
    logToConsole(`Action ${action}`, result);
  });
});

document.querySelectorAll(".tx-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const result = await request("/api/contracts/prepare", {
      method: "POST",
      body: JSON.stringify({
        shipmentId: shipmentSelect.value,
        action: button.dataset.tx,
      }),
    });
    await loadState();
    logToConsole(`Prepared tx ${button.dataset.tx}`, result);
  });
});

virtualPreviewBtn.addEventListener("click", async () => {
  const result = await request("/api/virtual/preview", {
    method: "POST",
    body: JSON.stringify(getVirtualPayload()),
  });
  lastVirtualPreview = result.preview;
  renderVirtualPreview(lastVirtualPreview);
  logToConsole("Virtual preview ready", result);
});

virtualRunBtn.addEventListener("click", async () => {
  const result = await request("/api/virtual/run", {
    method: "POST",
    body: JSON.stringify(getVirtualPayload()),
  });
  lastVirtualPreview = result.preview;
  await loadState();
  if (result.preview && result.preview.shipmentId) {
    shipmentSelect.value = result.preview.shipmentId;
  }
  await loadMainnetStatus(shipmentSelect.value);
  renderVirtualPreview(lastVirtualPreview);
  logToConsole("Virtual route executed", result);
});

refreshMainnetBtn.addEventListener("click", async () => {
  await loadMainnetStatus(shipmentSelect.value, true);
});

readSnapshotBtn.addEventListener("click", async () => {
  await loadMainnetStatus(shipmentSelect.value, true);
});

shipmentSelect.addEventListener("change", async () => {
  await loadMainnetStatus(shipmentSelect.value);
});

loadState().catch((error) => {
  logToConsole("Initial load failed", error.message);
});
