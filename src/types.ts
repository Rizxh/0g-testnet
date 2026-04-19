export type TelemetrySource = "sensor-active" | "api-pull";
export type AlertLevel = "normal" | "warning" | "critical";
export type AiMode = "mock" | "0g-openai-compatible";
export type StorageMode = "local" | "0g-log";
export type ContractMode = "simulate" | "read" | "execute";

export interface PipelineBuilderConfig {
  safeGForce: number;
  warningGForce: number;
  maxTemperatureC: number;
  maxHumidityPct: number;
  minBatteryPct: number;
  criticalRiskScore: number;
  releaseRiskScore: number;
  requireEvidenceBeforeSettlement: boolean;
}

export interface TelemetryRecord {
  id: string;
  shipmentId: string;
  deviceId: string;
  capturedAt: string;
  source: TelemetrySource;
  gForce: number;
  temperatureC: number;
  humidityPct: number;
  batteryPct: number;
  latitude: number;
  longitude: number;
  tamperDetected: boolean;
}

export interface ShipmentRecord {
  shipmentId: string;
  deviceId: string;
  routeLabel: string;
  consignee: string;
  createdAt: string;
  lastTelemetryAt: string;
  riskScore: number;
  alertLevel: AlertLevel;
  aiSummary: string;
  recommendedAction: string;
  contractState: "draft" | "registered" | "monitoring" | "anchored" | "claimable" | "released";
  lastEvidenceRoot?: string;
  lastAnchorTxHash?: string;
  lastValidationSummary?: string;
}

export interface PredictionResult {
  shipmentId: string;
  scoredAt: string;
  provider: AiMode | "heuristic-fallback";
  modelUsed: string;
  riskScore: number;
  alertLevel: AlertLevel;
  ruleBreaks: string[];
  recommendedAction: string;
  summary: string;
}

export interface AnchorRecord {
  id: string;
  shipmentId: string;
  createdAt: string;
  mode: StorageMode | "fallback-local";
  rootHash: string;
  txHash?: string;
  referenceUri: string;
  bytesStored: number;
  note: string;
}

export interface ContractValidationResult {
  id: string;
  shipmentId: string;
  checkedAt: string;
  mode: ContractMode;
  eligibleForRegister: boolean;
  eligibleForAnchor: boolean;
  eligibleForRelease: boolean;
  localReasons: string[];
  onChain?: {
    success: boolean;
    claimable?: boolean;
    reason?: string;
    contractAddress?: string;
  };
}

export interface PreparedTransaction {
  id: string;
  shipmentId: string;
  preparedAt: string;
  action: "registerShipment" | "syncTelemetry" | "anchorEvidence" | "releaseEscrow";
  mode: "simulated" | "executed";
  to?: string;
  data: string;
  args: unknown[];
  txHash?: string;
  explorerUrl?: string;
  note: string;
}

export interface ActivityLogEntry {
  id: string;
  createdAt: string;
  type: "ingest" | "predict" | "anchor" | "contract-check" | "tx" | "config" | "system";
  message: string;
}

export interface AppState {
  builder: PipelineBuilderConfig;
  shipments: ShipmentRecord[];
  telemetry: TelemetryRecord[];
  predictions: PredictionResult[];
  anchors: AnchorRecord[];
  validations: ContractValidationResult[];
  preparedTransactions: PreparedTransaction[];
  activity: ActivityLogEntry[];
}

export interface RuntimeSummary {
  port: number;
  aiMode: AiMode;
  aiModel: string;
  storageMode: StorageMode;
  contractMode: ContractMode;
  chainId: number;
  rpcUrl: string;
  indexerRpc: string;
  escrowAddress?: string;
}

export interface DashboardResponse {
  state: AppState;
  runtime: RuntimeSummary;
  blueprint: {
    title: string;
    stages: Array<{
      name: string;
      route: string;
      purpose: string;
    }>;
  };
}

export interface VirtualDeviceDefinition {
  deviceId: string;
  label: string;
  firmware: string;
  sensorPack: string[];
  notes: string;
}

export interface VirtualScenarioDefinition {
  name: string;
  title: string;
  routeLabel: string;
  riskHint: AlertLevel;
  description: string;
  defaultDeviceId: string;
}

export interface VirtualTelemetrySample {
  sequence: number;
  shipmentId: string;
  deviceId: string;
  capturedAt: string;
  source: TelemetrySource;
  gForce: number;
  temperatureC: number;
  humidityPct: number;
  batteryPct: number;
  latitude: number;
  longitude: number;
  tamperDetected: boolean;
}

export interface VirtualScenarioPreview {
  shipmentId: string;
  routeLabel: string;
  device: VirtualDeviceDefinition;
  scenario: VirtualScenarioDefinition;
  metrics: {
    points: number;
    maxGForce: number;
    maxTemperatureC: number;
    minBatteryPct: number;
    tamperEvents: number;
  };
  samples: VirtualTelemetrySample[];
}

export interface VirtualLabCatalog {
  devices: VirtualDeviceDefinition[];
  scenarios: VirtualScenarioDefinition[];
}
