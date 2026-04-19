import type { AlertLevel, PipelineBuilderConfig, PredictionResult, TelemetryRecord } from "../types";

interface HeuristicPrediction {
  riskScore: number;
  alertLevel: AlertLevel;
  ruleBreaks: string[];
  recommendedAction: string;
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildHeuristicPrediction(
  telemetry: TelemetryRecord,
  builder: PipelineBuilderConfig,
): HeuristicPrediction {
  let score = 8;
  const ruleBreaks: string[] = [];

  if (telemetry.gForce > builder.safeGForce) {
    score += (telemetry.gForce - builder.safeGForce) * 10;
    ruleBreaks.push(`G-force melewati batas aman (${telemetry.gForce.toFixed(2)}g).`);
  }

  if (telemetry.gForce > builder.warningGForce) {
    score += 18;
    ruleBreaks.push(`G-force melewati warning threshold (${builder.warningGForce}g).`);
  }

  if (telemetry.temperatureC > builder.maxTemperatureC) {
    score += (telemetry.temperatureC - builder.maxTemperatureC) * 6;
    ruleBreaks.push(`Temperatur tinggi (${telemetry.temperatureC.toFixed(1)} C).`);
  }

  if (telemetry.humidityPct > builder.maxHumidityPct) {
    score += (telemetry.humidityPct - builder.maxHumidityPct) * 1.5;
    ruleBreaks.push(`Humidity tinggi (${telemetry.humidityPct.toFixed(0)}%).`);
  }

  if (telemetry.batteryPct < builder.minBatteryPct) {
    score += (builder.minBatteryPct - telemetry.batteryPct) * 1.8;
    ruleBreaks.push(`Baterai rendah (${telemetry.batteryPct.toFixed(0)}%).`);
  }

  if (telemetry.tamperDetected) {
    score += 30;
    ruleBreaks.push("Tamper flag aktif.");
  }

  score = clamp(Math.round(score), 0, 100);

  let alertLevel: AlertLevel = "normal";
  if (score >= builder.criticalRiskScore || telemetry.tamperDetected || telemetry.gForce > builder.warningGForce + 2) {
    alertLevel = "critical";
  } else if (score >= 35 || telemetry.gForce > builder.safeGForce) {
    alertLevel = "warning";
  }

  let recommendedAction = "Keep monitoring.";
  if (alertLevel === "warning") {
    recommendedAction = "Anchor evidence, notify operator, and review handling at the next hub.";
  }
  if (alertLevel === "critical") {
    recommendedAction = "Anchor evidence immediately, freeze settlement, and prepare claim validation.";
  }

  const summary =
    ruleBreaks.length === 0
      ? "Telemetry terlihat stabil dan belum ada indikasi claim."
      : `Sinyal utama: ${ruleBreaks.join(" ")} Risiko saat ini ${score}/100.`;

  return { riskScore: score, alertLevel, ruleBreaks, recommendedAction, summary };
}

export function toPredictionResult(
  shipmentId: string,
  telemetry: TelemetryRecord,
  builder: PipelineBuilderConfig,
): PredictionResult {
  const heuristic = buildHeuristicPrediction(telemetry, builder);
  return {
    shipmentId,
    scoredAt: new Date().toISOString(),
    provider: "heuristic-fallback",
    modelUsed: "local-risk-engine",
    ...heuristic,
  };
}
