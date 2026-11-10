const { expect } = require("chai");
const express = require("express");
const { challengeSuite } = require("./harness");
const { createSiweRouter } = require("../server/siwe");
const mod = require("../lib/challenges/10-backend-sig-auth");

// Spin up just the auth routes for the given variant on a random port.
async function startAuthServer(ctx, s) {
  const app = express().use(express.json());
  app.use("/api/c10", createSiweRouter({
    variant: ctx.variant,
    adminAddress: s.admin,
    onAdminAccess: () => ctx.serverFlags.add(mod.id),
  }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/api/c10` }));
  });
}
const post = (url, body, headers = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

challengeSuite(
  mod,
  async (ctx, s) => {
    const { server, base } = await startAuthServer(ctx, s);
    try {
      const player = ctx.signers.player;
      let message = "Sign in to Damn Vulnerable dApp";
      if (ctx.variant === "Secure") {
        // Ask for a nonce *for the admin address*, but we can only sign as the player.
        message = (await (await post(`${base}/nonce`, { address: s.admin })).json()).message;
      }
      const signature = await player.signMessage(message);
      const nonce = message.match(/Nonce: (\w+)/)?.[1];
      // The attack: a valid signature from the player, but claim to be the admin.
      const login = await (await post(`${base}/login`, { address: s.admin, message, signature, nonce })).json();
      await fetch(`${base}/admin`, { headers: { authorization: `Bearer ${login.token}` } });
    } finally {
      server.close();
    }
  },
  async (ctx, s) => {
    const { server, base } = await startAuthServer(ctx, s);
    try {
      const p = ctx.signers.player;
      const { nonce, message } = await (await post(`${base}/nonce`, { address: p.address })).json();
      const signature = await p.signMessage(message);
      const res = await post(`${base}/login`, { nonce, signature });
      expect(res.status).to.equal(200);
      // replaying the same signed login is rejected (nonce is single-use)
      expect((await post(`${base}/login`, { nonce, signature })).status).to.equal(401);
    } finally {
      server.close();
    }
  }
);
