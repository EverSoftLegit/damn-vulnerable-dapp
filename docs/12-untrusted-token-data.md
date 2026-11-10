# 12 — Poisoned Token Name (Frontend trusts on-chain data → XSS)

**Layer:** Web / integration (frontend) · **Difficulty:** Medium · **CWE-79, OWASP A03:2021 Injection**

## Root cause
Anyone can deploy an ERC-20 and choose its `name()` and `symbol()`. Anyone can add any token to the `TokenWatchlist`. The dApp renders the watchlist with `tokenRowVulnerable`, which pastes `name` and `symbol` straight into HTML, then assigns the result with **`innerHTML`**. On-chain data is user input: putting it on a blockchain does not make it trusted.

## How a tester finds it
1. **List every place the UI shows on-chain strings:** token names and symbols, NFT metadata (`tokenURI` JSON, images, SVG), ENS names and text records, contract-emitted event strings, and error messages.
2. **Find the sink:** search the frontend for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, React's `dangerouslySetInnerHTML`, `v-html`, and unsanitised SVG/markdown rendering.
3. **Plant a canary.** Deploy a token named `<img src=x onerror=alert(document.domain)>`, list it, and reload. If the alert fires, an attacker could instead modify transaction details, swap displayed addresses, or prompt users to sign malicious approvals.

## Exploit
`test/12-untrusted-token-data.test.js`. **UI walkthrough:** in **Deploy a NamedToken**, set the name to `<img src=x onerror=alert(document.domain)>`, click **Deploy**, then **Add to watchlist**. The alert fires when the list renders. Click **Check solution**.

## The fix
```js
function tokenRowSecure(t) {
  return `<li><b>${escapeHtml(t.name)}</b> (${escapeHtml(t.symbol)}) <code>${escapeHtml(t.address)}</code></li>`;
}
```
Better still, build DOM nodes and set `textContent`. In frameworks, use normal JSX/template interpolation, which escapes by default. Add a strict **Content-Security-Policy** (no inline script) as defence in depth, and sanitise any rich content such as NFT SVGs with a vetted sanitiser, or render it in a sandboxed iframe.

## Why it works
Escaped text is shown as text and never parsed as markup, so the payload displays harmlessly as `<img …>`. The secure test confirms the escaped output contains `&lt;img` and no executable markup.
