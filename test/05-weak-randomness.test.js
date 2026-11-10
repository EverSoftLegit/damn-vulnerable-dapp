const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { deploy } = require("../lib/artifacts");
const mod = require("../lib/challenges/05-weak-randomness");

challengeSuite(mod, async ({ signers }, s) => {
  const predictor = await deploy(signers.player, "LotteryPredictor");
  await (await predictor.attack(s.lottery, { value: ethers.parseEther("1") })).wait();
});
