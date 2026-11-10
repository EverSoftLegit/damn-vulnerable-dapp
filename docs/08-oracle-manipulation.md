# 08 — Pumped Collateral (Spot-price oracle manipulation)

**Layer:** Economic / logic · **Difficulty:** Hard · **No direct SWC entry** · **OWASP SC Top 10 (2025): SC02**

## Root cause
`LendingDeskVulnerable.price()` reads `pool.spotPrice()`, the **current reserve ratio of a single, thin AMM pool** (100 DVT / 100 dUSD). Spot reserves move instantly with trade size. A single swap can multiply the reported DVT price, and the desk then lends against collateral at that inflated value.

## How a tester finds it
1. **Trace every price the protocol trusts back to its source.** Is it `getReserves()`, a `balanceOf` ratio, or `spotPrice()` from one pool?
2. **Measure the liquidity behind it** and calculate how much it costs to move the price by 10x. Here, 1,000 dUSD moves it about 121x.
3. **Remember flash loans:** on a real chain the attacker does not need their own capital. They can borrow it, manipulate the price, borrow from the protocol and repay, all in one transaction.
4. **Write the attack as a test:** swap → act → (swap back).

## Exploit
`test/08-oracle-manipulation.test.js`:
1. Swap 1,000 dUSD → ~90.9 DVT. The pool is now ~9.09 DVT / 1,100 dUSD, so the spot price is ~121 dUSD per DVT.
2. Deposit all ~190.9 DVT as collateral, now "worth" ~23,100 dUSD.
3. Borrow the desk's entire 10,000 dUSD (limit ~11,550).

## The fix
```solidity
function price() public view returns (uint256 p) {
    uint256 updatedAt;
    (p, updatedAt) = feed.latest();                       // aggregated oracle, not a pool
    require(p > 0 && block.timestamp - updatedAt <= MAX_AGE, "stale price");
}
```
Use a manipulation-resistant source: a decentralised oracle network feed (with staleness and sanity checks), or a sufficiently long TWAP over deep liquidity. Add borrow caps and circuit breakers as defence in depth. `MockPriceFeed` stands in for a real feed on this offline chain.

## Why it works
A swap in one pool does not change an aggregated feed. The same steps against `LendingDeskSecure` value the collateral at ~191 dUSD, and `borrow()` reverts with `undercollateralised`.
