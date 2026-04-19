import fs from "node:fs";
import { config } from "../src/config";
import { createSeedState } from "../src/demo/seed";

fs.mkdirSync(config.evidenceDir, { recursive: true });

for (const file of fs.readdirSync(config.evidenceDir)) {
  fs.rmSync(`${config.evidenceDir}/${file}`, { force: true });
}

fs.writeFileSync(config.dataFile, `${JSON.stringify(createSeedState(), null, 2)}\n`);

console.log("Demo state direset.");
