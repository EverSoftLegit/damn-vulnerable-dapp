const { ethers } = require("ethers");
const { deploy } = require("../artifacts");

module.exports = {
  id: "05-weak-randomness",
  title: "Predictable Lottery",
  layer: "Contract",
  difficulty: "Easy",
  swc: "SWC-120 (Weak Sources of Randomness from Chain Attributes)",
  owasp: "OWASP SC Top 10 (2025): SC09 Insecure Randomness",
  goal: "The Lottery holds a 10 ETH pot. A ticket costs 1 ETH. Win the pot on your first try.",
  hint: "Where does the 'random' number come from? Could another contract, executing in the same block, compute it too?",
  async setup({ signers, variant }) {
    const lottery = await deploy(signers.deployer, `Lottery${variant}`, [], { value: ethers.parseEther("10") });
    return { lottery: await lottery.getAddress(), contract: `Lottery${variant}` };
  },
  async isSolved({ provider }, s) {
    return (await provider.getBalance(s.lottery)) === 0n;
  },
};
