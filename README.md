# Damn Vulnerable dApp

> ## ⚠️ INTENTIONALLY VULNERABLE: RUN LOCALLY ONLY, NEVER DEPLOY
> Every contract, endpoint and page in this repository is deliberately broken. It runs on a local
> Hardhat chain (chain id 31337) with Hardhat's public test accounts. **Do not deploy any of it to
> mainnet, a public testnet or any server reachable by others, and never put a real key or real funds
> anywhere near it.** The server binds to `127.0.0.1` on purpose.

Damn Vulnerable dApp is a hands-on lab for learning to **test Web3 applications**: the contracts,
and also the signatures, token approvals, economic logic, backend APIs and frontend that surround
them. It is in the spirit of OWASP Juice Shop, Damn Vulnerable DeFi and Ethernaut, with the focus on the
*app* layer, which smart-contract-only labs rarely cover.

**The learning loop:** you attack first. Each challenge shows a goal and an optional hint. The
"how a tester finds it", the fix and the root-cause write-up stay **locked** until the server sees
you have actually solved that challenge on your local chain.

## Challenges

| # | Challenge | Layer | Difficulty | Mapping |
|---|---|---|---|---|
| 01 | Leaky Bank: reentrancy | Contract | Easy | SWC-107 · SC05:2025 |
| 02 | Unlocked Treasury: missing `onlyOwner` | Contract | Easy | SWC-105/100 · SC01:2025 |
| 03 | Phishing Alice: `tx.origin` auth | Contract | Medium | SWC-115 · SC01:2025 |
| 04 | Inflated Shares: first-depositor share inflation | Contract (accounting) | Hard | rounding · SC03:2025 |
| 05 | Predictable Lottery: block-based randomness | Contract | Easy | SWC-120 · SC09:2025 |
| 06 | One Voucher, Many Claims: EIP-712 replay + malleability (no nonce/deadline/chainId) | Signature & auth | Hard | SWC-121/117 · API2:2023 |
| 07 | Infinite Approval: arbitrary `transferFrom` + unlimited-approval UX, no tx simulation | Token | Medium | SC04/SC01:2025 |
| 08 | Pumped Collateral: spot-price oracle from one thin pool | Economic | Hard | SC02:2025 |
| 09 | Mempool Sniper: front-running | Economic | Medium | SWC-114 |
| 10 | Sign In As Anyone: backend trusts client address after verifying a signature | Web (backend) | Medium | API2:2023 · A07:2021 |
| 11 | Keys in the Bundle: privileged relayer key shipped to the browser | Web (frontend) | Easy | CWE-798 · A07:2021 |
| 12 | Poisoned Token Name: frontend renders on-chain strings as HTML (XSS) | Web (frontend) | Medium | CWE-79 · A03:2021 |

"SCxx:2025" refers to the OWASP Smart Contract Top 10 (2025). "Axx:2021" refers to the OWASP Top 10 (2021). "API2:2023" refers to the OWASP API Security Top 10.

Each challenge ships with:
- a **vulnerable** and a **secure** implementation (`contracts/NN-*/`, or `server/siwe.js` / `app/render.js` for the web-layer ones),
- an **automated exploit test** that must succeed against the vulnerable version and fail against the secure one (`test/NN-*.test.js`), plus, where it makes sense, a test showing the secure version still supports the legitimate use case,
- a pre-solve **hint**, and a locked **write-up** (`docs/NN-*.md`) covering root cause, how a tester finds it, the exploit (with a UI walkthrough where relevant), the fix and why it works.

## Quick start

Requirements: Node.js 18+ (20 or 22 recommended) and npm. Nothing else: the Solidity compiler comes
from the `solc` npm package, so compiling needs no extra downloads.

```bash
npm install
npm run dev          # compiles, starts a local Hardhat chain, deploys all challenges, serves the app
# open http://127.0.0.1:3000
```

Run the tests:

```bash
npm test             # 34 tests: every exploit vs Vulnerable (must succeed) and vs Secure (must fail)
npm run test:verbose # also prints the revert reason that stops each exploit on the secure version
```

With the app running, `npm run smoke` solves all 12 challenges through the app's HTTP API and RPC proxy
and checks that each write-up unlocks. **It contains every solution**, so play first.

## How to play

1. Pick a challenge on the scoreboard and read the goal. The **On-chain** card lists the deployed addresses and live balances.
2. Attack it any way you like:
   - **In the UI.** Some challenges have flows to probe: the approval prompt (07), the mempool viewer and transaction composer (09), the login (10), the "gasless" reward claim (11) and the token watchlist (12). Bot buttons simulate other users: Alice falling for a phishing link (03), Alice depositing (04), the voucher issuer (06) and the solver bot (09).
   - **From the browser console.** Open DevTools and type `dvd.help()`. You get `ethers`, a signer for your account (`dvd.signer`), `dvd.contract(name, address)`, `dvd.deploy(name, args)`, `dvd.pending()` and `dvd.check(id)`.
   - **With your own contracts.** Write them in `contracts/playground/`, run `npx hardhat compile`, then `dvd.deploy("YourContract", [...])`.
   - **With your usual tools.** The chain is plain JSON-RPC at `http://127.0.0.1:8545` (also proxied at `/rpc`), so Hardhat console, Foundry's `cast`, Burp or any HTTP client all work.
3. Click **Check solution**. When the server confirms it, the write-up and fix unlock.
4. **Reset / redeploy this challenge** gives you fresh contracts. **Redeploy all challenges** resets everything. **Clear my progress** re-locks every write-up.

**The "wallet":** you play as Hardhat account #1 (`0x7099…79C8`). Its key is held by the local Hardhat
node, which signs for you through the app's RPC proxy, so there is no browser extension, real wallet or
real funds involved. All accounts are Hardhat's well-known default test accounts, and those keys are public.

| Role | Hardhat account |
|---|---|
| Deployer / issuer / admin | #0 |
| **You (player)** | #1 |
| Alice (simulated victim) | #2 |
| Solver bot (09) | #3 |
| Relayer (11, its key is the leaked one) | #5 |
| Secure minter (11, server-side only) | #6 |

## Repository layout

```
contracts/
  common/                 shared test tokens (DVToken, NamedToken)
  NN-<challenge>/         <Name>Vulnerable.sol, <Name>Secure.sol, solution/ (reference attack contracts: spoilers)
  playground/             your own attack contracts
lib/
  challenges/NN-*.js      per-challenge metadata, setup (deploy), isSolved, bots (shared by tests AND server)
  artifacts.js            loads compiled artifacts, deploys with plain ethers v6
  accounts.js             which Hardhat account plays which role
server/
  app.js                  Express API: deploy/reset, solve checks, locked write-ups, bots, RPC proxy
  siwe.js                 challenge 10 login API (Vulnerable + Secure variants)
  index.js                server entry point
app/                      vanilla JS + ethers frontend (scoreboard, challenge panels, locked fix panels)
  config.js               ships to the browser and is part of challenge 11
  render.js               watchlist renderer, part of challenge 12 (vulnerable and secure versions)
test/                     harness.js + one exploit/fix test file per challenge
docs/                     one write-up per challenge (what the UI unlocks)
scripts/dev.js            one-command local run
scripts/smoke.js          end-to-end check of the running app (spoilers)
.github/workflows/ci.yml  tests on Node 20 and 22, then starts the app and runs the smoke test
```

The same `setup()` and `isSolved()` code is used by the tests and by the running app, so what the tests
prove is exactly what the UI checks.

## How solve detection and locking work

- Solved means **on-chain state** (or, for challenge 10, the server's own record that an admin session was used) shows the goal was met for the player account. For example, the bank holds less ETH than it owes Alice, or `winner() == player`.
- The server records solved challenges in `.progress.json` and only then serves `GET /api/challenges/:id/writeup`. Until then it returns `403`. Write-ups are not bundled into the frontend.
- Server-only secrets, such as challenge 09's answer, are never sent to the browser.

## Limitations (please read)

- **The lock is a learning aid, not anti-cheat.** The docs, reference solutions and tests are in this repository, and the solve checks trust anything done from the player account on your own chain. Anyone can read ahead, and the lab cannot stop them.
- **Single player, single local chain.** The app always runs the *vulnerable* variants. The secure ones are exercised by the tests. Challenge 09 pauses automining for 30 seconds, which briefly delays every other transaction.
- **The secure versions are teaching fixes, not audited production code.** In particular, `LotterySecure` (05) uses a future blockhash, which a block producer can still bias (production should use a VRF), and `LendingDeskSecure` (08) reads a `MockPriceFeed` that stands in for a real oracle network.
- **Local mock wallet only.** There is no MetaMask or WalletConnect integration. Signing is done by the local Hardhat node for the player account.
- **Not covered (yet):** upgradeable proxy/initializer bugs, flash-loan mechanics on a fork, cross-chain bridges, a dedicated EIP-2612 `permit` phishing challenge (discussed in the 07 write-up), and chain-id confusion beyond the EIP-712 domain in 06.
- Solve-check heuristics are deliberately simple. For example, challenge 12 matches the rendered HTML against common script-execution patterns rather than running a real browser.

## Dependencies and `npm audit`

- Runtime dependencies (`ethers`, `express`): `npm audit --omit=dev` reported **0 vulnerabilities** when this was written (November 2026).
- The development toolchain (Hardhat 2 and its plugins) pulls in many transitive packages, and a full `npm audit` reported advisories in those dev-only dependencies. They run only on your machine against a local chain. Re-run `npm audit` yourself, because results change over time. Do not run `npm audit fix --force` blindly: it can upgrade Hardhat across major versions and break the build.
- Compiler: solc **0.8.24** (solc-js from npm), EVM target **cancun** (required by OpenZeppelin Contracts 5.x).

## Safety design

- Binds to `127.0.0.1` only; the chain is Hardhat's in-memory network, which is discarded when you stop `npm run dev`.
- No external RPC URLs, no API keys, no real private keys. The one "leaked" key (challenge 11) is Hardhat's public test account #5.
- Every exploit targets only this lab's own contracts and endpoints. Payloads are classic teaching examples, such as `alert(document.domain)`.

## Background

This project extends the author's earlier contract-only lab,
[web3-vuln-lab](https://github.com/EverSoftLegit/web3-vuln-lab) (reentrancy, access control,
`tx.origin`), into a full application with signature, token, economic and web-layer challenges and
an unlock-on-solve UI.

## License

MIT © Robinson Israel Uche. See [LICENSE](LICENSE).
