import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { config } from "../src/config";

const sourcePath = config.contractSourcePath;
const artifactPath = config.contractArtifactPath;

const source = fs.readFileSync(sourcePath, "utf-8");

const input = {
  language: "Solidity",
  sources: {
    [path.basename(sourcePath)]: {
      content: source,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: Array<{ severity: string; formattedMessage: string }>;
  contracts?: Record<string, Record<string, { abi: unknown; evm: { bytecode: { object: string } } }>>;
};

const errors = output.errors?.filter((item) => item.severity === "error") ?? [];
if (errors.length > 0) {
  throw new Error(errors.map((item) => item.formattedMessage).join("\n\n"));
}

const contract = output.contracts?.[path.basename(sourcePath)]?.SafeTrackEscrow;
if (!contract) {
  throw new Error("SafeTrackEscrow artifact tidak ditemukan.");
}

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(
  artifactPath,
  JSON.stringify(
    {
      contractName: "SafeTrackEscrow",
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
    },
    null,
    2,
  ),
);

console.log(`Contract compiled -> ${artifactPath}`);
