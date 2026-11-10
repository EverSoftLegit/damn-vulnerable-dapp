# 05 — Predictable Lottery (Weak randomness)

**Layer:** Contract · **Difficulty:** Easy · **SWC-120** · **OWASP SC Top 10 (2025): SC09**

## Root cause
The "random" number is `keccak256(blockhash(block.number - 1), block.timestamp) % 10`. Every input is public and **identical for every contract executing in the same block**. An attacker contract computes the same value and calls `play()` with the right guess in the same transaction.

## How a tester finds it
1. **Search for `block.timestamp`, `blockhash`, `block.prevrandao`/`difficulty`, `block.number`, `msg.sender` inside anything used as randomness.**
2. **Ask: can a contract compute this value before acting, in the same transaction?** If yes, it is predictable.
3. Ask also whether a block producer can influence it (timestamp drift, choosing whether to publish a block).

## Exploit
`contracts/05-weak-randomness/solution/LotteryPredictor.sol`, proven by `test/05-weak-randomness.test.js`:
```js
const p = await dvd.deploy("LotteryPredictor");
await (await p.attack(dvd.state("05-weak-randomness").lottery, { value: ethers.parseEther("1") })).wait();
```

## The fix
`LotterySecure` splits the game into **commit** (`play`: store guess + block number) and **settle** (later block: use `blockhash(playBlock + 1)`). At `play()` time that block does not exist yet, so no contract can compute the answer in advance. The salt `msg.sender` keeps players' answers different.

**Be honest about limits:** a block producer can still bias a future blockhash (for example, by withholding a block). Anything with real value should use a verifiable random function (VRF) such as Chainlink VRF, or a well-designed commit-reveal scheme with multiple parties. A VRF cannot run on this offline local chain, so the secure version demonstrates the commit-then-settle principle only.

## Why it works
The predictor's `play()` now only buys a ticket and wins nothing in that transaction. In the secure test the pot grows to 11 ETH and the challenge stays unsolved.
