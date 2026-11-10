const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

const AMOUNT = ethers.parseEther("10");

// Builds the EIP-712 payload each variant expects. Exported so tests and the UI agree.
async function voucherTypedData(provider, variant, contract, to, amount, nonce, deadline) {
  if (variant === "Vulnerable") {
    return {
      domain: { name: "VoucherAirdrop", version: "1" }, // no chainId, no verifyingContract
      types: { Voucher: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }] },
      value: { to, amount },
    };
  }
  const { chainId } = await provider.getNetwork();
  return {
    domain: { name: "VoucherAirdrop", version: "2", chainId, verifyingContract: contract },
    types: {
      Voucher: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    value: { to, amount, nonce, deadline },
  };
}

module.exports = {
  id: "06-signature-replay",
  title: "One Voucher, Many Claims",
  layer: "Signature & auth",
  difficulty: "Hard",
  swc: "SWC-121 (Missing Protection against Signature Replay) / SWC-117 (Signature Malleability)",
  owasp: "OWASP SC Top 10 (2025): SC01 Access Control; OWASP API2:2023 Broken Authentication",
  goal: "The airdrop holds 100 DVT. The issuer will sign you ONE voucher for 10 DVT. End with more than 10 DVT.",
  hint: "Inspect the EIP-712 domain and the Voucher fields: what binds a voucher to a single use? Then look at what the contract actually remembers as 'used'. Is there more than one valid (v, r, s) for the same message?",
  voucherTypedData,
  async setup({ signers, variant }) {
    const token = await deploy(signers.deployer, "DVToken", ["Damn Vulnerable Token", "DVT"]);
    const airdrop = await deploy(signers.deployer, `VoucherAirdrop${variant}`, [await token.getAddress(), signers.deployer.address]);
    await (await token.mint(await airdrop.getAddress(), ethers.parseEther("100"))).wait();
    return { token: await token.getAddress(), airdrop: await airdrop.getAddress(), issuer: signers.deployer.address, contract: `VoucherAirdrop${variant}`, variant };
  },
  async isSolved({ provider, signers }, s) {
    return (await at("DVToken", s.token, provider).balanceOf(signers.player.address)) > AMOUNT;
  },
  bots: {
    // The issuer signs one 10 DVT voucher for the player.
    async requestVoucher({ provider, signers }, s) {
      const to = signers.player.address;
      let nonce = 0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      if (s.variant !== "Vulnerable") nonce = await at(s.contract, s.airdrop, provider).nonces(to);
      const td = await voucherTypedData(provider, s.variant, s.airdrop, to, AMOUNT, nonce, deadline);
      const sig = ethers.Signature.from(await signers.deployer.signTypedData(td.domain, td.types, td.value));
      return {
        to,
        amount: AMOUNT.toString(),
        ...(s.variant === "Vulnerable" ? {} : { nonce: nonce.toString(), deadline: deadline.toString() }),
        v: sig.v,
        r: sig.r,
        s: sig.s,
        signature: sig.serialized,
        domain: { ...td.domain, chainId: td.domain.chainId?.toString() },
      };
    },
  },
};
