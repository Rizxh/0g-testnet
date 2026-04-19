# SafeTrack 0G Reference App

Contoh implementasi end-to-end untuk:

- frontend dashboard
- backend API
- AI integration / builder
- data management dan evidence anchoring
- smart contract validation dan transaction preparation
- jalur upgrade ke 0G mainnet

Project ini dibuat supaya **langsung jalan tanpa error dalam mode lokal**. Setelah itu Anda bisa mengaktifkan integrasi 0G nyata lewat `.env`.

Sekarang project ini juga punya **Virtual Sensor Lab** untuk mensimulasikan gateway/ESP32 sebelum hardware fisik siap.
Dan sekarang dashboard ini juga punya **Pitch Mode** dan **0G Mainnet Live panel** untuk presentasi hackathon.

## Stack

- Backend: `Express + TypeScript`
- Frontend: static dashboard (`public/`)
- AI: `OpenAI-compatible client`
- Web3: `viem`
- 0G Storage: `@0gfoundation/0g-ts-sdk`
- Contract example: Solidity + `solc`

## Struktur

- [src/server.ts](C:/web3-testnet/0g-test/src/server.ts) - HTTP server dan seluruh endpoint
- [src/services/stateStore.ts](C:/web3-testnet/0g-test/src/services/stateStore.ts) - data management lokal
- [src/services/aiAdapter.ts](C:/web3-testnet/0g-test/src/services/aiAdapter.ts) - AI integration
- [src/services/storageAdapter.ts](C:/web3-testnet/0g-test/src/services/storageAdapter.ts) - local/0G evidence anchoring
- [src/services/contractAdapter.ts](C:/web3-testnet/0g-test/src/services/contractAdapter.ts) - validasi contract dan calldata/eksekusi
- [src/services/mainnetService.ts](C:/web3-testnet/0g-test/src/services/mainnetService.ts) - probe live 0G mainnet dan baca snapshot on-chain
- [src/services/zeroGMainnet.ts](C:/web3-testnet/0g-test/src/services/zeroGMainnet.ts) - detail mainnet 0G yang diverifikasi
- [contracts/SafeTrackEscrow.sol](C:/web3-testnet/0g-test/contracts/SafeTrackEscrow.sol) - contoh smart contract
- [scripts/compile-contract.ts](C:/web3-testnet/0g-test/scripts/compile-contract.ts) - compile contract lokal
- [scripts/probe-mainnet.ts](C:/web3-testnet/0g-test/scripts/probe-mainnet.ts) - cek konektivitas 0G mainnet
- [scripts/deploy-mainnet.ts](C:/web3-testnet/0g-test/scripts/deploy-mainnet.ts) - deploy contract ke 0G mainnet dan tulis address ke `.env`
- [public/index.html](C:/web3-testnet/0g-test/public/index.html) - dashboard demo

## Cara pakai cepat

1. Masuk ke folder project:

```powershell
cd C:\web3-testnet\0g-test
```

2. Salin env template:

```powershell
Copy-Item .env.example .env
```

3. Jalankan app:

```powershell
npm run dev
```

4. Buka:

```text
http://localhost:4010
```

## Pitch Mode

Dashboard sekarang punya area presentasi yang lebih siap demo:

- `Hackathon Pitch Mode` di bagian atas
- `Demo Storyboard` untuk urutan presentasi
- `0G Mainnet Live` untuk membuktikan app tersambung ke RPC mainnet dan siap membaca contract live

Ini cocok untuk alur presentasi:

1. tampilkan problem-solution-proof di hero
2. jalankan `Virtual Sensor Lab`
3. scoring AI
4. anchor evidence
5. tunjukkan `0G Mainnet Live` panel
6. tunjukkan calldata atau eksekusi contract jika deploy wallet sudah siap

## Alur demo di UI

1. Klik `Sample Warning` atau `Sample Critical`
2. Klik `Run AI Predict`
3. Klik `Anchor Evidence`
4. Klik `Validate Contract`
5. Klik `Prepare Register`, `Prepare Sync Telemetry`, `Prepare Anchor Tx`, atau `Prepare Release Tx`

Setiap langkah akan memperbarui state lokal dan menampilkan output JSON di panel console.

## Alur Virtual Sensor Lab

Kalau Anda ingin demo seolah-olah ada device IoT aktif:

1. Isi `Shipment ID` virtual, misalnya `SHIP-VIRTUAL-001`
2. Pilih device virtual
3. Pilih scenario, misalnya `Rough Road` atau `Tamper Breach`
4. Klik `Preview Scenario`
5. Klik `Run Virtual Route`

Yang terjadi:

- backend membuat batch telemetry seperti datang dari sensor aktif
- route label dan device virtual ikut disisipkan ke shipment
- jika `Auto run AI after virtual route` aktif, sistem langsung scoring titik terakhir

Ini cocok untuk presentasi hackathon karena Anda bisa menunjukkan narasi device aktif tanpa ESP32 fisik.

## Endpoint utama

- `GET /api/state`
- `GET /api/mainnet/status`
- `GET /api/virtual/catalog`
- `POST /api/virtual/preview`
- `POST /api/virtual/run`
- `POST /api/telemetry/ingest`
- `POST /api/telemetry/sample`
- `POST /api/ai/predict`
- `POST /api/data/anchor`
- `POST /api/contracts/validate`
- `POST /api/contracts/prepare`
- `PUT /api/builder/config`
- `POST /api/demo/reset`

## Mode default

Secara default:

- `AI_MODE=mock`
- `STORAGE_MODE=local`
- `CONTRACT_MODE=simulate`

Artinya:

- AI tetap jalan dengan heuristic/mock output
- evidence disimpan ke folder `data/evidence`
- smart contract hanya diprepare menjadi calldata, belum dieksekusi on-chain

## Mengaktifkan 0G Compute

Isi `.env`:

```env
AI_MODE=0g-openai-compatible
AI_BASE_URL=<service-url>/v1/proxy
AI_API_KEY=app-sk-xxxxxxxx
AI_MODEL=deepseek-chat-v3-0324
```

Penjelasan:

- `AI_BASE_URL` dan `AI_API_KEY` mengikuti pola OpenAI-compatible dari docs 0G Compute.
- Backend akan memakai service itu saat endpoint `POST /api/ai/predict` dipanggil.

## Mengaktifkan 0G Storage

Isi `.env`:

```env
STORAGE_MODE=0g-log
ZERO_G_RPC_URL=https://evmrpc.0g.ai
ZERO_G_INDEXER_RPC=https://indexer-storage-turbo.0g.ai
ZERO_G_PRIVATE_KEY=0x...
```

Penjelasan:

- Endpoint `POST /api/data/anchor` akan tetap menyimpan snapshot lokal.
- Jika upload ke 0G berhasil, response akan berisi `mode: 0g-log` dan `txHash`.
- Jika gagal, service otomatis fallback ke `fallback-local`, jadi demo tidak berhenti.

## Probe live 0G mainnet

Untuk mengecek koneksi live ke mainnet 0G:

```powershell
npm run probe:mainnet
```

Script ini akan menampilkan:

- chain id mainnet
- latest block
- gas price
- status bytecode contract `0G Storage Flow`
- readiness deploy wallet Anda

Per 18 April 2026, konfigurasi yang dipakai di project ini mengikuti docs resmi 0G:

- Chain ID `16661`
- RPC `https://evmrpc.0g.ai`
- Storage turbo indexer `https://indexer-storage-turbo.0g.ai`
- Explorer `https://chainscan.0g.ai`

## Mengaktifkan smart contract real di 0G mainnet

1. Compile contract:

```powershell
npm run compile:contract
```

2. Isi `.env` minimal dengan private key deploy wallet:

```env
CONTRACT_WRITER_PRIVATE_KEY=0x...
```

3. Deploy ke mainnet:

```powershell
npm run deploy:mainnet
```

Script deploy akan:

- deploy `SafeTrackEscrow` ke 0G mainnet
- menulis `SAFE_TRACK_ESCROW_ADDRESS` ke `.env`
- set `CONTRACT_MODE=read`
- memberi link explorer untuk address dan tx hash

4. Restart app.

5. Jika Anda ingin transaksi write benar-benar dieksekusi dari dashboard, ubah `.env`:

```env
CONTRACT_MODE=execute
AUTO_EXECUTE_ONCHAIN=true
```

Sekarang endpoint `POST /api/contracts/prepare` akan:

- simulate dulu
- lalu execute transaksi jika env lengkap dan contract address valid

Catatan penting:

- Saya belum bisa menyelesaikan deploy nyata dari sesi ini karena belum ada `CONTRACT_WRITER_PRIVATE_KEY` di project saat dicek.
- Jalur deploy dan wiring sudah saya siapkan agar begitu private key dan saldo 0G tersedia, Anda tinggal menjalankan satu command.

## Script tambahan

```powershell
npm run compile:contract
npm run probe:mainnet
npm run deploy:mainnet
npm run reset:demo
npm run build
npm run check
```

## Catatan implementasi

- State operasional/hot data disimpan lokal di [data/demo-state.json](C:/web3-testnet/0g-test/data/demo-state.json) agar demo stabil.
- Evidence immutable masuk ke file lokal dan bisa di-upgrade ke 0G Log layer.
- Virtual Sensor Lab ada di [src/services/virtualSensorLab.ts](C:/web3-testnet/0g-test/src/services/virtualSensorLab.ts) dan bisa Anda ubah skenario/route/devicenya sesuka kebutuhan presentasi.
- Contoh ini belum memaksa 0G KV aktif karena endpoint KV publik/operasional bisa berubah; arsitekturnya sudah dipisahkan agar Anda bisa mengganti hot-state store nanti.
- Untuk produksi, saya sarankan hot state tetap di database cepat, lalu 0G dipakai untuk immutable evidence, proofs, dan chain settlement.
