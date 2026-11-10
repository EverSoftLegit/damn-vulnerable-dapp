# 01 — Leaky Bank (Reentrancy)

**Layer:** Contract · **Difficulty:** Easy · **SWC-107** · **OWASP SC Top 10 (2025): SC05**

## Root cause
`EtherBankVulnerable.withdraw()` sends ETH with `msg.sender.call{value: amount}("")` **before** it sets `balances[msg.sender] = 0`. Sending ETH to a contract runs that contract's `receive()` function, so the caller gets control back while its balance is still on the books. It calls `withdraw()` again, and again, until the bank is empty.

## How a tester finds it
1. **Read the state-changing functions in order.** For every external call (`call`, `transfer`, token transfers, calls into user-supplied addresses), ask whether any storage this contract relies on is updated *after* the call.
2. **Look for the pattern "check → interact → effect".** The safe order is check → effect → interact (Checks-Effects-Interactions).
3. **Tooling:** Slither's `reentrancy-eth` detector flags this exact function. In a test, deploy a contract whose `receive()` re-enters and watch the balance.
4. **In the dApp:** the info panel shows the bank owing Alice 10 ETH. After your attack, the bank holds less than it owes, which means it is insolvent.

## Exploit
`contracts/01-reentrancy/solution/ReentrancyAttacker.sol`, proven by `test/01-reentrancy.test.js`:
1. Deposit 1 ETH from the attacker contract.
2. Call `withdraw()`. The bank sends 1 ETH → `receive()` runs → it calls `withdraw()` again while `balances[attacker]` is still 1 ETH.
3. Repeat until the bank cannot pay, then forward the loot to the player.

**UI walkthrough:** open DevTools →
```js
const a = await dvd.deploy("ReentrancyAttacker", [dvd.state("01-reentrancy").bank]);
await (await a.attack({ value: ethers.parseEther("1") })).wait();
await dvd.check("01-reentrancy");
```

## The fix
```solidity
function withdraw() external nonReentrant {           // 2) belt: a reentrancy lock
    uint256 amount = balances[msg.sender];
    require(amount > 0, "nothing to withdraw");
    balances[msg.sender] = 0;                         // 1) braces: effect BEFORE interaction
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "transfer failed");
}
```

## Why it works
When the attacker re-enters, its balance is already 0, so the require fails. The `nonReentrant` guard also blocks the nested call outright. Either fix alone stops this attack, and using both protects functions that share state too (cross-function reentrancy). In the secure test the attack reverts with `transfer failed`: the nested call hits the guard, the bank's `call` returns false and the whole transaction rolls back.

## Checklist
- Is every external call made after the state is updated?
- Are functions that share state protected *together* (cross-function reentrancy)?
- Are read-only views used by other protocols safe to call mid-call (read-only reentrancy)?
