const { ethers } = require("ethers");
const { deploy } = require("../artifacts");

module.exports = {
  id: "02-access-control",
  title: "Unlocked Treasury",
  layer: "Contract",
  difficulty: "Easy",
  swc: "SWC-105 (Unprotected Ether Withdrawal) / SWC-100 (Function Default Visibility)",
  owasp: "OWASP SC Top 10 (2025): SC01 Access Control",
  goal: "The TreasuryVault holds 5 ETH that only the owner can sweep. Empty it.",
  hint: "List every external function in the ABI and ask, for each one that changes state: who is allowed to call this?",
  async setup({ signers, variant }) {
    const vault = await deploy(signers.deployer, `TreasuryVault${variant}`, [], { value: ethers.parseEther("5") });
    return { vault: await vault.getAddress(), contract: `TreasuryVault${variant}` };
  },
  async isSolved({ provider }, s) {
    return (await provider.getBalance(s.vault)) === 0n;
  },
};
