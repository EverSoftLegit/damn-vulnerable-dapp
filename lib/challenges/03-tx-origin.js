const { ethers } = require("ethers");
const { deploy } = require("../artifacts");

module.exports = {
  id: "03-tx-origin",
  title: "Phishing Alice",
  layer: "Contract",
  difficulty: "Medium",
  swc: "SWC-115 (Authorization through tx.origin)",
  owasp: "OWASP SC Top 10 (2025): SC01 Access Control",
  goal: "Alice's OriginWallet holds 5 ETH. Alice will happily call claimAirdrop() on any contract you send her. Empty her wallet.",
  hint: "When Alice calls your contract and your contract calls her wallet, what are msg.sender and tx.origin inside the wallet?",
  async setup({ signers, variant }) {
    const wallet = await deploy(signers.deployer, `OriginWallet${variant}`, [signers.victim.address], {
      value: ethers.parseEther("5"),
    });
    return { wallet: await wallet.getAddress(), alice: signers.victim.address, contract: `OriginWallet${variant}` };
  },
  async isSolved({ provider }, s) {
    return (await provider.getBalance(s.wallet)) === 0n;
  },
  bots: {
    // Simulates Alice clicking a phishing link: she calls claimAirdrop() on the address you give.
    async aliceClaimsAirdrop({ signers }, s, { target }) {
      if (!ethers.isAddress(target)) throw new Error("target must be an address");
      const iface = new ethers.Interface(["function claimAirdrop()"]);
      const tx = await signers.victim.sendTransaction({ to: target, data: iface.encodeFunctionData("claimAirdrop"), gasLimit: 300000 });
      const r = await tx.wait().catch((e) => e.receipt);
      return { txHash: tx.hash, status: r ? r.status : 0 };
    },
  },
};
