const { expect } = require("chai");
const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/07-approval-abuse");

challengeSuite(
  mod,
  async ({ signers }, s) => {
    const router = at(s.contract, s.router, signers.player);
    const amount = ethers.parseEther("50");
    await (await router.depositFor(s.alice, signers.player.address, amount)).wait();
    await (await router.withdraw(amount)).wait();
  },
  async ({ signers }, s) => {
    const token = at("DVToken", s.token, signers.player);
    const router = at(s.contract, s.router, signers.player);
    const amount = ethers.parseEther("5");
    await (await token.approve(s.router, amount)).wait(); // exact approval, not MaxUint256
    await (await router.depositFor(signers.player.address, signers.player.address, amount)).wait();
    expect(await router.deposits(signers.player.address)).to.equal(amount);
  }
);
