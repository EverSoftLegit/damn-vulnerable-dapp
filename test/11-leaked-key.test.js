const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/11-leaked-key");

challengeSuite(
  mod,
  async ({ provider, signers }, s) => {
    // Exactly what an attacker does: grep the shipped frontend for a 32-byte hex secret.
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "config.js"), "utf8");
    const key = src.match(/0x[0-9a-fA-F]{64}/)[0];
    const relayer = new ethers.Wallet(key, provider);
    await (await at(s.contract, s.token, relayer).mint(signers.player.address, ethers.parseEther("1000"))).wait();
  },
  async (ctx, s) => {
    await mod.bots.serverClaim(ctx, s); // server-side mint works once...
    let reverted = false;
    await mod.bots.serverClaim(ctx, s).catch(() => (reverted = true)); // ...cooldown blocks the second
    expect(reverted).to.equal(true);
  }
);

describe("11-leaked-key — sanity", () => {
  it("the key in app/config.js really is the relayer account", async () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "config.js"), "utf8");
    const { makeCtx } = require("./harness");
    const ctx = await makeCtx("Vulnerable");
    expect(new ethers.Wallet(src.match(/0x[0-9a-fA-F]{64}/)[0]).address).to.equal(ctx.signers.relayer.address);
  });
});
