import "dotenv/config";
import path from "node:path";
import type { AiMode, ContractMode, RuntimeSummary, StorageMode } from "./types";

const cwd = process.cwd();

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw === "true";
}

export const config = {
  cwd,
  port: envNumber("PORT", 4010),
  dataFile: path.join(cwd, "data", "demo-state.json"),
  evidenceDir: path.join(cwd, "data", "evidence"),
  publicDir: path.join(cwd, "public"),
  envFile: path.join(cwd, ".env"),
  envExampleFile: path.join(cwd, ".env.example"),
  contractSourcePath: path.join(cwd, "contracts", "SafeTrackEscrow.sol"),
  contractArtifactPath: path.join(cwd, "artifacts", "SafeTrackEscrow.json"),
  ai: {
    mode: (process.env.AI_MODE ?? "mock") as AiMode,
    baseURL: process.env.AI_BASE_URL ?? "",
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "deepseek-chat-v3-0324",
    temperature: envNumber("AI_TEMPERATURE", 0.2),
  },
  storage: {
    mode: (process.env.STORAGE_MODE ?? "local") as StorageMode,
    rpcUrl: process.env.ZERO_G_RPC_URL ?? "https://evmrpc.0g.ai",
    indexerRpc: process.env.ZERO_G_INDEXER_RPC ?? "https://indexer-storage-turbo.0g.ai",
    privateKey: process.env.ZERO_G_PRIVATE_KEY ?? "",
  },
  contract: {
    mode: (process.env.CONTRACT_MODE ?? "simulate") as ContractMode,
    chainId: envNumber("ZERO_G_CHAIN_ID", 16661),
    rpcUrl: process.env.ZERO_G_RPC_URL ?? "https://evmrpc.0g.ai",
    escrowAddress: process.env.SAFE_TRACK_ESCROW_ADDRESS,
    writerPrivateKey:
      process.env.CONTRACT_WRITER_PRIVATE_KEY ?? process.env.ZERO_G_PRIVATE_KEY ?? "",
    autoExecute: envBoolean("AUTO_EXECUTE_ONCHAIN", false),
    defaultConsignee:
      process.env.DEFAULT_CONSIGNEE ?? "0x000000000000000000000000000000000000dEaD",
  },
};

export function getRuntimeSummary(): RuntimeSummary {
  return {
    port: config.port,
    aiMode: config.ai.mode,
    aiModel: config.ai.model,
    storageMode: config.storage.mode,
    contractMode: config.contract.mode,
    chainId: config.contract.chainId,
    rpcUrl: config.contract.rpcUrl,
    indexerRpc: config.storage.indexerRpc,
    escrowAddress: config.contract.escrowAddress,
  };
}
