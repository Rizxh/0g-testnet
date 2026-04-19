import fs from "node:fs";
import path from "node:path";
import { createSeedState } from "../demo/seed";
import type {
  ActivityLogEntry,
  AnchorRecord,
  AppState,
  ContractValidationResult,
  PipelineBuilderConfig,
  PredictionResult,
  PreparedTransaction,
  ShipmentRecord,
  TelemetryRecord,
  TelemetrySource,
} from "../types";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function keepRecent<T>(items: T[], max = 40): T[] {
  return items.slice(-max);
}

export interface TelemetryDraft {
  shipmentId: string;
  deviceId: string;
  source: TelemetrySource;
  routeLabel?: string;
  gForce: number;
  temperatureC: number;
  humidityPct: number;
  batteryPct: number;
  latitude: number;
  longitude: number;
  tamperDetected: boolean;
  capturedAt?: string;
}

export class StateStore {
  constructor(private readonly filePath: string) {
    this.ensureStateFile();
  }

  private ensureStateFile(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.writeState(createSeedState());
    }
  }

  private readState(): AppState {
    this.ensureStateFile();
    const raw = fs.readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw) as AppState;
  }

  private writeState(state: AppState): void {
    fs.writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  }

  getState(): AppState {
    return cloneState(this.readState());
  }

  reset(): AppState {
    const seed = createSeedState();
    this.writeState(seed);
    return cloneState(seed);
  }

  upsertBuilderConfig(patch: Partial<PipelineBuilderConfig>): AppState {
    const state = this.readState();
    state.builder = { ...state.builder, ...patch };
    this.pushActivity(state, {
      type: "config",
      message: "Pipeline builder diperbarui.",
    });
    this.writeState(state);
    return cloneState(state);
  }

  ingestTelemetry(draft: TelemetryDraft): { state: AppState; telemetry: TelemetryRecord; shipment: ShipmentRecord } {
    const state = this.readState();
    const capturedAt = draft.capturedAt ?? new Date().toISOString();

    const telemetry: TelemetryRecord = {
      id: createId("tele"),
      capturedAt,
      ...draft,
    };

    let shipment = state.shipments.find((item) => item.shipmentId === draft.shipmentId);
    if (!shipment) {
      shipment = {
        shipmentId: draft.shipmentId,
        deviceId: draft.deviceId,
        routeLabel: "Autocreated route",
        consignee: "0x000000000000000000000000000000000000dEaD",
        createdAt: capturedAt,
        lastTelemetryAt: capturedAt,
        riskScore: 0,
        alertLevel: "normal",
        aiSummary: "Belum ada analisis AI.",
        recommendedAction: "Lakukan scoring terlebih dahulu.",
        contractState: "draft",
      };
      state.shipments.push(shipment);
    }

    shipment.deviceId = draft.deviceId;
    if (draft.routeLabel) {
      shipment.routeLabel = draft.routeLabel;
    }
    shipment.lastTelemetryAt = capturedAt;
    state.telemetry = keepRecent([...state.telemetry, telemetry], 120);

    this.pushActivity(state, {
      type: "ingest",
      message: `Telemetry ${telemetry.id} diterima untuk ${draft.shipmentId} dari ${draft.source}.`,
    });

    this.writeState(state);
    return { state: cloneState(state), telemetry, shipment: cloneState(shipment) };
  }

  applyPrediction(prediction: PredictionResult): AppState {
    const state = this.readState();
    const shipment = this.mustFindShipment(state, prediction.shipmentId);

    shipment.riskScore = prediction.riskScore;
    shipment.alertLevel = prediction.alertLevel;
    shipment.aiSummary = prediction.summary;
    shipment.recommendedAction = prediction.recommendedAction;
    shipment.contractState =
      prediction.riskScore >= state.builder.criticalRiskScore ? "claimable" : shipment.lastEvidenceRoot ? "anchored" : "monitoring";

    state.predictions = keepRecent([...state.predictions, prediction], 80);
    this.pushActivity(state, {
      type: "predict",
      message: `AI scoring selesai untuk ${prediction.shipmentId} dengan skor ${prediction.riskScore}.`,
    });

    this.writeState(state);
    return cloneState(state);
  }

  applyAnchor(anchor: AnchorRecord): AppState {
    const state = this.readState();
    const shipment = this.mustFindShipment(state, anchor.shipmentId);
    shipment.lastEvidenceRoot = anchor.rootHash;
    shipment.lastAnchorTxHash = anchor.txHash;
    shipment.contractState = shipment.riskScore >= state.builder.criticalRiskScore ? "claimable" : "anchored";

    state.anchors = keepRecent([...state.anchors, anchor], 80);
    this.pushActivity(state, {
      type: "anchor",
      message: `Evidence ${anchor.id} di-anchor untuk ${anchor.shipmentId} dengan root ${anchor.rootHash.slice(0, 12)}...`,
    });

    this.writeState(state);
    return cloneState(state);
  }

  applyValidation(validation: ContractValidationResult): AppState {
    const state = this.readState();
    const shipment = this.mustFindShipment(state, validation.shipmentId);
    shipment.lastValidationSummary = validation.localReasons.join(" | ") || "Semua cek lokal lulus.";

    state.validations = keepRecent([...state.validations, validation], 80);
    this.pushActivity(state, {
      type: "contract-check",
      message: `Validasi contract dijalankan untuk ${validation.shipmentId}.`,
    });

    this.writeState(state);
    return cloneState(state);
  }

  applyPreparedTransaction(tx: PreparedTransaction): AppState {
    const state = this.readState();
    const shipment = this.mustFindShipment(state, tx.shipmentId);
    if (tx.action === "releaseEscrow" && tx.mode === "executed") {
      shipment.contractState = "released";
    }

    state.preparedTransactions = keepRecent([...state.preparedTransactions, tx], 80);
    this.pushActivity(state, {
      type: "tx",
      message: `${tx.action} disiapkan untuk ${tx.shipmentId} (${tx.mode}).`,
    });

    this.writeState(state);
    return cloneState(state);
  }

  latestTelemetryForShipment(shipmentId: string): TelemetryRecord | undefined {
    return this.readState()
      .telemetry.filter((item) => item.shipmentId === shipmentId)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .at(-1);
  }

  latestAnchorForShipment(shipmentId: string): AnchorRecord | undefined {
    return this.readState()
      .anchors.filter((item) => item.shipmentId === shipmentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1);
  }

  getShipment(shipmentId: string): ShipmentRecord {
    const state = this.readState();
    return cloneState(this.mustFindShipment(state, shipmentId));
  }

  private mustFindShipment(state: AppState, shipmentId: string): ShipmentRecord {
    const shipment = state.shipments.find((item) => item.shipmentId === shipmentId);
    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} tidak ditemukan.`);
    }
    return shipment;
  }

  private pushActivity(
    state: AppState,
    entry: Pick<ActivityLogEntry, "type" | "message">,
  ): void {
    state.activity = keepRecent(
      [
        ...state.activity,
        {
          id: createId("log"),
          createdAt: new Date().toISOString(),
          type: entry.type,
          message: entry.message,
        },
      ],
      120,
    );
  }
}
