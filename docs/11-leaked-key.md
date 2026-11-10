# 11 — Keys in the Bundle (Hard-coded privileged key in the frontend)

**Layer:** Web / integration (frontend) · **Difficulty:** Easy · **CWE-798, OWASP A07:2021 / A04:2021**

## Root cause
The "gasless" reward feature needed someone to sign the mint transaction. The developers put the **relayer's private key in `app/config.js`**, which is served to every visitor, and sign the mint in the browser. The only rate limit is a `localStorage` timestamp on the client. Anyone who reads the page source holds the minter key and can mint without limit, because `RewardTokenVulnerable` has no caps either.

## How a tester finds it
1. **Read every JavaScript file the app ships** (DevTools → Sources, or save the page). In real apps, search the minified bundle too.
2. **Grep for secrets:** `/0x[0-9a-fA-F]{64}/` (private keys), `PRIVATE_KEY`, `mnemonic`, `secret`, `apiKey`, RPC URLs with embedded keys. Tools like gitleaks and trufflehog do this across git history.
3. **Derive the address:** `new ethers.Wallet(key).address`. Compare it with privileged roles on-chain (`minter()`, `owner()`).
4. **Treat client-side controls as advisory.** Anything enforced only in the browser (`localStorage` cooldowns, disabled buttons) is not a control.

## Exploit
`test/11-leaked-key.test.js`:
```js
const relayer = new ethers.Wallet(DVD_CONFIG.relayerPrivateKey, dvd.provider);
const t = await dvd.contract("RewardTokenVulnerable", dvd.state("11-leaked-key").token, relayer);
await (await t.mint(dvd.player, ethers.parseEther("1000"))).wait();
```

## The fix
1. **The key never reaches the browser.** The backend holds it (an env var at minimum; a KMS/HSM or managed relayer in production) and mints on request after its own authenticated, server-side rate limiting. In this repo that is the `serverClaim` bot, signing as a separate `SECURE_MINTER` account.
2. **Limit the damage if a key leaks anyway:** `RewardTokenSecure` caps each mint at 10 RWD and enforces a 24h per-recipient cooldown on-chain.
3. **Rotate any key that has ever been shipped or committed.** Deleting it in a later commit does not remove it from git history.

## Why it works
In the secure test the leaked key belongs to an account with no role, so `mint` reverts with `not minter`. Even the real minter cannot claim twice inside the cooldown.
