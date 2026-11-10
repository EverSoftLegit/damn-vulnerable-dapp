// Starts the backend against an already-running local chain (see scripts/dev.js).
const { createApp } = require("./app");

const PORT = Number(process.env.PORT || 3000);
const HOST = "127.0.0.1"; // local only, on purpose

(async () => {
  const { app, deployAll } = await createApp({ rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545" });
  console.log("Deploying fresh challenge contracts...");
  await deployAll();
  app.listen(PORT, HOST, () => {
    console.log(`\n  Damn Vulnerable dApp — INTENTIONALLY VULNERABLE, LOCAL ONLY`);
    console.log(`  Open http://${HOST}:${PORT}\n`);
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
