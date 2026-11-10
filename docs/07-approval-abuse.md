# 07 — Infinite Approval (Arbitrary transferFrom + unlimited-approval UX)

**Layer:** Token · **Difficulty:** Medium · **SWC-105 pattern** · **OWASP SC Top 10 (2025): SC04 / SC01**

## Root cause
Two problems compound:
1. **Contract:** `ZapRouterVulnerable.depositFor(from, beneficiary, amount)` calls `token.transferFrom(from, …)` with a **caller-supplied `from`**. Any address that approved the router can be pulled from by anyone, and the credit goes to the caller's chosen beneficiary.
2. **Frontend:** the dApp's "Approve & Zap" flow asks for `approve(router, type(uint256).max)` and hides the amount behind a friendly prompt. Users end up with a permanent, unlimited allowance to a contract they never re-check.

## How a tester finds it
1. **Grep for `transferFrom(`** and trace the first argument. If it is not `msg.sender` (or a signer verified with a signature/permit), it is an arbitrary-transferFrom finding.
2. **Intercept the approval in the UI.** Click **View data** and decode the calldata: selector `0x095ea7b3` = `approve(address,uint256)`, followed by the spender and `ffff…ffff` = MaxUint256. Ask whether the UI shows that to the user.
3. **Simulate before signing.** A tester (or a careful wallet) should simulate the transaction and show the resulting allowance change. This app has no simulation or validation step, and that missing step is part of the finding.
4. **Check existing allowances** on-chain: `token.allowance(victim, router)`.

## Exploit
`test/07-approval-abuse.test.js`:
```js
const s = dvd.state("07-approval-abuse");
const r = await dvd.contract("ZapRouterVulnerable", s.router);
await (await r.depositFor(s.alice, dvd.player, ethers.parseEther("50"))).wait();
await (await r.withdraw(ethers.parseEther("50"))).wait();
```

## The fix
```solidity
function depositFor(address from, address beneficiary, uint256 amount) external {
    require(from == msg.sender, "can only pull your own tokens");
    token.safeTransferFrom(msg.sender, address(this), amount);
    deposits[beneficiary] += amount;
}
```
Frontend: request an **exact** approval for the amount being zapped, display the spender and amount in plain words, and simulate the transaction before asking for a signature. Prefer EIP-2612 `permit` with a deadline, or Permit2-style scoped and expiring approvals. Treat a signed permit like any other signature: it needs a nonce, a deadline and a domain (see challenge 06), and the UI must show what the permit allows.

## Why it works
The router can only pull tokens from the account that is calling it, so another user's allowance is useless to an attacker. Exact approvals limit what a future router bug could cost users. The secure "legitimate use" test approves exactly 5 DVT and zaps successfully.
