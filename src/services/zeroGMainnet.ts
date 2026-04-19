import { defineChain } from "viem";

export const ZERO_G_MAINNET_DOCS_URL =
  "https://docs.0g.ai/developer-hub/mainnet/mainnet-overview";
export const ZERO_G_DOCS_VERIFIED_ON = "2026-04-18";

export const ZERO_G_MAINNET_OFFICIAL = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  storageIndexerTurbo: "https://indexer-storage-turbo.0g.ai",
  chainExplorer: "https://chainscan.0g.ai",
  ecosystemExplorer: "https://explorer.0g.ai",
  storageScan: "https://storagescan.0g.ai",
  storageFlowContract: "0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526" as const,
  storageMineContract: "0xCd01c5Cd953971CE4C2c9bFb95610236a7F414fe" as const,
  storageRewardContract: "0x457aC76B58ffcDc118AABD6DbC63ff9072880870" as const,
};

export const zeroGMainnetChain = defineChain({
  id: ZERO_G_MAINNET_OFFICIAL.chainId,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: [ZERO_G_MAINNET_OFFICIAL.rpcUrl] },
    public: { http: [ZERO_G_MAINNET_OFFICIAL.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "ChainScan",
      url: ZERO_G_MAINNET_OFFICIAL.chainExplorer,
    },
  },
});

export function chainScanTx(txHash: string): string {
  return `${ZERO_G_MAINNET_OFFICIAL.chainExplorer}/tx/${txHash}`;
}

export function chainScanAddress(address: string): string {
  return `${ZERO_G_MAINNET_OFFICIAL.chainExplorer}/address/${address}`;
}

export function normalizePrivateKey(privateKey: string): `0x${string}` {
  return (privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`) as `0x${string}`;
}
