const crypto = require("crypto");
const { ethers } = require("ethers");
const { deploy, at } = require("../artifacts");

// Keys starting with "_" are server-only and never sent to the browser.
const fee = { maxFeePerGas: ethers.parseUnits("100", "gwei"), maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"), gasLimit: 200000 };

function scheduleMine(provider, ms) {
  if (ms == null) return; // tests mine manually
  setTimeout(async () => {
    await provider.send("evm_mine", []);
    await provider.send("evm_setAutomine", [true]);
  }, ms);
}

module.exports = {
  id: "09-front-running",
  title: "Mempool Sniper",
  layer: "Economic / logic",
  difficulty: "Medium",
  swc: "SWC-114 (Transaction Order Dependence)",
  owasp: "No direct OWASP SC Top 10 (2025) entry; see SWC-114",
  goal: "The Bounty pays 5 ETH for the answer to a puzzle you can't solve. A solver bot knows it. Wake the bot, then win the bounty instead of it.",
  hint: "After you wake the bot, its transaction sits unmined for 30 seconds. Look at pending transactions (eth_getBlockByNumber 'pending'). What is in its calldata, and how does the block builder order transactions?",
  async setup({ signers, variant }) {
    const answer = "dvd-" + crypto.randomBytes(8).toString("hex");
    const bounty = await deploy(signers.deployer, `Bounty${variant}`, [ethers.keccak256(ethers.toUtf8Bytes(answer))], {
      value: ethers.parseEther("5"),
    });
    return { bounty: await bounty.getAddress(), bot: signers.bot.address, contract: `Bounty${variant}`, variant, _answer: answer };
  },
  async isSolved({ provider, signers }, s) {
    return (await at(s.contract, s.bounty, provider).winner()) === signers.player.address;
  },
  bots: {
    // Bot sends its solution while automine is OFF, then a block is mined after `windowMs`.
    async wakeSolver({ provider, signers }, s, { windowMs = 30000 } = {}) {
      const bounty = at(s.contract, s.bounty, signers.bot);
      if (s.variant === "Vulnerable") {
        await provider.send("evm_setAutomine", [false]);
        const tx = await bounty.solve(s._answer, fee);
        scheduleMine(provider, windowMs);
        return { pendingTx: tx.hash, minesInMs: windowMs };
      }
      // Secure: commit (mined), then reveal (pending).
      const salt = ethers.hexlify(crypto.randomBytes(32));
      const c = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes32", "address"], [s._answer, salt, signers.bot.address]));
      await (await bounty.commit(c)).wait();
      await provider.send("evm_setAutomine", [false]);
      const tx = await bounty.reveal(s._answer, salt, fee);
      scheduleMine(provider, windowMs);
      return { pendingTx: tx.hash, minesInMs: windowMs };
    },
  },
};
