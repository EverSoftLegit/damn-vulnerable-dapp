const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

module.exports = {
  id: "04-share-inflation",
  title: "Inflated Shares",
  layer: "Contract (accounting)",
  difficulty: "Hard",
  swc: "SWC-101 family (arithmetic / rounding); known as the ERC-4626 first-depositor inflation attack",
  owasp: "OWASP SC Top 10 (2025): SC03 Logic Errors (rounding / accounting)",
  goal: "ShareVault is empty. You have 20 DVT; Alice has 10 DVT and will deposit all of it when you press the bot button. End with more than 20 DVT.",
  hint: "Shares minted = assets * totalShares / totalAssets(). What is totalAssets() based on, and what happens to integer division when the denominator is huge?",
  async setup({ signers, variant }) {
    const token = await deploy(signers.deployer, "DVToken", ["Damn Vulnerable Token", "DVT"]);
    const vault = await deploy(signers.deployer, `ShareVault${variant}`, [await token.getAddress()]);
    await (await token.mint(signers.player.address, ethers.parseEther("20"))).wait();
    await (await token.mint(signers.victim.address, ethers.parseEther("10"))).wait();
    await (await token.connect(signers.victim).approve(await vault.getAddress(), ethers.MaxUint256)).wait();
    return { token: await token.getAddress(), vault: await vault.getAddress(), contract: `ShareVault${variant}` };
  },
  async isSolved({ provider, signers }, s) {
    const token = at("DVToken", s.token, provider);
    return (await token.balanceOf(signers.player.address)) > ethers.parseEther("20");
  },
  bots: {
    async aliceDeposits({ signers }, s) {
      const vault = at(s.contract, s.vault, signers.victim);
      const tx = await vault.deposit(ethers.parseEther("10"), { gasLimit: 300000 });
      const r = await tx.wait().catch((e) => e.receipt);
      return { txHash: tx.hash, status: r ? r.status : 0 };
    },
  },
};
