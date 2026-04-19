import { createPublicClient, formatEther, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config";
import { safeTrackEscrowAbi } from "../contracts/safetrackEscrowAbi";
import {
  ZERO_G_DOCS_VERIFIED_ON,
  ZERO_G_MAINNET_DOCS_URL,
  ZERO_G_MAINNET_OFFICIAL,
  chainScanAddress,
  normalizePrivateKey,
  zeroGMainnetChain,
} from "./zeroGMainnet";

function formatMaybeEther(value: bigint | undefined): string | undefined {
  if (value === undefined) return undefined;
  return formatEther(value);
}

export class MainnetService {
  async getStatus(shipmentId?: string) {
    const publicClient = createPublicClient({
      chain: zeroGMainnetChain,
      transport: http(config.contract.rpcUrl),
    });

    const [chainId, blockNumber, gasPrice, storageFlowBytecode] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
      publicClient.getGasPrice(),
      publicClient.getBytecode({
        address: ZERO_G_MAINNET_OFFICIAL.storageFlowContract,
      }),
    ]);

    const configuredAddress =
      config.contract.escrowAddress && isAddress(config.contract.escrowAddress)
        ? config.contract.escrowAddress
        : undefined;

    const walletAddress = config.contract.writerPrivateKey
      ? privateKeyToAccount(normalizePrivateKey(config.contract.writerPrivateKey)).address
      : undefined;

    const [configuredBytecode, walletBalance] = await Promise.all([
      configuredAddress
        ? publicClient.getBytecode({
            address: configuredAddress,
          })
        : Promise.resolve(undefined),
      walletAddress
        ? publicClient.getBalance({
            address: walletAddress,
          })
        : Promise.resolve(undefined),
    ]);

    let snapshot:
      | {
          shipmentId: string;
          exists: boolean;
          status: number;
          riskThresholdBps: number;
          riskScoreBps: number;
          latestGForceMilli: string;
          tamperDetected: boolean;
          evidenceRoot: string;
          evidenceUri: string;
          updatedAt: string;
        }
      | undefined;
    let snapshotError: string | undefined;

    if (configuredAddress && shipmentId) {
      try {
        const result = (await publicClient.readContract({
          address: configuredAddress,
          abi: safeTrackEscrowAbi,
          functionName: "getShipmentSnapshot",
          args: [shipmentId],
        })) as [
          boolean,
          number,
          number,
          number,
          bigint,
          boolean,
          string,
          string,
          bigint,
        ];

        snapshot = {
          shipmentId,
          exists: result[0],
          status: result[1],
          riskThresholdBps: result[2],
          riskScoreBps: result[3],
          latestGForceMilli: result[4].toString(),
          tamperDetected: result[5],
          evidenceRoot: result[6],
          evidenceUri: result[7],
          updatedAt: result[8].toString(),
        };
      } catch (error) {
        snapshotError = (error as Error).message;
      }
    }

    const missing: string[] = [];
    if (!config.contract.writerPrivateKey) {
      missing.push("CONTRACT_WRITER_PRIVATE_KEY");
    }
    if (!config.contract.rpcUrl) {
      missing.push("ZERO_G_RPC_URL");
    }

    return {
      docs: {
        verifiedOn: ZERO_G_DOCS_VERIFIED_ON,
        mainnetOverview: ZERO_G_MAINNET_DOCS_URL,
      },
      network: {
        reachable: true,
        rpcUrl: config.contract.rpcUrl,
        chainId,
        latestBlock: blockNumber.toString(),
        gasPrice0G: formatEther(gasPrice),
        gasPriceWei: gasPrice.toString(),
      },
      officialContracts: {
        storageFlow: {
          address: ZERO_G_MAINNET_OFFICIAL.storageFlowContract,
          explorerUrl: chainScanAddress(ZERO_G_MAINNET_OFFICIAL.storageFlowContract),
          bytecodeDetected: Boolean(storageFlowBytecode),
        },
        storageMine: ZERO_G_MAINNET_OFFICIAL.storageMineContract,
        storageReward: ZERO_G_MAINNET_OFFICIAL.storageRewardContract,
      },
      configuredContract: {
        address: configuredAddress,
        explorerUrl: configuredAddress ? chainScanAddress(configuredAddress) : undefined,
        bytecodeDetected: Boolean(configuredBytecode),
        mode: config.contract.mode,
      },
      deployReadiness: {
        canDeploy: missing.length === 0,
        missing,
        suggestedCommand: "npm run deploy:mainnet",
      },
      wallet: {
        configured: Boolean(walletAddress),
        address: walletAddress,
        balance0G: formatMaybeEther(walletBalance),
      },
      snapshot,
      snapshotError,
    };
  }
}
