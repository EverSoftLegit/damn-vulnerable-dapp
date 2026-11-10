const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

module.exports = {
  id: "11-leaked-key",
  title: "Keys in the Bundle",
  layer: "Web / integration (frontend)",
  difficulty: "Easy",
  swc: "n/a (off-chain secret management)",
  owasp: "OWASP A07:2021 (CWE-798 Hard-coded Credentials); A04:2021 Insecure Design",
  goal: "The dApp gives you 10 RWD per day through 'gasless' reward claims. Get more than 100 RWD.",
  hint: "A gasless claim still needs someone to sign and pay for a transaction. Who signs it, and where does that signing happen? View the page source.",
  async setup({ signers, variant }) {
    const minter = variant === "Vulnerable" ? signers.relayer : signers.secureMinter;
    const token = await deploy(signers.deployer, `RewardToken${variant}`, [minter.address]);
    return { token: await token.getAddress(), minter: minter.address, contract: `RewardToken${variant}` };
  },
  async isSolved({ provider, signers }, s) {
    return (await at(s.contract, s.token, provider).balanceOf(signers.player.address)) > ethers.parseEther("100");
  },
  bots: {
    // The SECURE design: the server holds the minter key and mints for you.
    async serverClaim({ signers }, s) {
      const tx = await at(s.contract, s.token, signers.secureMinter).mint(signers.player.address, ethers.parseEther("10"));
      await tx.wait();
      return { txHash: tx.hash };
    },
  },
};
