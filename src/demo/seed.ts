import type { AppState } from "../types";

export function createSeedState(): AppState {
  const now = new Date();
  const earlier = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const latest = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  return {
    builder: {
      safeGForce: 2.5,
      warningGForce: 5,
      maxTemperatureC: 26,
      maxHumidityPct: 68,
      minBatteryPct: 25,
      criticalRiskScore: 72,
      releaseRiskScore: 35,
      requireEvidenceBeforeSettlement: true,
    },
    shipments: [
      {
        shipmentId: "SHIP-001",
        deviceId: "ESP32-BOX-7A12",
        routeLabel: "Jakarta -> Singapore",
        consignee: "0x000000000000000000000000000000000000dEaD",
        createdAt: earlier,
        lastTelemetryAt: latest,
        riskScore: 38,
        alertLevel: "warning",
        aiSummary: "Telemetry meningkat ringan. Pengiriman masih berjalan, tetapi perlu observasi tambahan.",
        recommendedAction: "Lanjutkan monitoring dan siapkan anchor bukti jika skor kembali naik.",
        contractState: "monitoring",
      },
      {
        shipmentId: "SHIP-002",
        deviceId: "ESP32-BOX-1P87",
        routeLabel: "Bandung -> Surabaya",
        consignee: "0x000000000000000000000000000000000000dEaD",
        createdAt: earlier,
        lastTelemetryAt: latest,
        riskScore: 14,
        alertLevel: "normal",
        aiSummary: "Semua metrik masih normal dan belum ada alasan untuk claim.",
        recommendedAction: "Tidak perlu tindakan khusus.",
        contractState: "draft",
      },
    ],
    telemetry: [
      {
        id: "tele-1",
        shipmentId: "SHIP-001",
        deviceId: "ESP32-BOX-7A12",
        capturedAt: earlier,
        source: "sensor-active",
        gForce: 4.4,
        temperatureC: 25.8,
        humidityPct: 65,
        batteryPct: 57,
        latitude: -6.2,
        longitude: 106.8,
        tamperDetected: false,
      },
      {
        id: "tele-2",
        shipmentId: "SHIP-002",
        deviceId: "ESP32-BOX-1P87",
        capturedAt: latest,
        source: "api-pull",
        gForce: 1.6,
        temperatureC: 23,
        humidityPct: 54,
        batteryPct: 79,
        latitude: -7.25,
        longitude: 112.75,
        tamperDetected: false,
      },
    ],
    predictions: [],
    anchors: [],
    validations: [],
    preparedTransactions: [],
    activity: [
      {
        id: "log-1",
        createdAt: now.toISOString(),
        type: "system",
        message:
          "Seed state dibuat. Gunakan dashboard untuk ingest telemetry, jalankan AI, anchor data, dan validasi transaksi smart contract.",
      },
    ],
  };
}
