// One command: compile, start a local Hardhat chain, deploy every challenge, serve the app.
const { spawn, execSync } = require("child_process");

const RPC = "http://127.0.0.1:8545";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

async function waitForChain(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
      if (r.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Hardhat node did not start on " + RPC);
}

(async () => {
  execSync(`${npx} hardhat compile`, { stdio: "inherit" });
  const node = spawn(npx, ["hardhat", "node", "--hostname", "127.0.0.1", "--port", "8545"], { stdio: ["ignore", "ignore", "inherit"] });
  const stop = () => { node.kill(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await waitForChain();
  require("../server/index.js");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
