import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import type { AnchorRecord, PredictionResult, ShipmentRecord, TelemetryRecord } from "../types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sha256Hex(input: string | Uint8Array): string {
  return `0x${crypto.createHash("sha256").update(input).digest("hex")}`;
}

export class StorageAdapter {
  constructor(private readonly evidenceDir: string) {}

  async anchorEvidence(params: {
    shipment: ShipmentRecord;
    telemetry: TelemetryRecord;
    prediction: PredictionResult;
  }): Promise<AnchorRecord> {
    await fs.mkdir(this.evidenceDir, { recursive: true });

    const payload = {
      anchoredAt: new Date().toISOString(),
      shipment: params.shipment,
      telemetry: params.telemetry,
      prediction: params.prediction,
      storageModeRequested: config.storage.mode,
    };

    const json = JSON.stringify(payload, null, 2);
    const fileName = `${params.shipment.shipmentId}-${Date.now()}.json`;
    const filePath = path.join(this.evidenceDir, fileName);
    await fs.writeFile(filePath, `${json}\n`, "utf-8");

    const localRootHash = sha256Hex(json);

    if (config.storage.mode !== "0g-log" || !config.storage.privateKey) {
      return {
        id: createId("anchor"),
        shipmentId: params.shipment.shipmentId,
        createdAt: new Date().toISOString(),
        mode: "local",
        rootHash: localRootHash,
        referenceUri: `local://evidence/${fileName}`,
        bytesStored: Buffer.byteLength(json, "utf-8"),
        note: "Disimpan lokal. Untuk upload 0G nyata, isi STORAGE_MODE=0g-log dan ZERO_G_PRIVATE_KEY.",
      };
    }

    try {
      const sdk: any = await import("@0gfoundation/0g-ts-sdk");
      const ethersModule: any = await import("ethers");

      const MemData = sdk.MemData;
      const Indexer = sdk.Indexer;
      const JsonRpcProvider = ethersModule.JsonRpcProvider ?? ethersModule.ethers?.JsonRpcProvider;
      const Wallet = ethersModule.Wallet ?? ethersModule.ethers?.Wallet;

      const memData = new MemData(new TextEncoder().encode(json));
      const [tree, treeErr] = await memData.merkleTree();
      if (treeErr !== null) {
        throw new Error(`Merkle tree error: ${treeErr}`);
      }

      const provider = new JsonRpcProvider(config.storage.rpcUrl);
      const signer = new Wallet(config.storage.privateKey, provider);
      const indexer = new Indexer(config.storage.indexerRpc);
      const [tx, uploadErr] = await indexer.upload(memData, config.storage.rpcUrl, signer);
      if (uploadErr !== null) {
        throw new Error(`Upload error: ${uploadErr}`);
      }

      const txHash = "txHash" in tx ? tx.txHash : tx.txHashes?.[0];
      const rootHash =
        ("rootHash" in tx ? tx.rootHash : tx.rootHashes?.[0]) ??
        tree?.rootHash?.() ??
        localRootHash;

      return {
        id: createId("anchor"),
        shipmentId: params.shipment.shipmentId,
        createdAt: new Date().toISOString(),
        mode: "0g-log",
        rootHash: String(rootHash),
        txHash: txHash ? String(txHash) : undefined,
        referenceUri: `0g://root/${String(rootHash)}`,
        bytesStored: Buffer.byteLength(json, "utf-8"),
        note: "Upload berhasil ke 0G Storage log layer.",
      };
    } catch (error) {
      return {
        id: createId("anchor"),
        shipmentId: params.shipment.shipmentId,
        createdAt: new Date().toISOString(),
        mode: "fallback-local",
        rootHash: localRootHash,
        referenceUri: `local://evidence/${fileName}`,
        bytesStored: Buffer.byteLength(json, "utf-8"),
        note: `0G upload gagal, fallback lokal dipakai: ${(error as Error).message}`,
      };
    }
  }
}
