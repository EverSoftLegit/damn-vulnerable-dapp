# How to play: a tester's guide

This guide shows you **how to approach** the challenges: the method, the tools, one fully worked
example, and a first step for every other challenge. It does not give away the other answers. The
locked write-up in the app (and `docs/`) is your reward for solving each one.

New here? Read the [README](README.md) first: setup, the safety warning, and the recommended reading.

---

## 1. Who this is for

This lab is for people who have **already been studying how to secure Web3 platforms** and want to
practise *finding* the bugs they have read about. That includes developers, auditors and
pentesters/AppSec engineers moving into Web3. You'll get the most out of it if you are comfortable with:

- reading Solidity (functions, modifiers, `msg.sender`, `mapping`, events),
- the basics of Ethereum transactions (gas, nonces, signatures, the mempool),
- browser DevTools (Console and Network tabs) and a little JavaScript,
- common web-security ideas (authentication, XSS, secrets in client code).

If some of that is new, start with the reading list in the README. The Easy challenges (01, 02, 05, 11)
are a gentle way in.

---

## 2. The method (use it on every challenge)

Real Web3 testing follows the same loop, whatever the bug class:

1. **Recon.** Read the goal. Note every address in the **On-chain** card. Ask what you are trying to change: a balance, an owner, a session?
2. **Map the attack surface.** List the contract's functions (the ABI), the backend endpoints, and what the frontend sends and signs. Use the browser's Network tab for the web challenges.
3. **Read the code that guards the asset.** Source is in `contracts/NN-*/<Name>Vulnerable.sol` (and `server/`, `app/` for the web ones). **Don't open the `...Secure.sol` files or `solution/` folders.** They contain the answer.
4. **Form a hypothesis.** "If I call X as a stranger…", "if I send this twice…", "if the price comes from here…".
5. **Prove it on the local chain.** Run the smallest experiment that confirms or kills the hypothesis. A revert is information too.
6. **Exploit, then Check solution.** When the on-chain state meets the goal, the server unlocks the write-up. Then read *how a tester finds it* and compare it with what you did.

There's no answer box. **Solving means changing the state on your local chain.** The app checks it when you click **Check solution**.

---

## 3. Your toolkit

**Browser console.** Press F12 → Console. The app gives you a `dvd` helper object:

```js
dvd.help()                                  // list of helpers
dvd.player                                  // your address
dvd.state("02-access-control")              // deployed addresses for a challenge
const c = await dvd.contract("TreasuryVaultVulnerable", dvd.state("02-access-control").vault);
c.interface.fragments.filter(f => f.type === "function").map(f => `${f.format()} [${f.stateMutability}]`)
await c.owner()                             // call a view function (free, no transaction)
await (await c.someFunction(arg)).wait()    // send a transaction and wait for it to be mined
await dvd.deploy("ContractName", [args])    // deploy a compiled contract
await dvd.pending()                         // see the mempool (pending block)
await dvd.check("02-access-control")        // same as the Check solution button
ethers.parseEther("1")                      // 1 ETH in wei; ethers v6 is available as `ethers`
```

**Your own attack contracts.** Some challenges need a contract, not just a transaction:
1. Create `contracts/playground/MyAttack.sol`.
2. Run `npx hardhat compile` in a second terminal (keep `npm run dev` running).
3. In the console: `await dvd.deploy("MyAttack", [constructorArgs])`.

**Raw ABIs.** `http://127.0.0.1:3000/api/artifacts/<ContractName>`, the same JSON a block explorer gives you.

**Other tools.** The chain is plain JSON-RPC at `http://127.0.0.1:8545`, so `npx hardhat console --network localhost`, Foundry's `cast`, and Burp Suite (for the web challenges) all work.

**Reading reverts.** An error like `reverted with reason string 'not owner'` is the contract telling you which check stopped you. Note it, because it tells you what to get around.

**Starting over.** **Reset / redeploy this challenge** gives fresh contracts, and the write-up stays unlocked once earned.

---

## 4. Worked example: 02 Unlocked Treasury (full spoiler for 02 only)

> Try it yourself first. Come back here if you get stuck.

**Goal:** the vault holds 5 ETH that only the owner can sweep. Empty it.

**Step 1: map the surface.**
```js
const v = await dvd.contract("TreasuryVaultVulnerable", dvd.state("02-access-control").vault);
v.interface.fragments.filter(f => f.type === "function").map(f => `${f.format()} [${f.stateMutability}]`)
// [ "changeOwner(address) [nonpayable]", "owner() [view]", "sweep(address) [nonpayable]" ]
```
`owner()` only reads. The two state-changing functions are `changeOwner` and `sweep`.

**Step 2: test the obvious path.**
```js
await (await v.sweep(dvd.player)).wait()
// throws an error mentioning "not owner"
```
Good: `sweep` *is* protected. Write that down as a control that works.

**Step 3: ask the hint's question about the other function.** Who should be allowed to call `changeOwner`? Only the current owner. Is that enforced? Test it:
```js
await (await v.changeOwner(dvd.player)).wait()   // no revert!
await v.owner()                                  // now returns your address
```
That's the bug: a missing `onlyOwner` modifier. You can confirm it in `TreasuryVaultVulnerable.sol`.

**Step 4: use the access you gained.**
```js
await (await v.sweep(dvd.player)).wait()         // succeeds this time
```
Vault ETH drops to 0. Click **Check solution**, and the write-up unlocks.

**What you practised:** enumerate every state-changing function → decide who *should* call it → test whether a stranger *can*. That loop finds a very large share of real access-control bugs.

---

## 5. Where to start on each challenge (no spoilers)

These are first moves, one level more concrete than the in-app hints. They point you where to look,
not at the answer.

| # | Challenge | Look at first | Useful technique |
|---|---|---|---|
| 01 | Leaky Bank | The order of lines in `withdraw()` | Write a contract in `playground/` with a `receive()` function and see when it runs |
| 02 | Unlocked Treasury | Fully worked above | ABI enumeration |
| 03 | Phishing Alice | The `require` inside `transfer()` | Draw the call chain Alice → your contract → wallet; note `msg.sender` and `tx.origin` at each hop |
| 04 | Inflated Shares | The share formula in `deposit()` and what `totalAssets()` reads | Work the maths by hand for a vault holding 1 share; try extreme numbers |
| 05 | Predictable Lottery | The line that computes `answer` | Ask what a contract running in the *same transaction* can also see |
| 06 | One Voucher, Many Claims | The voucher JSON (domain + fields) and the `usedSignatures` mapping | Learn what makes a secp256k1 signature malleable; compare "used signature" with "used message" |
| 07 | Infinite Approval | The **View data** link in the Approve & Zap prompt, then every `transferFrom` in the router | Decode the calldata (`0x095ea7b3` = `approve`); trace where `from` comes from |
| 08 | Pumped Collateral | Where `price()` gets its number, and the pool reserves shown on the page | Calculate the price after a large swap with x·y=k before you send anything |
| 09 | Mempool Sniper | The Mempool panel after you wake the bot | Read the pending tx's `to`/`data`; think about how transactions are ordered by tip |
| 10 | Sign In As Anyone | DevTools → Network → the `login` request body | Right-click → *Copy as fetch*, edit one field at a time, replay it in the Console |
| 11 | Keys in the Bundle | View page source / DevTools → Sources | Search the JavaScript for long hex strings; derive the address with `new ethers.Wallet(key).address` |
| 12 | Poisoned Token Name | How the watchlist turns token names into HTML (`app/render.js`) | Deploy a `NamedToken` whose name is a harmless HTML test payload |

**Suggested order:** 02 → 01 → 05 → 11 → 03 → 07 → 10 → 12 → 09 → 08 → 06 → 04 (roughly easiest to hardest, with the app-layer ones mixed in).

---

## 6. Stuck? The escalation ladder

Go one rung at a time. Each rung gives away more than the one before:

1. Re-read the goal and apply the method in section 2.
2. **Show hint** in the app.
3. The "Look at first" row for that challenge in section 5.
4. The write-up `docs/NN-*.md`. It is the same content the app unlocks, so it spoils that challenge.
5. The exploit test `test/NN-*.test.js` and reference attacks in `contracts/NN-*/solution/` (full solution).
6. `scripts/smoke.js` solves everything (all spoilers).

---

## 7. After you solve one

Don't stop at the green tick. The real learning is in the write-up:
- Compare how you found it with the **How a tester finds it** section.
- Read the **fix**, then open the `...Secure.sol` file and see why your exploit no longer works there.
- Run `npm run test:verbose` to see each secure version block the attack with its specific revert reason.
- Ask what other places in a real codebase the same bug class could hide in. That's the habit that transfers to real engagements.
