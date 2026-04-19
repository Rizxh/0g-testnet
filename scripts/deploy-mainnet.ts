import "dotenv/config";
import fs from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../src/config";
import {
  ZERO_G_MAINNET_OFFICIAL,
  chainScanAddress,
  chainScanTx,
  normalizePrivateKey,
  zeroGMainnetChain,
} from "../src/services/zeroGMainnet";

interface ArtifactShape {
  abi: unknown;
  bytecode: string;
}

function upsertEnvValue(source: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const matcher = new RegExp(`^${key}=.*$`, "m");
  if (matcher.test(source)) {
    return source.replace(matcher, line);
  }
  const trimmed = source.trimEnd();
  return `${trimmed}\n${line}\n`;
}

async function main() {
  if (!config.contract.writerPrivateKey) {
    throw new Error(
      "CONTRACT_WRITER_PRIVATE_KEY belum diisi. Script deploy mainnet sengaja berhenti agar aman.",
    );
  }

  const artifact = JSON.parse(
    fs.readFileSync(config.contractArtifactPath, "utf-8"),
  ) as ArtifactShape;
  const bytecode = artifact.bytecode.startsWith("0x")
    ? (artifact.bytecode as `0x${string}`)
    : (`0x${artifact.bytecode}` as `0x${string}`);

  const account = privateKeyToAccount(
    normalizePrivateKey(config.contract.writerPrivateKey),
  );

  const publicClient = createPublicClient({
    chain: zeroGMainnetChain,
    transport: http(config.contract.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: zeroGMainnetChain,
    transport: http(config.contract.rpcUrl),
    account,
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== ZERO_G_MAINNET_OFFICIAL.chainId) {
    throw new Error(
      `RPC mengarah ke chain ${chainId}, padahal docs 0G mainnet per 2026-04-18 menyebut chain id ${ZERO_G_MAINNET_OFFICIAL.chainId}.`,
    );
  }

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance <= 0n) {
    throw new Error(
      `Wallet ${account.address} tidak punya saldo 0G yang cukup untuk deploy di mainnet.`,
    );
  }

  const deployHash = await walletClient.deployContract({
    abi: artifact.abi as any,
    bytecode,
    account,
    args: [],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  });

  const contractAddress = receipt.contractAddress;
  if (!contractAddress) {
    throw new Error("Deploy selesai tetapi contractAddress tidak ditemukan di receipt.");
  }

  const envBase = fs.existsSync(config.envFile)
    ? fs.readFileSync(config.envFile, "utf-8")
    : fs.readFileSync(config.envExampleFile, "utf-8");

  let nextEnv = envBase;
  nextEnv = upsertEnvValue(nextEnv, "ZERO_G_CHAIN_ID", String(ZERO_G_MAINNET_OFFICIAL.chainId));
  nextEnv = upsertEnvValue(nextEnv, "ZERO_G_RPC_URL", ZERO_G_MAINNET_OFFICIAL.rpcUrl);
  nextEnv = upsertEnvValue(
    nextEnv,
    "ZERO_G_INDEXER_RPC",
    ZERO_G_MAINNET_OFFICIAL.storageIndexerTurbo,
  );
  nextEnv = upsertEnvValue(nextEnv, "SAFE_TRACK_ESCROW_ADDRESS", contractAddress);
  nextEnv = upsertEnvValue(nextEnv, "CONTRACT_MODE", "read");
  nextEnv = upsertEnvValue(nextEnv, "AUTO_EXECUTE_ONCHAIN", "false");
  fs.writeFileSync(config.envFile, nextEnv, "utf-8");

  console.log(
    JSON.stringify(
      {
        deployed: true,
        address: contractAddress,
        deployTxHash: deployHash,
        explorerAddress: chainScanAddress(contractAddress),
        explorerTx: chainScanTx(deployHash),
        envFile: config.envFile,
        nextStep:
          "Restart app. Jika ingin mengeksekusi transaksi write dari dashboard, ubah CONTRACT_MODE=execute dan AUTO_EXECUTE_ONCHAIN=true.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
