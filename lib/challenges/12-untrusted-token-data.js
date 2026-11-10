const { at, deploy } = require("../artifacts");
const render = require("../../app/render.js");

module.exports = {
  id: "12-untrusted-token-data",
  title: "Poisoned Token Name",
  layer: "Web / integration (frontend)",
  difficulty: "Medium",
  swc: "n/a (frontend); CWE-79 Cross-site Scripting",
  owasp: "OWASP A03:2021 Injection (CWE-79 XSS)",
  goal: "The dApp shows a community Token Watchlist read from chain. List a token whose metadata executes script in other users' browsers when the watchlist renders.",
  hint: "Who controls an ERC-20's name() and symbol()? Look at how app/render.js turns them into HTML. NamedToken lets you deploy a token with any name.",
  async setup({ signers }) {
    const list = await deploy(signers.deployer, "TokenWatchlist");
    const t = await deploy(signers.deployer, "NamedToken", ["Damn Vulnerable Token", "DVT"]);
    await (await list.list(await t.getAddress())).wait();
    return { watchlist: await list.getAddress() };
  },
  // Solved when a token listed BY THE PLAYER renders to executable HTML.
  // Under the Secure variant the same payload is checked against the escaping renderer.
  async isSolved({ provider, signers, variant }, s) {
    const row = variant === "Secure" ? render.tokenRowSecure : render.tokenRowVulnerable;
    const list = at("TokenWatchlist", s.watchlist, provider);
    const n = Number(await list.count());
    for (let i = 0; i < n; i++) {
      const e = await list.entries(i);
      if (e.lister !== signers.player.address) continue;
      try {
        const t = at("NamedToken", e.token, provider);
        const html = row({ name: await t.name(), symbol: await t.symbol(), address: e.token });
        if (render.looksExecutable(html)) return true;
      } catch (_) { /* not an ERC-20; ignore */ }
    }
    return false;
  },
};
