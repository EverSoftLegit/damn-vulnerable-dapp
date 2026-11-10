// Rendering helpers for the Token Watchlist (challenge 12). Works in the browser and in Node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DvdRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // VULNERABLE: name/symbol come from an arbitrary contract and are pasted into HTML.
  function tokenRowVulnerable(t) {
    return `<li><b>${t.name}</b> (${t.symbol}) <code>${t.address}</code></li>`;
  }

  // SECURE: treat on-chain strings as untrusted text. (Better still: build DOM nodes with textContent.)
  function tokenRowSecure(t) {
    return `<li><b>${escapeHtml(t.name)}</b> (${escapeHtml(t.symbol)}) <code>${escapeHtml(t.address)}</code></li>`;
  }

  // Rough detector used by the solve check and tests: does this HTML contain markup that runs script?
  function looksExecutable(html) {
    return /<script\b/i.test(html) || /<[a-z][^>]*\son[a-z]+\s*=/i.test(html) || /<[a-z][^>]*(href|src)\s*=\s*["']?\s*javascript:/i.test(html);
  }

  return { escapeHtml, tokenRowVulnerable, tokenRowSecure, looksExecutable };
});
