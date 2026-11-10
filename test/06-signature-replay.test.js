const { expect } = require("chai");
const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/06-signature-replay");

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

// Same message, second valid signature: s' = n - s, flip v.
function malleate({ v, r, s }) {
  return { v: v === 27 ? 28 : 27, r, s: ethers.toBeHex(SECP256K1_N - BigInt(s), 32) };
}

async function claim(airdrop, variant, vch, sig) {
  const args = variant === "Vulnerable"
    ? [vch.to, vch.amount, sig.v, sig.r, sig.s]
    : [vch.to, vch.amount, vch.deadline, sig.v, sig.r, sig.s];
  return (await airdrop.claim(...args)).wait();
}

challengeSuite(
  mod,
  async (ctx, s) => {
    const airdrop = at(s.contract, s.airdrop, ctx.signers.player);
    const vch = await mod.bots.requestVoucher(ctx, s);
    await claim(airdrop, s.variant, vch, vch); // legitimate claim
    // 1) plain replay of the same bytes (vulnerable: blocked by usedSignatures; secure: nonce moved)
    await claim(airdrop, s.variant, vch, vch).catch(() => {});
    // 2) malleated signature -> a "new" signature id for the same message
    await claim(airdrop, s.variant, vch, malleate(vch));
  },
  async (ctx, s) => {
    const airdrop = at(s.contract, s.airdrop, ctx.signers.player);
    const vch = await mod.bots.requestVoucher(ctx, s);
    await claim(airdrop, "Secure", vch, vch);
    expect(await at("DVToken", s.token, ctx.provider).balanceOf(ctx.signers.player.address)).to.equal(ethers.parseEther("10"));
    // a voucher signed for another chain id is rejected (cross-chain replay)
    const td = await mod.voucherTypedData(ctx.provider, "Secure", s.airdrop, vch.to, vch.amount, 1n, vch.deadline);
    td.domain.chainId = 1n;
    const other = ethers.Signature.from(await ctx.signers.deployer.signTypedData(td.domain, td.types, td.value));
    let reverted = false;
    await claim(airdrop, "Secure", vch, other).catch(() => (reverted = true));
    expect(reverted).to.equal(true);
  }
);
