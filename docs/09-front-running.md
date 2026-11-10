# 09 — Mempool Sniper (Front-running / transaction-order dependence)

**Layer:** Economic / logic · **Difficulty:** Medium · **SWC-114** · **OWASP SC Top 10 (2025): no direct entry**

## Root cause
`BountyVulnerable.solve(string answer)` sends the secret answer **in plaintext calldata**. Before a transaction is mined it sits in a public mempool where anyone can read it. Block builders order transactions largely by fee, so an observer can copy the call, attach a higher priority fee, and land first.

## How a tester finds it
1. **Ask what a transaction reveals before it is mined.** Answers, prices, signatures and a user's slippage settings are all visible to everyone.
2. **Ask whether order matters.** If the first caller wins, or the outcome depends on state another transaction can change first, the function is order-dependent.
3. **Watch the mempool:** `eth_getBlockByNumber("pending", true)`, `txpool_content`, or a node's pending-tx subscription. Decode the calldata with the ABI.
4. **Replay it with a higher tip** and an explicit gas limit. Gas estimation runs against the pending state, where the victim already won, so estimation fails.

## Exploit
`test/09-front-running.test.js`. **UI walkthrough:**
1. Click **Wake the solver bot**. Its tx appears in the **Mempool** panel, and a block is mined 30s later.
2. Copy its `to` and `data` into the **Transaction composer**, set the tip to e.g. `50` gwei (the bot pays 1), and **Send**.
3. When the block is mined, your transaction is ordered first and you become `winner()`. Click **Check solution**.

## The fix: commit-reveal
```solidity
function commit(bytes32 c) external {             // c = keccak256(abi.encode(answer, salt, msg.sender))
    commitments[msg.sender] = c; commitBlock[msg.sender] = block.number;
}
function reveal(string calldata answer, bytes32 salt) external {
    require(commitments[msg.sender] != 0, "no commitment");
    require(block.number > commitBlock[msg.sender], "reveal in a later block");
    require(keccak256(abi.encode(answer, salt, msg.sender)) == commitments[msg.sender], "commitment mismatch");
    ...
}
```

## Why it works
- Copying a **commit** gives the attacker a hash bound to the *bot's* address, which they can never reveal.
- Copying a **reveal** fails because the attacker has no commitment of their own.
- The attacker cannot commit and reveal in the same block after seeing the answer, because the reveal has to come in a later block.

In the secure test the player's copied reveal reverts and the bot wins. Other mitigations, depending on the use case: private transaction relays or orderflow auctions, batch auctions, and slippage limits for swaps.
