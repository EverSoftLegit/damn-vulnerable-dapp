const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

module.exports = {
  id: "07-approval-abuse",
  title: "Infinite Approval",
  layer: "Token",
  difficulty: "Medium",
  swc: "SWC-105 (Unprotected withdrawal) — 'arbitrary transferFrom' pattern",
  owasp: "OWASP SC Top 10 (2025): SC04 Lack of Input Validation / SC01 Access Control",
  goal: "Alice approved ZapRouter for an unlimited amount (the dApp's default) and holds 50 DVT. Take her tokens.",
  hint: "Try the 'Approve & Zap' flow in the UI and decode what you are asked to sign. Then read every function on ZapRouter that calls transferFrom: where does `from` come from?",
  async setup({ signers, variant }) {
    const token = await deploy(signers.deployer, "DVToken", ["Damn Vulnerable Token", "DVT"]);
    const router = await deploy(signers.deployer, `ZapRouter${variant}`, [await token.getAddress()]);
    await (await token.mint(signers.victim.address, ethers.parseEther("50"))).wait();
    await (await token.mint(signers.player.address, ethers.parseEther("5"))).wait();
    await (await token.connect(signers.victim).approve(await router.getAddress(), ethers.MaxUint256)).wait();
    return { token: await token.getAddress(), router: await router.getAddress(), alice: signers.victim.address, contract: `ZapRouter${variant}` };
  },
  async isSolved({ provider, signers }, s) {
    return (await at("DVToken", s.token, provider).balanceOf(signers.victim.address)) < ethers.parseEther("50");
  },
};
