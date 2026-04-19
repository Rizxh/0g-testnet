import { MainnetService } from "../src/services/mainnetService";

async function main() {
  const service = new MainnetService();
  const status = await service.getStatus(process.env.PROBE_SHIPMENT_ID);
  console.log(JSON.stringify(status, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
