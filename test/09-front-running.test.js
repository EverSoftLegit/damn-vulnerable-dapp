const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/09-front-running");

challengeSuite(mod, async (ctx, s) => {
  const { provider, signers } = ctx;
  try {
    await mod.bots.wakeSolver(ctx, s, { windowMs: null }); // bot tx is now pending, automine off
    // Watch the mempool: read the pending block and find the bot's tx to the bounty.
    const pendingBlock = await provider.send("eth_getBlockByNumber", ["pending", true]);
    const botTx = pendingBlock.transactions.find((t) => t.to && t.to.toLowerCase() === s.bounty.toLowerCase());
    const bounty = at(s.contract, s.bounty, signers.player);
    const decoded = bounty.interface.parseTransaction({ data: botTx.input });
    // Copy the call with a higher tip. gasLimit is explicit because estimating against the
    // pending state (where the bot already won) would fail.
    await bounty[decoded.name](...decoded.args, {
      gasLimit: 200000,
      maxFeePerGas: ethers.parseUnits("200", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("50", "gwei"),
    });
    await provider.send("evm_mine", []);
  } finally {
    await provider.send("evm_setAutomine", [true]);
  }
});
