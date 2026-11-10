// Shared test harness. For every challenge:
//   1. deploy the Vulnerable version, check it starts unsolved, run the exploit, expect SOLVED;
//   2. deploy the Secure version, check it starts unsolved, run the same exploit, expect NOT solved.
const hre = require("hardhat");
const { expect } = require("chai");
const ACCOUNTS = require("../lib/accounts");

async function makeCtx(variant) {
  const s = await hre.ethers.getSigners();
  return {
    provider: hre.ethers.provider,
    variant,
    serverFlags: new Set(),
    signers: {
      deployer: s[ACCOUNTS.DEPLOYER],
      player: s[ACCOUNTS.PLAYER],
      victim: s[ACCOUNTS.VICTIM],
      bot: s[ACCOUNTS.BOT],
      relayer: s[ACCOUNTS.RELAYER],
      secureMinter: s[ACCOUNTS.SECURE_MINTER],
    },
  };
}

/**
 * @param mod      challenge module from lib/challenges
 * @param exploit  async (ctx, state, mod) => void   — the attack, written once for both variants
 * @param extra    optional async (ctx, state, mod) => void run against the Secure version to show
 *                 the legitimate feature still works after the fix
 */
function challengeSuite(mod, exploit, extra) {
  describe(`${mod.id} — ${mod.title}`, function () {
    for (const [variant, expected] of [["Vulnerable", true], ["Secure", false]]) {
      it(`exploit ${expected ? "SUCCEEDS against" : "FAILS against"} ${variant}`, async function () {
        const ctx = await makeCtx(variant);
        const state = await mod.setup(ctx);
        expect(await mod.isSolved(ctx, state), "solved before exploit").to.equal(false);
        let error;
        try {
          await exploit(ctx, state, mod);
        } catch (e) {
          error = e; // a revert is a perfectly good way for the secure version to stop the attack
          if (process.env.SHOW_BLOCKED) console.log(`      [${variant}] blocked: ${(e.shortMessage || e.reason || e.message).slice(0, 120)}`);
        }
        if (expected && error) throw error;
        expect(await mod.isSolved(ctx, state)).to.equal(expected);
      });
    }
    if (extra) {
      it("secure version still supports the legitimate use case", async function () {
        const ctx = await makeCtx("Secure");
        await extra(ctx, await mod.setup(ctx), mod);
      });
    }
  });
}

module.exports = { makeCtx, challengeSuite };
