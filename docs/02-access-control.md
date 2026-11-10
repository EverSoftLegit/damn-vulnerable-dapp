# 02 — Unlocked Treasury (Missing access control)

**Layer:** Contract · **Difficulty:** Easy · **SWC-105 / SWC-100** · **OWASP SC Top 10 (2025): SC01**

## Root cause
`changeOwner(address)` is `external` and has **no `onlyOwner` modifier**. Anyone can make themselves owner and then call the properly protected `sweep()`. One missing modifier defeats the protection on everything else.

## How a tester finds it
1. **Enumerate the ABI** (`dvd.contract(...)`, a block explorer, or the artifact JSON). List every non-view function.
2. **For each one, name who should be able to call it**, then check that the code enforces it. Admin-sounding names (`set*`, `change*`, `init*`, `upgrade*`, `withdraw*`, `sweep*`, `mint*`) get extra scrutiny.
3. **Just call it from an unprivileged account** on a fork or local chain. If it does not revert, you have a finding.
4. Slither's `arbitrary-send-eth` and `suicidal` detectors, and access-control detectors in other analysers, help here. Manual ABI review is still the most reliable check.

## Exploit
`test/02-access-control.test.js`:
```js
const v = await dvd.contract("TreasuryVaultVulnerable", dvd.state("02-access-control").vault);
await (await v.changeOwner(dvd.player)).wait();
await (await v.sweep(dvd.player)).wait();
```

## The fix
```solidity
function changeOwner(address newOwner) external onlyOwner {
    require(newOwner != address(0), "zero owner");
    owner = newOwner;
}
```
In production prefer OpenZeppelin `Ownable2Step` (the new owner must accept the change) or `AccessControl` with explicit roles.

## Why it works
The modifier makes the function revert unless `msg.sender == owner`, so there is no longer an unprivileged path to ownership. The secure test's `changeOwner` call reverts with `not owner`.

## Checklist
- Is every privileged function gated, including initialisers and upgrade hooks?
- Is ownership transferred in two steps?
- Are there tests that call each privileged function from a stranger and expect a revert?
