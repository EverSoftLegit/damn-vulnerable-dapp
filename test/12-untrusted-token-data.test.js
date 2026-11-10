const { expect } = require("chai");
const { challengeSuite } = require("./harness");
const { deploy, at } = require("../lib/artifacts");
const render = require("../app/render.js");
const mod = require("../lib/challenges/12-untrusted-token-data");

const PAYLOAD = '<img src=x onerror="alert(document.domain)">';

challengeSuite(
  mod,
  async ({ signers }, s) => {
    const evil = await deploy(signers.player, "NamedToken", [PAYLOAD, "XSS"]);
    await (await at("TokenWatchlist", s.watchlist, signers.player).list(await evil.getAddress())).wait();
  },
  async () => {
    const t = { name: PAYLOAD, symbol: "XSS", address: "0x0" };
    expect(render.looksExecutable(render.tokenRowVulnerable(t))).to.equal(true);
    expect(render.looksExecutable(render.tokenRowSecure(t))).to.equal(false);
    expect(render.tokenRowSecure(t)).to.contain("&lt;img");
  }
);
