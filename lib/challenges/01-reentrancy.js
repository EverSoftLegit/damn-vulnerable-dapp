const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

module.exports = {
  id: "01-reentrancy",
  title: "Leaky Bank",
  layer: "Contract",
  difficulty: "Easy",
  swc: "SWC-107 (Reentrancy)",
  owasp: "OWASP SC Top 10 (2025): SC05 Reentrancy",
  goal: "Alice has 10 ETH in EtherBank. Make the bank insolvent: leave it holding less ETH than it owes Alice.",
  hint: "Read withdraw() line by line. What runs first: sending the ETH, or zeroing your balance? Who gets control when ETH is sent to a contract?",
  async setup({ signers, variant }) {
    const bank = await deploy(signers.deployer, `EtherBank${variant}`);
    await (await bank.connect(signers.victim).deposit({ value: ethers.parseEther("10") })).wait();
    return { bank: await bank.getAddress(), contract: `EtherBank${variant}` };
  },
  async isSolved({ provider, signers }, s) {
    const bank = at(s.contract, s.bank, provider);
    const owed = await bank.balances(signers.victim.address);
    return (await provider.getBalance(s.bank)) < owed;
  },
};
