import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config";
import { safeTrackEscrowAbi } from "../contracts/safetrackEscrowAbi";
import {
  chainScanTx,
  normalizePrivateKey,
  zeroGMainnetChain,
} from "./zeroGMainnet";
import type {
  AnchorRecord,
  ContractValidationResult,
  PipelineBuilderConfig,
  PreparedTransaction,
  ShipmentRecord,
  TelemetryRecord,
} from "../types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asBytes32(hexValue: string): `0x${string}` {
  if (hexValue.length === 66) return hexValue as `0x${string}`;
  const clean = hexValue.replace(/^0x/, "");
  return `0x${clean.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

function scoreToBps(score: number): number {
  return Math.max(0, Math.min(10_000, Math.round(score * 100)));
}

export class ContractAdapter {
  async validate(params: {
    shipment: ShipmentRecord;
    latestTelemetry?: TelemetryRecord;
    latestAnchor?: AnchorRecord;
    builder: PipelineBuilderConfig;
  }): Promise<ContractValidationResult> {
    const localReasons: string[] = [];
    const eligibleForRegister = isAddress(params.shipment.consignee);
    const eligibleForAnchor = Boolean(params.latestAnchor?.rootHash);

    if (!eligibleForRegister) {
      localReasons.push("Consignee address belum valid.");
    }

    if (!params.latestTelemetry) {
      localReasons.push("Belum ada telemetry terbaru untuk sinkronisasi contract.");
    }

    if (params.builder.requireEvidenceBeforeSettlement && !params.latestAnchor?.rootHash) {
      localReasons.push("Evidence root wajib ada sebelum settlement atau claim release.");
    }

    const riskyEnough =
      params.shipment.riskScore >= params.builder.criticalRiskScore ||
      Boolean(params.latestTelemetry?.tamperDetected);
    if (!riskyEnough) {
      localReasons.push("Skor risiko belum cukup tinggi untuk claim release.");
    }

    const eligibleForRelease =
      eligibleForRegister &&
      riskyEnough &&
      (!params.builder.requireEvidenceBeforeSettlement || Boolean(params.latestAnchor?.rootHash));

    const result: ContractValidationResult = {
      id: createId("check"),
      shipmentId: params.shipment.shipmentId,
      checkedAt: new Date().toISOString(),
      mode: config.contract.mode,
      eligibleForRegister,
      eligibleForAnchor,
      eligibleForRelease,
      localReasons,
    };

    if (
      config.contract.mode !== "simulate" &&
      config.contract.escrowAddress &&
      isAddress(config.contract.escrowAddress)
    ) {
      try {
        const publicClient = createPublicClient({
          chain: zeroGMainnetChain,
          transport: http(config.contract.rpcUrl),
        });

        const [claimable, reason] = (await publicClient.readContract({
          address: config.contract.escrowAddress,
          abi: safeTrackEscrowAbi,
          functionName: "validateClaimRules",
          args: [params.shipment.shipmentId],
        })) as [boolean, string];

        result.onChain = {
          success: true,
          claimable,
          reason,
          contractAddress: config.contract.escrowAddress,
        };
      } catch (error) {
        result.onChain = {
          success: false,
          reason: `Gagal membaca contract: ${(error as Error).message}`,
          contractAddress: config.contract.escrowAddress,
        };
      }
    }

    return result;
  }

  async prepareTransaction(params: {
    action: PreparedTransaction["action"];
    shipment: ShipmentRecord;
    latestTelemetry?: TelemetryRecord;
    latestAnchor?: AnchorRecord;
    builder: PipelineBuilderConfig;
  }): Promise<PreparedTransaction> {
    const address = config.contract.escrowAddress;
    const executionEnabled =
      config.contract.mode === "execute" &&
      config.contract.autoExecute &&
      address &&
      isAddress(address) &&
      config.contract.writerPrivateKey;

    let args: unknown[] = [];

    switch (params.action) {
      case "registerShipment":
        args = [
          params.shipment.shipmentId,
          isAddress(params.shipment.consignee)
            ? params.shipment.consignee
            : config.contract.defaultConsignee,
          scoreToBps(params.builder.criticalRiskScore),
        ];
        break;
      case "syncTelemetry":
        if (!params.latestTelemetry) {
          throw new Error("Telemetry terbaru diperlukan untuk syncTelemetry.");
        }
        args = [
          params.shipment.shipmentId,
          BigInt(Math.round(params.latestTelemetry.gForce * 1000)),
          scoreToBps(params.shipment.riskScore),
          params.latestTelemetry.tamperDetected,
        ];
        break;
      case "anchorEvidence":
        if (!params.latestAnchor) {
          throw new Error("Anchor terbaru diperlukan untuk anchorEvidence.");
        }
        args = [
          params.shipment.shipmentId,
          asBytes32(params.latestAnchor.rootHash),
          params.latestAnchor.referenceUri,
        ];
        break;
      case "releaseEscrow":
        args = [params.shipment.shipmentId];
        break;
      default:
        throw new Error(`Aksi ${params.action} belum didukung.`);
    }

    const data = encodeFunctionData({
      abi: safeTrackEscrowAbi,
      functionName: params.action,
      args: args as never,
    });

    if (!executionEnabled) {
      return {
        id: createId("tx"),
        shipmentId: params.shipment.shipmentId,
        preparedAt: new Date().toISOString(),
        action: params.action,
        mode: "simulated",
        to: address,
        data,
        args,
        note:
          "Transaksi baru diprepare. Isi SAFE_TRACK_ESCROW_ADDRESS, CONTRACT_WRITER_PRIVATE_KEY, dan AUTO_EXECUTE_ONCHAIN=true untuk eksekusi nyata.",
      };
    }

    try {
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

      const simulation = await publicClient.simulateContract({
        account,
        address,
        abi: safeTrackEscrowAbi,
        functionName: params.action,
        args: args as never,
      });

      const txHash = await walletClient.writeContract(simulation.request);

      return {
        id: createId("tx"),
        shipmentId: params.shipment.shipmentId,
        preparedAt: new Date().toISOString(),
        action: params.action,
        mode: "executed",
        to: address,
        data,
        args,
        txHash,
        explorerUrl: chainScanTx(txHash),
        note: "Transaksi berhasil dieksekusi ke 0G chain.",
      };
    } catch (error) {
      return {
        id: createId("tx"),
        shipmentId: params.shipment.shipmentId,
        preparedAt: new Date().toISOString(),
        action: params.action,
        mode: "simulated",
        to: address,
        data,
        args,
        note: `Eksekusi gagal dan kembali ke mode simulasi: ${(error as Error).message}`,
      };
    }
  }
}
