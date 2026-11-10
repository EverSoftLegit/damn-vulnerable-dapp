# 03 — Phishing Alice (tx.origin authentication)

**Layer:** Contract · **Difficulty:** Medium · **SWC-115** · **OWASP SC Top 10 (2025): SC01**

## Root cause
`OriginWalletVulnerable.transfer` checks `tx.origin == owner`. `tx.origin` is the externally owned account that **started** the transaction, not the contract or account that called the wallet. If Alice calls any malicious contract, that contract can call her wallet, and `tx.origin` is still Alice.

## How a tester finds it
1. **Search the codebase for `tx.origin`.** Any use in an authorisation check is a finding. (`tx.origin == msg.sender` as an "only EOAs" check is a different, weaker pattern, and also worth flagging.)
2. **Model the phishing flow:** victim → attacker contract → target. Ask what `msg.sender` and `tx.origin` are at each hop.
3. Slither has a `tx-origin` detector.

## Exploit
`contracts/03-tx-origin/solution/FakeAirdrop.sol`, proven by `test/03-tx-origin.test.js`:
1. Deploy `FakeAirdrop(wallet)`. Its `claimAirdrop()` calls `wallet.transfer(attacker, wallet.balance)`.
2. Get Alice to call `claimAirdrop()`. Inside the wallet, `tx.origin == Alice`, so the check passes.

**UI walkthrough:** `await dvd.deploy("FakeAirdrop", [dvd.state("03-tx-origin").wallet])`, paste the address into **Phish Alice**, click **Send Alice the link**, then **Check solution**.

## The fix
```solidity
require(msg.sender == owner, "not owner");
```

## Why it works
`msg.sender` is the immediate caller. When Alice calls the attacker's contract, the wallet sees `msg.sender == FakeAirdrop`, not Alice, so the call reverts (`not owner`). Alice calling her wallet directly still works, as the secure "legitimate use" test shows.

## Note for app testers
This is why wallet UIs warn about interacting with unknown contracts. A user's signature authorises *that call*, and any contract it touches gets to act within that transaction.
