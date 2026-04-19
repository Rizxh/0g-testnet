import type {
  TelemetrySource,
  VirtualDeviceDefinition,
  VirtualLabCatalog,
  VirtualScenarioDefinition,
  VirtualScenarioPreview,
  VirtualTelemetrySample,
} from "../types";

type ScenarioName =
  | "calm-route"
  | "rough-road"
  | "cold-chain-drift"
  | "battery-drain"
  | "tamper-breach";

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface PreviewOptions {
  shipmentId: string;
  scenarioName: ScenarioName;
  source: TelemetrySource;
  points: number;
  deviceId?: string;
}

const devices: VirtualDeviceDefinition[] = [
  {
    deviceId: "V-ESP32-01",
    label: "ESP32 Shock Box",
    firmware: "safetrack-fw 0.9.2",
    sensorPack: ["accelerometer", "temperature", "humidity", "battery", "gps"],
    notes: "Profil umum untuk box logistik dengan shock monitoring aktif.",
  },
  {
    deviceId: "V-ESP32-COLD",
    label: "ESP32 Cold Chain Node",
    firmware: "safetrack-fw cold 1.1.0",
    sensorPack: ["temperature", "humidity", "battery", "gps", "door-switch"],
    notes: "Cocok untuk simulasi reefer box dan cold chain drift.",
  },
  {
    deviceId: "V-ESP32-TAMPER",
    label: "ESP32 Tamper Sentinel",
    firmware: "safetrack-fw secure 0.8.7",
    sensorPack: ["accelerometer", "battery", "gps", "tamper-switch"],
    notes: "Simulasi device dengan alarm fisik saat box dibuka atau dijatuhkan.",
  },
];

const scenarios: Record<ScenarioName, VirtualScenarioDefinition> = {
  "calm-route": {
    name: "calm-route",
    title: "Calm Route",
    routeLabel: "Tanjung Priok -> Singapore Hub",
    riskHint: "normal",
    description: "Perjalanan stabil, spike kecil, cocok untuk menunjukkan baseline device aktif.",
    defaultDeviceId: "V-ESP32-01",
  },
  "rough-road": {
    name: "rough-road",
    title: "Rough Road",
    routeLabel: "Jakarta DC -> Surabaya Hub",
    riskHint: "warning",
    description: "Rute dengan shock berulang seperti kendaraan kena jalan rusak atau handling kasar.",
    defaultDeviceId: "V-ESP32-01",
  },
  "cold-chain-drift": {
    name: "cold-chain-drift",
    title: "Cold Chain Drift",
    routeLabel: "Bandung Cold Storage -> Semarang Port",
    riskHint: "warning",
    description: "Suhu merangkak naik walau g-force rendah. Bagus untuk demo AI non-shock anomaly.",
    defaultDeviceId: "V-ESP32-COLD",
  },
  "battery-drain": {
    name: "battery-drain",
    title: "Battery Drain",
    routeLabel: "Makassar Warehouse -> Sorong Relay",
    riskHint: "warning",
    description: "Baterai turun terus selama perjalanan panjang. Cocok untuk contoh predictive maintenance.",
    defaultDeviceId: "V-ESP32-COLD",
  },
  "tamper-breach": {
    name: "tamper-breach",
    title: "Tamper Breach",
    routeLabel: "Cikarang Secure Hub -> Port Exit",
    riskHint: "critical",
    description: "Ada tamper event, spike g-force tinggi, dan baterai mulai turun. Cocok untuk flow claim.",
    defaultDeviceId: "V-ESP32-TAMPER",
  },
};

const routes: Record<ScenarioName, RoutePoint[]> = {
  "calm-route": [
    { latitude: -6.104, longitude: 106.886 },
    { latitude: -5.2, longitude: 108.6 },
    { latitude: -3.2, longitude: 111.4 },
    { latitude: 1.265, longitude: 103.82 },
  ],
  "rough-road": [
    { latitude: -6.289, longitude: 107.148 },
    { latitude: -6.91, longitude: 109.65 },
    { latitude: -7.25, longitude: 112.75 },
  ],
  "cold-chain-drift": [
    { latitude: -6.9147, longitude: 107.6098 },
    { latitude: -6.9, longitude: 109.0 },
    { latitude: -6.9667, longitude: 110.4167 },
  ],
  "battery-drain": [
    { latitude: -5.1477, longitude: 119.4327 },
    { latitude: -3.7, longitude: 124.2 },
    { latitude: -0.8762, longitude: 131.2558 },
  ],
  "tamper-breach": [
    { latitude: -6.3167, longitude: 107.15 },
    { latitude: -6.24, longitude: 106.98 },
    { latitude: -6.12, longitude: 106.88 },
  ],
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pointOnRoute(points: RoutePoint[], progress: number): RoutePoint {
  if (points.length === 1) return points[0];

  const segments = points.length - 1;
  const scaled = Math.min(segments - 1e-9, Math.max(0, progress * segments));
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const start = points[index];
  const end = points[Math.min(index + 1, points.length - 1)];

  return {
    latitude: round(lerp(start.latitude, end.latitude, localT), 5),
    longitude: round(lerp(start.longitude, end.longitude, localT), 5),
  };
}

function chooseDevice(deviceId: string | undefined, scenario: VirtualScenarioDefinition): VirtualDeviceDefinition {
  return (
    devices.find((item) => item.deviceId === deviceId) ??
    devices.find((item) => item.deviceId === scenario.defaultDeviceId) ??
    devices[0]
  );
}

function makeTelemetry(
  scenarioName: ScenarioName,
  progress: number,
): Pick<
  VirtualTelemetrySample,
  "gForce" | "temperatureC" | "humidityPct" | "batteryPct" | "tamperDetected"
> {
  switch (scenarioName) {
    case "calm-route":
      return {
        gForce: round(1.1 + progress * 0.8 + (progress % 0.2) * 0.2),
        temperatureC: round(22.8 + progress * 1.5),
        humidityPct: round(49 + progress * 6, 0),
        batteryPct: round(93 - progress * 10, 0),
        tamperDetected: false,
      };
    case "rough-road":
      return {
        gForce: round(2.2 + progress * 3.8 + (progress > 0.55 ? 1.1 : 0.3)),
        temperatureC: round(24.1 + progress * 2.2),
        humidityPct: round(58 + progress * 10, 0),
        batteryPct: round(89 - progress * 22, 0),
        tamperDetected: false,
      };
    case "cold-chain-drift":
      return {
        gForce: round(1.2 + progress * 0.9),
        temperatureC: round(19.6 + progress * 8.5),
        humidityPct: round(61 + progress * 8, 0),
        batteryPct: round(87 - progress * 18, 0),
        tamperDetected: false,
      };
    case "battery-drain":
      return {
        gForce: round(1.5 + progress * 1.2),
        temperatureC: round(24.3 + progress * 1.8),
        humidityPct: round(55 + progress * 7, 0),
        batteryPct: round(78 - progress * 58, 0),
        tamperDetected: false,
      };
    case "tamper-breach":
      return {
        gForce: round(3.4 + progress * 5.4 + (progress > 0.75 ? 1.6 : 0)),
        temperatureC: round(25.4 + progress * 4.1),
        humidityPct: round(57 + progress * 12, 0),
        batteryPct: round(71 - progress * 46, 0),
        tamperDetected: progress >= 0.65,
      };
    default:
      return {
        gForce: 1.5,
        temperatureC: 24,
        humidityPct: 55,
        batteryPct: 80,
        tamperDetected: false,
      };
  }
}

export class VirtualSensorLab {
  getCatalog(): VirtualLabCatalog {
    return {
      devices,
      scenarios: Object.values(scenarios),
    };
  }

  preview(options: PreviewOptions): VirtualScenarioPreview {
    const scenario = scenarios[options.scenarioName];
    const route = routes[options.scenarioName];
    const device = chooseDevice(options.deviceId, scenario);
    const points = Math.max(3, Math.min(20, options.points));
    const baseTime = Date.now() - points * 90_000;

    const samples: VirtualTelemetrySample[] = Array.from({ length: points }, (_value, index) => {
      const progress = points === 1 ? 1 : index / (points - 1);
      const routePoint = pointOnRoute(route, progress);
      const metrics = makeTelemetry(options.scenarioName, progress);

      return {
        sequence: index + 1,
        shipmentId: options.shipmentId,
        deviceId: device.deviceId,
        capturedAt: new Date(baseTime + index * 90_000).toISOString(),
        source: options.source,
        latitude: routePoint.latitude,
        longitude: routePoint.longitude,
        ...metrics,
      };
    });

    return {
      shipmentId: options.shipmentId,
      routeLabel: scenario.routeLabel,
      device,
      scenario,
      metrics: {
        points,
        maxGForce: Math.max(...samples.map((item) => item.gForce)),
        maxTemperatureC: Math.max(...samples.map((item) => item.temperatureC)),
        minBatteryPct: Math.min(...samples.map((item) => item.batteryPct)),
        tamperEvents: samples.filter((item) => item.tamperDetected).length,
      },
      samples,
    };
  }
}
