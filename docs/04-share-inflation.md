# 04 — Inflated Shares (First-depositor / donation inflation)

**Layer:** Contract (accounting) · **Difficulty:** Hard · **Rounding / arithmetic (SWC-101 family)** · **OWASP SC Top 10 (2025): SC03**

## Root cause
Two things combine:
1. `totalAssets()` is the vault's raw `token.balanceOf(this)`, which **anyone can increase** by transferring tokens directly (a "donation") without minting shares.
2. `shares = assets * totalShares / totalAssets()` **rounds down**, and nothing rejects a deposit that mints 0 shares.

If the attacker owns the only share and donates a large amount, a later depositor's shares round down to zero. Their tokens join the pool, and the attacker's single share redeems for everything.

## How a tester finds it
1. **Find every share/price formula** (`* / `) and ask: can the denominator be made huge, or the numerator tiny?
2. **Ask whether accounting uses `balanceOf(this)`.** If so, direct transfers change the price, and you have a donation vector.
3. **Test the empty-vault edge case:** first deposit of 1 wei, then a donation, then a victim deposit. Check whether the victim got 0 shares.
4. **Watch for missing `require(shares > 0)`** on mint paths.

## Exploit
`test/04-share-inflation.test.js`:
1. Deposit **1 wei** → you own 1 share (the whole supply).
2. Transfer **10 DVT** directly to the vault → `totalAssets = 10e18 + 1`.
3. Alice deposits 10 DVT → `10e18 * 1 / (10e18 + 1) = 0` shares.
4. Redeem your 1 share → you receive all `20e18 + 1` wei of DVT. You started with 20 DVT and end with ~30.

## The fix (OpenZeppelin ERC-4626 "virtual shares" mitigation)
```solidity
uint256 constant VIRTUAL_SHARES = 1e6;   // decimals offset
uint256 constant VIRTUAL_ASSETS = 1;
minted = assets * (totalShares + VIRTUAL_SHARES) / (totalAssets() + VIRTUAL_ASSETS);
require(minted > 0, "zero shares");
```

## Why it works
The virtual shares act like an extra depositor who can never withdraw. To round a victim down, the attacker now has to donate about a million times more. Most of the donation then belongs to the virtual shares and is lost to the attacker, so the attack loses money. In the secure test the same steps leave the player with ~15 DVT (a 5 DVT loss), and Alice can redeem ~10 DVT. Other mitigations include seeding the vault with an initial "dead shares" deposit and tracking assets internally instead of using `balanceOf`.

## Checklist
- Does accounting use `balanceOf(this)`? Can a donation move the share price?
- What happens on the very first deposit?
- Are 0-share mints rejected, and does rounding favour the vault?
