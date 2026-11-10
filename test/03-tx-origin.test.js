const { expect } = require("chai");
const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { deploy, at } = require("../lib/artifacts");
const mod = require("../lib/challenges/03-tx-origin");

challengeSuite(
  mod,
  async (ctx, s) => {
    const bait = await deploy(ctx.signers.player, "FakeAirdrop", [s.wallet]);
    await mod.bots.aliceClaimsAirdrop(ctx, s, { target: await bait.getAddress() });
  },
  async ({ provider, signers }, s) => {
    const wallet = at(s.contract, s.wallet, signers.victim); // Alice calling directly still works
    await (await wallet.transfer(signers.victim.address, ethers.parseEther("1"))).wait();
    expect(await provider.getBalance(s.wallet)).to.equal(ethers.parseEther("4"));
  }
);
