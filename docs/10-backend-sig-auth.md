# 10 — Sign In As Anyone (Backend signature verification done wrong)

**Layer:** Web / integration (backend) · **Difficulty:** Medium · **OWASP API2:2023 Broken Authentication, A07:2021**

## Root cause
`server/siwe.js` (Vulnerable) calls `ethers.verifyMessage(message, signature)`. That only proves the signature is valid for *some* address. The server then **ignores the recovered address** and creates a session for the `address` field the client sent in the JSON body. There is also no server nonce, domain, chain id or expiry, so any signed login message can be replayed forever.

## How a tester finds it
1. **Sign in normally with a proxy or DevTools open** (Network tab). Look at `POST /api/c10/login`: `{ address, message, signature }`.
2. **Tamper with one field at a time.** Change `address` to the admin's address and resend. In DevTools, use *Copy as fetch*, edit it, and run it in the Console. If the session comes back as admin, the server trusts the client's claim.
3. **Check replay:** send the same body twice, a day later, or from another origin. Does the message contain a server-issued nonce, the domain, chain id and an expiry?
4. **Check the message binding:** can you sign an arbitrary string ("hello") and still log in?

## Exploit
`test/10-backend-sig-auth.test.js`. In the browser console:
```js
const message = "Sign in to Damn Vulnerable dApp";
const signature = await dvd.signer.signMessage(message);
const admin = dvd.state("10-backend-sig-auth").admin;
const { token } = await (await fetch("/api/c10/login", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: admin, message, signature }) })).json();
await (await fetch("/api/c10/admin", { headers: { authorization: "Bearer " + token } })).json();
```

## The fix (EIP-4361 "Sign-In with Ethereum" style; see `/api/c10-secure`)
1. `POST /nonce {address}`: the server creates a random **single-use nonce** with a 5-minute expiry and returns the **exact message** to sign (domain, address, chain id, nonce, issued-at).
2. `POST /login {nonce, signature}`: the server looks up *its own* copy of the message, deletes the nonce, recovers the signer, and requires `recovered === expected address`. The session is created for the **recovered** address.

## Why it works
Identity now comes from the cryptography, not from client input, and every login message is single-use, bound to this site and chain, and short-lived. The secure test shows the forged admin login returning 401, and a replayed valid login being rejected. For production, use a maintained SIWE library and also check the `domain`/`URI` against the request origin.
