const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

module.exports = {
  id: "08-oracle-manipulation",
  title: "Pumped Collateral",
  layer: "Economic / logic",
  difficulty: "Hard",
  swc: "No direct SWC entry (economic attack)",
  owasp: "OWASP SC Top 10 (2025): SC02 Price Oracle Manipulation",
  goal: "LendingDesk holds 10,000 dUSD and lends up to 50% of your DVT collateral value. You have 100 DVT and 1,000 dUSD. Leave the desk with under 1,000 dUSD.",
  hint: "Where does LendingDesk get the DVT price? How much liquidity backs that price, and what does one large swap do to it?",
  async setup({ signers, variant }) {
    const d = signers.deployer;
    const dvt = await deploy(d, "DVToken", ["Damn Vulnerable Token", "DVT"]);
    const dusd = await deploy(d, "DVToken", ["Damn Vulnerable USD", "dUSD"]);
    const [dvtA, dusdA] = [await dvt.getAddress(), await dusd.getAddress()];
    const pool = await deploy(d, "SimplePool", [dvtA, dusdA]);
    const poolA = await pool.getAddress();
    for (const [t, to, amt] of [
      [dvt, d.address, "100"], [dusd, d.address, "10100"],
      [dvt, signers.player.address, "100"], [dusd, signers.player.address, "1000"],
    ]) await (await t.mint(to, ethers.parseEther(amt))).wait();
    await (await dvt.approve(poolA, ethers.MaxUint256)).wait();
    await (await dusd.approve(poolA, ethers.MaxUint256)).wait();
    await (await pool.addLiquidity(ethers.parseEther("100"), ethers.parseEther("100"))).wait();

    let desk;
    if (variant === "Vulnerable") {
      desk = await deploy(d, "LendingDeskVulnerable", [dvtA, dusdA, poolA]);
    } else {
      const feed = await deploy(d, "MockPriceFeed", [ethers.parseEther("1")]);
      desk = await deploy(d, "LendingDeskSecure", [dvtA, dusdA, await feed.getAddress()]);
    }
    await (await dusd.transfer(await desk.getAddress(), ethers.parseEther("10000"))).wait();
    return { dvt: dvtA, dusd: dusdA, pool: poolA, desk: await desk.getAddress(), contract: `LendingDesk${variant}` };
  },
  async isSolved({ provider }, s) {
    return (await at("DVToken", s.dusd, provider).balanceOf(s.desk)) < ethers.parseEther("1000");
  },
};
