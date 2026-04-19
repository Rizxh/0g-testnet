import express from "express";
import path from "node:path";
import { z } from "zod";
import { config, getRuntimeSummary } from "./config";
import { safeTrackEscrowAbi } from "./contracts/safetrackEscrowAbi";
import { AiAdapter } from "./services/aiAdapter";
import { ContractAdapter } from "./services/contractAdapter";
import { getPipelineBlueprint } from "./services/pipelineBuilder";
import { MainnetService } from "./services/mainnetService";
import { StorageAdapter } from "./services/storageAdapter";
import { StateStore } from "./services/stateStore";
import { VirtualSensorLab } from "./services/virtualSensorLab";
import type { PredictionResult, TelemetrySource } from "./types";

const app = express();
const store = new StateStore(config.dataFile);
const aiAdapter = new AiAdapter();
const storageAdapter = new StorageAdapter(config.evidenceDir);
const contractAdapter = new ContractAdapter();
const virtualSensorLab = new VirtualSensorLab();
const mainnetService = new MainnetService();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(config.publicDir));

const builderConfigSchema = z.object({
  safeGForce: z.coerce.number().min(0),
  warningGForce: z.coerce.number().min(0),
  maxTemperatureC: z.coerce.number(),
  maxHumidityPct: z.coerce.number().min(0).max(100),
  minBatteryPct: z.coerce.number().min(0).max(100),
  criticalRiskScore: z.coerce.number().min(0).max(100),
  releaseRiskScore: z.coerce.number().min(0).max(100),
  requireEvidenceBeforeSettlement: z.coerce.boolean(),
});

const shipmentOnlySchema = z.object({
  shipmentId: z.string().min(1),
});

const telemetrySchema = z.object({
  shipmentId: z.string().min(1),
  deviceId: z.string().min(1),
  source: z.enum(["sensor-active", "api-pull"]),
  gForce: z.coerce.number(),
  temperatureC: z.coerce.number(),
  humidityPct: z.coerce.number(),
  batteryPct: z.coerce.number(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  tamperDetected: z.coerce.boolean(),
});

const sampleSchema = z.object({
  shipmentId: z.string().min(1).default("SHIP-001"),
  profile: z.enum(["normal", "warning", "critical"]).default("warning"),
  source: z.enum(["sensor-active", "api-pull"]).default("sensor-active"),
});

const prepareSchema = z.object({
  shipmentId: z.string().min(1),
  action: z.enum(["registerShipment", "syncTelemetry", "anchorEvidence", "releaseEscrow"]),
});

const virtualScenarioSchema = z.object({
  shipmentId: z.string().min(1).default("SHIP-VIRTUAL-001"),
  deviceId: z.string().optional(),
  scenarioName: z.enum([
    "calm-route",
    "rough-road",
    "cold-chain-drift",
    "battery-drain",
    "tamper-breach",
  ]),
  source: z.enum(["sensor-active", "api-pull"]).default("sensor-active"),
  points: z.coerce.number().min(3).max(20).default(8),
  predictAfterRun: z.coerce.boolean().default(true),
});

function dashboardPayload() {
  return {
    state: store.getState(),
    runtime: getRuntimeSummary(),
    blueprint: getPipelineBlueprint(),
    contract: {
      abiFunctions: safeTrackEscrowAbi
        .filter((item) => item.type === "function")
        .map((item) => item.name),
      sourceFile: "/contracts/SafeTrackEscrow.sol",
    },
    virtualLab: virtualSensorLab.getCatalog(),
  };
}

function latestPredictionForShipment(shipmentId: string): PredictionResult | undefined {
  return store
    .getState()
    .predictions.filter((item) => item.shipmentId === shipmentId)
    .sort((a, b) => a.scoredAt.localeCompare(b.scoredAt))
    .at(-1);
}

function sampleTelemetry(profile: "normal" | "warning" | "critical", source: TelemetrySource, shipmentId: string) {
  const base = {
    shipmentId,
    deviceId: shipmentId === "SHIP-002" ? "ESP32-BOX-1P87" : "ESP32-BOX-7A12",
    source,
    latitude: -6.2 + Math.random() * 0.1,
    longitude: 106.8 + Math.random() * 0.1,
    tamperDetected: false,
  };

  if (profile === "normal") {
    return {
      ...base,
      gForce: 1.4,
      temperatureC: 23.4,
      humidityPct: 51,
      batteryPct: 76,
    };
  }

  if (profile === "critical") {
    return {
      ...base,
      gForce: 8.9,
      temperatureC: 31.2,
      humidityPct: 77,
      batteryPct: 18,
      tamperDetected: true,
    };
  }

  return {
    ...base,
    gForce: 4.9,
    temperatureC: 27.8,
    humidityPct: 69,
    batteryPct: 42,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "safetrack-0g-reference",
    time: new Date().toISOString(),
    runtime: getRuntimeSummary(),
  });
});

app.get("/api/state", (_req, res) => {
  res.json(dashboardPayload());
});

app.get("/api/mainnet/status", async (req, res) => {
  const shipmentId =
    typeof req.query.shipmentId === "string" && req.query.shipmentId.trim()
      ? req.query.shipmentId.trim()
      : undefined;

  const status = await mainnetService.getStatus(shipmentId);
  res.json({
    ok: true,
    status,
  });
});

app.get("/api/virtual/catalog", (_req, res) => {
  res.json({
    ok: true,
    catalog: virtualSensorLab.getCatalog(),
  });
});

app.post("/api/virtual/preview", (req, res) => {
  const payload = virtualScenarioSchema.parse(req.body ?? {});
  const preview = virtualSensorLab.preview(payload);
  res.json({
    ok: true,
    message: `Preview virtual scenario ${payload.scenarioName} siap.`,
    preview,
  });
});

app.post("/api/virtual/run", async (req, res) => {
  const payload = virtualScenarioSchema.parse(req.body ?? {});
  const preview = virtualSensorLab.preview(payload);

  let currentState = store.getState();
  for (const sample of preview.samples) {
    const result = store.ingestTelemetry({
      ...sample,
      routeLabel: preview.routeLabel,
    });
    currentState = result.state;
  }

  let prediction: PredictionResult | undefined;
  if (payload.predictAfterRun) {
    const latestTelemetry = store.latestTelemetryForShipment(payload.shipmentId);
    if (latestTelemetry) {
      prediction = await aiAdapter.predict(latestTelemetry, currentState.builder);
      currentState = store.applyPrediction(prediction);
    }
  }

  res.json({
    ok: true,
    message: `Virtual scenario ${payload.scenarioName} dijalankan dengan ${preview.samples.length} titik telemetry.`,
    preview,
    prediction,
    state: currentState,
  });
});

app.put("/api/builder/config", (req, res) => {
  const payload = builderConfigSchema.parse(req.body);
  const state = store.upsertBuilderConfig(payload);
  res.json({
    ok: true,
    message: "Builder config diperbarui.",
    state,
  });
});

app.post("/api/demo/reset", (_req, res) => {
  const state = store.reset();
  res.json({
    ok: true,
    message: "Demo state direset.",
    state,
  });
});

app.post("/api/telemetry/sample", (req, res) => {
  const payload = sampleSchema.parse(req.body ?? {});
  const draft = sampleTelemetry(payload.profile, payload.source, payload.shipmentId);
  const result = store.ingestTelemetry(draft);
  res.json({
    ok: true,
    message: `Sample telemetry (${payload.profile}) berhasil diingest.`,
    telemetry: result.telemetry,
    state: result.state,
  });
});

app.post("/api/telemetry/ingest", (req, res) => {
  const payload = telemetrySchema.parse(req.body);
  const result = store.ingestTelemetry(payload);
  res.json({
    ok: true,
    message: "Telemetry berhasil disimpan.",
    telemetry: result.telemetry,
    state: result.state,
  });
});

app.post("/api/ai/predict", async (req, res) => {
  const payload = shipmentOnlySchema.parse(req.body);
  const state = store.getState();
  const telemetry = state.telemetry
    .filter((item) => item.shipmentId === payload.shipmentId)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .at(-1);

  if (!telemetry) {
    res.status(404).json({ ok: false, error: "Telemetry belum tersedia untuk shipment ini." });
    return;
  }

  const prediction = await aiAdapter.predict(telemetry, state.builder);
  const nextState = store.applyPrediction(prediction);
  res.json({
    ok: true,
    message: "AI prediction selesai.",
    prediction,
    state: nextState,
  });
});

app.post("/api/data/anchor", async (req, res) => {
  const payload = shipmentOnlySchema.parse(req.body);
  const state = store.getState();
  const shipment = state.shipments.find((item) => item.shipmentId === payload.shipmentId);
  if (!shipment) {
    res.status(404).json({ ok: false, error: "Shipment tidak ditemukan." });
    return;
  }

  const telemetry = state.telemetry
    .filter((item) => item.shipmentId === payload.shipmentId)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .at(-1);
  if (!telemetry) {
    res.status(404).json({ ok: false, error: "Telemetry belum tersedia." });
    return;
  }

  const prediction =
    latestPredictionForShipment(payload.shipmentId) ??
    (await aiAdapter.predict(telemetry, state.builder));

  if (!latestPredictionForShipment(payload.shipmentId)) {
    store.applyPrediction(prediction);
  }

  const anchor = await storageAdapter.anchorEvidence({ shipment, telemetry, prediction });
  const nextState = store.applyAnchor(anchor);

  res.json({
    ok: true,
    message: "Evidence berhasil di-anchor.",
    anchor,
    state: nextState,
  });
});

app.post("/api/contracts/validate", async (req, res) => {
  const payload = shipmentOnlySchema.parse(req.body);
  const state = store.getState();
  const shipment = state.shipments.find((item) => item.shipmentId === payload.shipmentId);
  if (!shipment) {
    res.status(404).json({ ok: false, error: "Shipment tidak ditemukan." });
    return;
  }

  const validation = await contractAdapter.validate({
    shipment,
    latestTelemetry: store.latestTelemetryForShipment(payload.shipmentId),
    latestAnchor: store.latestAnchorForShipment(payload.shipmentId),
    builder: state.builder,
  });

  const nextState = store.applyValidation(validation);
  res.json({
    ok: true,
    message: "Validasi contract selesai.",
    validation,
    state: nextState,
  });
});

app.post("/api/contracts/prepare", async (req, res) => {
  const payload = prepareSchema.parse(req.body);
  const state = store.getState();
  const shipment = state.shipments.find((item) => item.shipmentId === payload.shipmentId);
  if (!shipment) {
    res.status(404).json({ ok: false, error: "Shipment tidak ditemukan." });
    return;
  }

  const tx = await contractAdapter.prepareTransaction({
    action: payload.action,
    shipment,
    latestTelemetry: store.latestTelemetryForShipment(payload.shipmentId),
    latestAnchor: store.latestAnchorForShipment(payload.shipmentId),
    builder: state.builder,
  });

  const nextState = store.applyPreparedTransaction(tx);
  res.json({
    ok: true,
    message: `${payload.action} berhasil diprepare.`,
    transaction: tx,
    state: nextState,
  });
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(config.publicDir, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      ok: false,
      error: "Payload tidak valid.",
      issues: error.issues,
    });
    return;
  }

  res.status(500).json({
    ok: false,
    error: (error as Error).message,
  });
});

app.listen(config.port, () => {
  console.log(`SafeTrack 0G reference app listening on http://localhost:${config.port}`);
});
