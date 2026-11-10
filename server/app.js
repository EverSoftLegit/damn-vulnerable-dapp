// Express backend: deploys challenges to the local chain, checks solutions, gates write-ups,
// runs the "bots" (simulated users), hosts the challenge-10 auth API, and serves the frontend.
const fs = require("fs");
const path = require("path");
const express = require("express");
const { ethers } = require("ethers");
const challenges = require("../lib/challenges");
const ACCOUNTS = require("../lib/accounts");
const { loadArtifact } = require("../lib/artifacts");
const { createSiweRouter } = require("./siwe");

const ROOT = path.join(__dirname, "..");
const publicState = (s) => Object.fromEntries(Object.entries(s || {}).filter(([k]) => !k.startsWith("_")));

async function createApp({ rpcUrl = "http://127.0.0.1:8545", progressFile = path.join(ROOT, ".progress.json") } = {}) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { cacheTimeout: -1 });
  const signerAt = async (i) => provider.getSigner(i);
  const signers = {
    deployer: await signerAt(ACCOUNTS.DEPLOYER),
    player: await signerAt(ACCOUNTS.PLAYER),
    victim: await signerAt(ACCOUNTS.VICTIM),
    bot: await signerAt(ACCOUNTS.BOT),
    relayer: await signerAt(ACCOUNTS.RELAYER),
    secureMinter: await signerAt(ACCOUNTS.SECURE_MINTER),
  };
  // The app always runs the VULNERABLE variants. The tests cover the secure ones.
  const ctx = { provider, signers, variant: "Vulnerable", serverFlags: new Set() };
  const states = {};
  const solved = new Set(fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, "utf8")) : []);
  const saveProgress = () => fs.writeFileSync(progressFile, JSON.stringify([...solved], null, 2));
  const byId = Object.fromEntries(challenges.map((c) => [c.id, c]));

  async function setupChallenge(id) {
    await provider.send("evm_setAutomine", [true]); // in case a front-running window was left open
    ctx.serverFlags.delete(id);
    states[id] = await byId[id].setup(ctx);
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Challenge 10: the vulnerable login API, plus the secure one for side-by-side comparison.
  const admin = signers.deployer.address;
  app.use("/api/c10", createSiweRouter({ variant: "Vulnerable", adminAddress: admin, onAdminAccess: () => ctx.serverFlags.add("10-backend-sig-auth") }));
  app.use("/api/c10-secure", createSiweRouter({ variant: "Secure", adminAddress: admin }));

  // JSON-RPC proxy so the browser talks to the chain through the same origin.
  app.post("/rpc", async (req, res) => {
    try {
      const r = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req.body) });
      res.status(r.status).type("json").send(await r.text());
    } catch (e) {
      res.status(502).json({ error: "chain not reachable: " + e.message });
    }
  });

  app.get("/api/challenges", (req, res) => {
    res.json({
      player: signers.player.address,
      accounts: Object.fromEntries(Object.entries(signers).map(([k, s]) => [k, s.address])),
      challenges: challenges.map((c) => ({
        id: c.id, title: c.title, layer: c.layer, difficulty: c.difficulty, swc: c.swc, owasp: c.owasp,
        goal: c.goal, hint: c.hint, bots: Object.keys(c.bots || {}),
        state: publicState(states[c.id]), solved: solved.has(c.id),
      })),
    });
  });

  app.post("/api/challenges/:id/check", async (req, res) => {
    const c = byId[req.params.id];
    if (!c) return res.status(404).json({ error: "no such challenge" });
    try {
      const ok = await c.isSolved(ctx, states[c.id]);
      if (ok && !solved.has(c.id)) {
        solved.add(c.id);
        saveProgress();
      }
      res.json({ solved: ok, everSolved: solved.has(c.id) });
    } catch (e) {
      res.status(500).json({ error: e.shortMessage || e.message });
    }
  });

  // The LOCKED content: served only once the server has seen this challenge solved.
  app.get("/api/challenges/:id/writeup", (req, res) => {
    const c = byId[req.params.id];
    if (!c) return res.status(404).json({ error: "no such challenge" });
    if (!solved.has(c.id)) return res.status(403).json({ error: "Solve the challenge to unlock the write-up." });
    res.type("text/markdown").send(fs.readFileSync(path.join(ROOT, "docs", `${c.id}.md`), "utf8"));
  });

  app.post("/api/challenges/:id/reset", async (req, res) => {
    if (!byId[req.params.id]) return res.status(404).json({ error: "no such challenge" });
    try {
      await setupChallenge(req.params.id);
      res.json({ ok: true, state: publicState(states[req.params.id]) });
    } catch (e) {
      res.status(500).json({ error: e.shortMessage || e.message });
    }
  });

  app.post("/api/challenges/:id/bot/:action", async (req, res) => {
    const c = byId[req.params.id];
    const bot = c && c.bots && c.bots[req.params.action];
    if (!bot) return res.status(404).json({ error: "no such bot action" });
    try {
      const body = { ...(req.body || {}) };
      if (c.id === "09-front-running") body.windowMs = 30000; // fixed window in the UI
      res.json(await bot(ctx, states[c.id], body));
    } catch (e) {
      res.status(400).json({ error: e.shortMessage || e.reason || e.message });
    }
  });

  app.post("/api/progress/reset", (req, res) => {
    solved.clear();
    saveProgress();
    res.json({ ok: true });
  });

  // ABI + bytecode for any compiled contract, so you can deploy your own attack contracts from the browser.
  app.get("/api/artifacts/:name", (req, res) => {
    try {
      res.json(loadArtifact(req.params.name));
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  app.get("/vendor/ethers.umd.min.js", (req, res) => res.sendFile(path.join(ROOT, "node_modules", "ethers", "dist", "ethers.umd.min.js")));
  app.use(express.static(path.join(ROOT, "app")));

  async function deployAll() {
    for (const c of challenges) await setupChallenge(c.id);
  }

  return { app, deployAll, ctx, states };
}

module.exports = { createApp };
