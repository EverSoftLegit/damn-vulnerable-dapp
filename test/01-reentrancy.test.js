const { expect } = require("chai");
const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { deploy, at } = require("../lib/artifacts");
const mod = require("../lib/challenges/01-reentrancy");

challengeSuite(
  mod,
  async ({ signers }, s) => {
    const attacker = await deploy(signers.player, "ReentrancyAttacker", [s.bank]);
    await (await attacker.attack({ value: ethers.parseEther("1") })).wait();
  },
  async ({ provider, signers }, s) => {
    const bank = at(s.contract, s.bank, signers.victim);
    await (await bank.withdraw()).wait();
    expect(await provider.getBalance(s.bank)).to.equal(0n);
  }
);
