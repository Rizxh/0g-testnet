export function getPipelineBlueprint() {
  return {
    title: "SafeTrack x 0G orchestration blueprint",
    stages: [
      {
        name: "Virtual sensor gateway",
        route: "POST /api/virtual/run",
        purpose: "Mensimulasikan ESP32/gateway virtual agar demo terasa seperti device aktif sebelum hardware fisik siap.",
      },
      {
        name: "Telemetry ingest",
        route: "POST /api/telemetry/ingest",
        purpose: "Menerima data sensor aktif atau data hasil API pull dari provider telematics.",
      },
      {
        name: "AI scoring",
        route: "POST /api/ai/predict",
        purpose: "Menghasilkan risk score, summary, dan rekomendasi aksi untuk operator.",
      },
      {
        name: "Evidence anchoring",
        route: "POST /api/data/anchor",
        purpose: "Menyimpan payload bukti ke local store atau 0G log layer lalu mengembalikan root hash.",
      },
      {
        name: "Contract validation",
        route: "POST /api/contracts/validate",
        purpose: "Memeriksa apakah shipment siap untuk register, anchor, atau escrow release.",
      },
      {
        name: "Transaction prepare/execute",
        route: "POST /api/contracts/prepare",
        purpose: "Menyiapkan calldata viem atau mengeksekusi transaksi nyata jika env sudah lengkap.",
      },
    ],
  };
}
