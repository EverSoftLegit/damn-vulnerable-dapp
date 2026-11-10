// Damn Vulnerable dApp — frontend. Vanilla JS + ethers v6 (UMD build served at /vendor).
// The "wallet" is a local mock: the Hardhat node holds the test key for the player account
// and signs on our behalf through the /rpc proxy. No browser extension, no real funds.
/* global ethers, DvdRender, renderMarkdown, DVD_CONFIG */
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  const fmt = (wei) => Number(ethers.formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

  const provider = new ethers.JsonRpcProvider(location.origin + DVD_CONFIG.rpcUrl, DVD_CONFIG.chainId, { staticNetwork: true });
  let data = null; // from /api/challenges
  let signer = null;
  let current = null;
  let timers = [];
  const abis = {};

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { "content-type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
    if (!res.ok) throw new Error(body.error || body);
    return body;
  }
  async function contract(name, address, runner = signer) {
    if (!abis[name]) abis[name] = (await api(`/api/artifacts/${name}`)).abi;
    return new ethers.Contract(address, abis[name], runner);
  }
  function toast(msg, kind = "") {
    const t = h("div", { class: `toast ${kind}` }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 4500);
  }
  async function send(label, fn) {
    try {
      const tx = await fn();
      if (tx && tx.wait) await tx.wait();
      toast(`✓ ${label}`, "good");
    } catch (e) {
      toast(`✗ ${label}: ${e.shortMessage || e.reason || e.message}`, "bad");
    }
    refreshInfo();
  }
  const state = (id) => data.challenges.find((c) => c.id === id).state;

  // ---------- console helpers ----------
  window.dvd = {
    ethers, provider,
    get signer() { return signer; },
    get player() { return data.player; },
    get accounts() { return data.accounts; },
    state,
    contract,
    async deploy(name, args = [], overrides = {}) {
      const { abi, bytecode } = await api(`/api/artifacts/${name}`);
      const c = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args, overrides);
      await c.waitForDeployment();
      console.log(`${name} deployed at ${await c.getAddress()}`);
      return c;
    },
    check: (id) => checkSolution(id),
    pending: () => provider.send("eth_getBlockByNumber", ["pending", true]),
    help() {
      console.log([
        "dvd.player                      your address",
        "dvd.state('01-reentrancy')      deployed addresses for a challenge",
        "await dvd.contract(name, addr)  ethers Contract bound to your signer (name = contract name, e.g. 'EtherBankVulnerable')",
        "await dvd.deploy(name, args)    deploy any compiled contract (put your own in contracts/playground, run npx hardhat compile)",
        "await dvd.pending()             the pending block, including mempool transactions",
        "await dvd.check(id)             ask the server whether the challenge is solved",
      ].join("\n"));
    },
  };

  // ---------- per-challenge widgets ----------
  // Each returns { info: async () => [[label, value], ...], ui: () => Node|null }
  const balanceOf = async (token, who) => fmt(await (await contract("DVToken", token, provider)).balanceOf(who));
  const widgets = {
    "01-reentrancy": (s) => ({
      info: async () => {
        const bank = await contract(s.contract, s.bank, provider);
        return [["Bank ETH balance", fmt(await provider.getBalance(s.bank)) + " ETH"],
          ["Owed to Alice", fmt(await bank.balances(data.accounts.victim)) + " ETH"],
          ["Your bank balance", fmt(await bank.balances(data.player)) + " ETH"]];
      },
    }),
    "02-access-control": (s) => ({
      info: async () => {
        const v = await contract(s.contract, s.vault, provider);
        return [["Vault ETH", fmt(await provider.getBalance(s.vault)) + " ETH"], ["owner()", await v.owner()]];
      },
    }),
    "03-tx-origin": (s) => ({
      info: async () => [["Alice's wallet", fmt(await provider.getBalance(s.wallet)) + " ETH"]],
      ui: () => {
        const input = h("input", { type: "text", placeholder: "0x… address of a contract with claimAirdrop()" });
        return card("Phish Alice", h("p", { class: "muted" }, "Alice clicks any 'claim your airdrop' link. Paste a contract address and she will call claimAirdrop() on it from her own account."),
          h("div", { class: "row" }, input, h("button", { class: "ghost", onclick: () => runBot("aliceClaimsAirdrop", { target: input.value.trim() }) }, "Send Alice the link")));
      },
    }),
    "04-share-inflation": (s) => ({
      info: async () => {
        const v = await contract(s.contract, s.vault, provider);
        return [["Vault totalAssets()", fmt(await v.totalAssets()) + " DVT"], ["Vault totalShares", (await v.totalShares()).toString() + " (raw units)"],
          ["Your shares", (await v.shares(data.player)).toString()], ["Alice's shares", (await v.shares(data.accounts.victim)).toString()],
          ["Your DVT", await balanceOf(s.token, data.player)]];
      },
      ui: () => card("Alice", h("button", { class: "ghost", onclick: () => runBot("aliceDeposits") }, "Alice deposits her 10 DVT now")),
    }),
    "05-weak-randomness": (s) => ({
      info: async () => [["Pot", fmt(await provider.getBalance(s.lottery)) + " ETH"], ["Last winner", await (await contract(s.contract, s.lottery, provider)).lastWinner()]],
      ui: () => {
        const input = h("input", { type: "text", placeholder: "your guess 0-9" });
        return card("Buy a ticket (the honest way)", h("div", { class: "row" }, input,
          h("button", { class: "ghost", onclick: async () => send("ticket", async () => (await contract(s.contract, s.lottery)).play(BigInt(input.value || 0), { value: ethers.parseEther("1") })) }, "Play for 1 ETH")));
      },
    }),
    "06-signature-replay": (s) => ({
      info: async () => [["Airdrop DVT", await balanceOf(s.token, s.airdrop)], ["Your DVT", await balanceOf(s.token, data.player)]],
      ui: () => {
        const out = h("pre", { class: "out" }, "No voucher yet.");
        return card("Your voucher", h("button", { class: "ghost", onclick: async () => {
          try { out.textContent = JSON.stringify(await api(`/api/challenges/${current}/bot/requestVoucher`, { method: "POST" }), null, 2); } catch (e) { toast(e.message, "bad"); }
        } }, "Ask the issuer for my 10 DVT voucher"), out,
        h("p", { class: "muted" }, "Redeem it with claim(to, amount, v, r, s) on the airdrop contract (see dvd.help())."));
      },
    }),
    "07-approval-abuse": (s) => ({
      info: async () => {
        const t = await contract("DVToken", s.token, provider);
        return [["Alice's DVT", fmt(await t.balanceOf(s.alice))], ["Alice → router allowance", (await t.allowance(s.alice, s.router)) === ethers.MaxUint256 ? "UNLIMITED (MaxUint256)" : fmt(await t.allowance(s.alice, s.router))],
          ["Your DVT", fmt(await t.balanceOf(data.player))], ["Your zapped savings", fmt(await (await contract(s.contract, s.router, provider)).deposits(data.player))]];
      },
      ui: () => card("Zap into savings", h("p", { class: "muted" }, "This is the flow Alice used. Try it and look closely at what you are asked to approve."),
        h("button", { class: "ghost", onclick: () => approveAndZap(s) }, "Approve & Zap 5 DVT")),
    }),
    "08-oracle-manipulation": (s) => ({
      info: async () => {
        const pool = await contract("SimplePool", s.pool, provider);
        const desk = await contract(s.contract, s.desk, provider);
        return [["Pool spot price (dUSD per DVT)", fmt(await pool.spotPrice())], ["Pool reserves", `${fmt(await pool.reserveA())} DVT / ${fmt(await pool.reserveB())} dUSD`],
          ["Desk dUSD", await balanceOf(s.dusd, s.desk)], ["Your DVT / dUSD", `${await balanceOf(s.dvt, data.player)} / ${await balanceOf(s.dusd, data.player)}`],
          ["Your debt", fmt(await desk.debtOf(data.player))]];
      },
    }),
    "09-front-running": (s) => ({
      info: async () => [["Bounty", fmt(await provider.getBalance(s.bounty)) + " ETH"], ["winner()", await (await contract(s.contract, s.bounty, provider)).winner()]],
      ui: () => {
        const pool = h("pre", { class: "out" }, "Mempool empty.");
        const to = h("input", { type: "text", placeholder: "to (0x…)" });
        const dataIn = h("input", { type: "text", placeholder: "calldata (0x…)" });
        const tip = h("input", { type: "text", placeholder: "priority fee in gwei, e.g. 1" });
        timers.push(setInterval(async () => {
          try {
            const b = await provider.send("eth_getBlockByNumber", ["pending", true]);
            pool.textContent = b.transactions.length
              ? b.transactions.map((t) => `hash ${t.hash}\nfrom ${t.from}\nto   ${t.to}\ntip  ${ethers.formatUnits(t.maxPriorityFeePerGas || t.gasPrice, "gwei")} gwei\ndata ${t.input}`).join("\n\n")
              : "Mempool empty.";
          } catch (_) {}
        }, 1500));
        return [
          card("Solver bot", h("p", { class: "muted" }, "Wake the bot: it submits its answer, and the next block is mined 30 seconds later."),
            h("button", { class: "ghost", onclick: () => runBot("wakeSolver") }, "Wake the solver bot")),
          card("Mempool (pending block, refreshes every 1.5s)", pool),
          card("Transaction composer", h("p", { class: "muted" }, "Send raw calldata from your account with the tip you choose."),
            h("div", { class: "row" }, to, dataIn), h("div", { class: "row", style: "margin-top:8px" }, tip,
              h("button", { class: "ghost", onclick: () => send("raw tx sent", async () => {
                const tipWei = ethers.parseUnits(tip.value || "1", "gwei");
                // Explicit gasLimit: estimating against pending state can fail if someone else's tx would win first.
                const tx = await signer.sendTransaction({ to: to.value.trim(), data: dataIn.value.trim(), gasLimit: 300000, maxPriorityFeePerGas: tipWei, maxFeePerGas: tipWei + ethers.parseUnits("100", "gwei") });
                toast("Pending: " + tx.hash + " (will be mined with the next block)");
              }) }, "Send"))),
        ];
      },
    }),
    "10-backend-sig-auth": () => ({
      info: async () => [["Admin address", state("10-backend-sig-auth").admin]],
      ui: () => {
        const out = h("pre", { class: "out" }, "Not signed in.");
        let token = sessionStorage.getItem("c10token");
        return card("Account",
          h("div", { class: "row" },
            h("button", { class: "ghost", onclick: async () => {
              try {
                const message = "Sign in to Damn Vulnerable dApp";
                const signature = await signer.signMessage(message);
                const r = await api("/api/c10/login", { method: "POST", body: { address: data.player, message, signature } });
                token = r.token; sessionStorage.setItem("c10token", token);
                out.textContent = `Signed in as ${r.address}`;
              } catch (e) { out.textContent = "Login failed: " + e.message; }
            } }, "Sign in with Ethereum"),
            h("button", { class: "ghost", onclick: async () => {
              try { out.textContent = JSON.stringify(await api("/api/c10/admin", { headers: { authorization: `Bearer ${token}` } }), null, 2); checkSolution(current, true); }
              catch (e) { out.textContent = "Admin panel: " + e.message; }
            } }, "Open admin panel")), out);
      },
    }),
    "11-leaked-key": (s) => ({
      info: async () => [["Your RWD", fmt(await (await contract(s.contract, s.token, provider)).balanceOf(data.player))], ["Minter", s.minter]],
      ui: () => card("Daily reward (gasless)", h("p", { class: "muted" }, "Claim 10 RWD once every 24h. Our relayer pays the gas so you don't have to!"),
        h("button", { class: "ghost", onclick: async () => {
          const last = Number(localStorage.getItem("dvd-last-claim") || 0);
          if (Date.now() - last < 864e5) return toast("Already claimed today, come back tomorrow.", "bad"); // client-side "rate limit"
          await send("10 RWD claimed", async () => {
            const relayer = new ethers.Wallet(DVD_CONFIG.relayerPrivateKey, provider); // signed IN THE BROWSER
            const tx = await (await contract(s.contract, s.token, relayer)).mint(data.player, ethers.parseEther("10"));
            localStorage.setItem("dvd-last-claim", String(Date.now()));
            return tx;
          });
        } }, "Claim daily reward")),
    }),
    "12-untrusted-token-data": (s) => ({
      info: async () => [["Watchlist", s.watchlist]],
      ui: () => {
        const list = h("ul", { class: "watch" }, h("li", {}, "loading…"));
        const addr = h("input", { type: "text", placeholder: "token address to list" });
        const nm = h("input", { type: "text", placeholder: "name" });
        const sym = h("input", { type: "text", placeholder: "symbol" });
        const load = async () => {
          const wl = await contract("TokenWatchlist", s.watchlist, provider);
          const n = Number(await wl.count());
          const rows = [];
          for (let i = 0; i < n; i++) {
            const e = await wl.entries(i);
            try {
              const t = await contract("NamedToken", e.token, provider);
              rows.push({ name: await t.name(), symbol: await t.symbol(), address: e.token });
            } catch (_) { rows.push({ name: "(not a token)", symbol: "?", address: e.token }); }
          }
          // VULNERABLE: on-chain strings rendered with innerHTML. See app/render.js.
          list.innerHTML = rows.map(DvdRender.tokenRowVulnerable).join("");
        };
        setTimeout(load, 0);
        return [
          card("Community token watchlist", list),
          card("List a token", h("div", { class: "row" }, addr, h("button", { class: "ghost", onclick: () => send("token listed", async () => {
            const tx = await (await contract("TokenWatchlist", s.watchlist)).list(addr.value.trim()); await tx.wait(); await load(); return tx;
          }) }, "Add to watchlist"))),
          card("Deploy a NamedToken", h("div", { class: "row" }, nm, sym, h("button", { class: "ghost", onclick: async () => {
            try { const c = await dvd.deploy("NamedToken", [nm.value, sym.value || "TKN"]); addr.value = await c.getAddress(); toast("Deployed " + addr.value, "good"); }
            catch (e) { toast(e.shortMessage || e.message, "bad"); }
          } }, "Deploy"))),
        ];
      },
    }),
  };

  // The vulnerable UX for challenge 07: an unlimited approval hidden behind a friendly prompt.
  function approveAndZap(s) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
    const calldata = iface.encodeFunctionData("approve", [s.router, ethers.MaxUint256]);
    const raw = h("pre", { class: "out", style: "display:none" }, `to:   ${s.token}\ndata: ${calldata}`);
    const bg = h("div", { class: "modal-bg" }, h("div", { class: "modal" },
      h("h4", {}, "Allow ZapRouter to use your DVT?"),
      h("p", { class: "muted" }, "This lets the app zap your tokens in one click."),
      h("a", { href: "#", onclick: (e) => { e.preventDefault(); raw.style.display = "block"; } }, "View data"), raw,
      h("div", { class: "row", style: "margin-top:14px" },
        h("button", { class: "primary", onclick: async () => {
          bg.remove();
          await send("approved + zapped 5 DVT", async () => {
            await (await signer.sendTransaction({ to: s.token, data: calldata })).wait();
            return (await contract(s.contract, s.router)).depositFor(data.player, data.player, ethers.parseEther("5"));
          });
        } }, "Confirm"),
        h("button", { class: "ghost", onclick: () => bg.remove() }, "Cancel"))));
    document.body.append(bg);
  }

  function card(title, ...kids) {
    return h("div", { class: "card" }, h("h3", {}, title), ...kids);
  }

  async function runBot(action, body = {}) {
    try {
      const r = await api(`/api/challenges/${current}/bot/${action}`, { method: "POST", body });
      toast(`Bot: ${action} → ${JSON.stringify(r).slice(0, 160)}`, "good");
    } catch (e) {
      toast(`Bot: ${e.message}`, "bad");
    }
    refreshInfo();
  }

  // ---------- rendering ----------
  let refreshInfo = () => {};

  function renderScoreboard() {
    const nav = $("#scoreboard");
    nav.innerHTML = "";
    let lastLayer = null;
    data.challenges.forEach((c, i) => {
      const layer = c.layer.split(" (")[0];
      if (layer !== lastLayer) { nav.append(h("div", { class: "layer" }, layer)); lastLayer = layer; }
      nav.append(h("button", { class: `${c.solved ? "solved" : ""} ${c.id === current ? "active" : ""}`, onclick: () => open(c.id) },
        h("span", { class: "num" }, String(i + 1).padStart(2, "0")), c.title, h("span", { class: "st" }, c.solved ? "✓" : "🔒")));
    });
    const n = data.challenges.filter((c) => c.solved).length;
    $("#progress-text").textContent = `${n} / ${data.challenges.length} solved`;
    $("#progress-bar").style.width = `${(100 * n) / data.challenges.length}%`;
  }

  async function open(id) {
    timers.forEach(clearInterval); timers = [];
    current = id;
    location.hash = id;
    renderScoreboard();
    const c = data.challenges.find((x) => x.id === id);
    const w = widgets[id] ? widgets[id](c.state) : {};
    const infoDl = h("dl", { class: "addrs" });
    const hintBody = h("p", { style: "display:none" }, c.hint);
    const writeup = h("div", {});
    const root = $("#challenge");
    root.innerHTML = "";
    root.append(
      h("h2", {}, c.title),
      h("div", { class: "chips" }, h("span", { class: `chip diff-${c.difficulty}` }, c.difficulty), h("span", { class: "chip" }, c.layer), h("span", { class: "chip" }, c.swc), h("span", { class: "chip" }, c.owasp)),
      h("div", { class: "card" }, h("h3", {}, "Goal"), h("p", { class: "goal" }, c.goal)),
      h("div", { class: "card" }, h("h3", {}, "On-chain"), h("dl", { class: "addrs" }, Object.entries(c.state).map(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))])), h("hr", { style: "border:0;border-top:1px solid var(--line);margin:12px 0" }), infoDl),
      ...[].concat(w.ui ? w.ui() : []),
      h("div", { class: "card hint" }, h("h3", {}, "Hint"), h("button", { class: "ghost", onclick: (e) => { hintBody.style.display = "block"; e.target.remove(); } }, "Show hint"), hintBody),
      h("div", { class: "row" },
        h("button", { class: "primary", onclick: () => checkSolution(id) }, "Check solution"),
        h("button", { class: "ghost", onclick: async (e) => {
          e.target.disabled = true;
          try { const r = await api(`/api/challenges/${id}/reset`, { method: "POST" }); c.state = r.state; toast("Challenge redeployed", "good"); open(id); }
          catch (err) { toast(err.message, "bad"); e.target.disabled = false; }
        } }, "Reset / redeploy this challenge")),
      writeup,
    );
    refreshInfo = async () => {
      if (!w.info || current !== id) return;
      try { infoDl.replaceChildren(...(await w.info()).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))])); } catch (e) { infoDl.textContent = e.message; }
    };
    refreshInfo();
    timers.push(setInterval(refreshInfo, 4000));
    await renderWriteup(c, writeup);
  }

  async function renderWriteup(c, el) {
    el.innerHTML = "";
    if (!c.solved) {
      el.append(h("div", { class: "card locked" }, h("div", { class: "big" }, "🔒"), h("b", {}, "How a tester finds it · the fix · root cause"), h("p", {}, "Locked. Solve the challenge to unlock the write-up.")));
      return;
    }
    const md = await api(`/api/challenges/${c.id}/writeup`);
    const body = h("div", { class: "writeup" });
    body.innerHTML = renderMarkdown(md); // renderMarkdown escapes its input
    el.append(h("div", { class: "card unlocked" }, h("h3", {}, "🔓 Unlocked: write-up and fix"), body));
  }

  async function checkSolution(id, quiet = false) {
    try {
      const r = await api(`/api/challenges/${id}/check`, { method: "POST" });
      const c = data.challenges.find((x) => x.id === id);
      if (r.solved) {
        const first = !c.solved;
        c.solved = true;
        toast(first ? "🎉 Solved! Write-up unlocked." : "Still solved ✓", "good");
        if (current === id) open(id);
        else renderScoreboard();
      } else if (!quiet) toast("Not solved yet.", "bad");
      return r.solved;
    } catch (e) {
      toast(e.message, "bad");
    }
  }

  async function boot() {
    data = await api("/api/challenges");
    signer = await provider.getSigner(data.player); // mock wallet: unlocked Hardhat test account
    $("#wallet").classList.add("ok");
    $("#wallet-label").textContent = `player ${short(data.player)} · chain ${DVD_CONFIG.chainId}`;
    provider.getBalance(data.player).then((b) => ($("#wallet-label").textContent += ` · ${fmt(b)} ETH`));
    $("#reset-all").onclick = async (e) => {
      e.target.disabled = true;
      for (const c of data.challenges) await api(`/api/challenges/${c.id}/reset`, { method: "POST" });
      data = await api("/api/challenges");
      e.target.disabled = false;
      toast("All challenges redeployed", "good");
      open(current);
    };
    $("#reset-progress").onclick = async () => {
      if (!confirm("Clear all solved flags and re-lock every write-up?")) return;
      await api("/api/progress/reset", { method: "POST" });
      data = await api("/api/challenges");
      open(current);
    };
    open(location.hash.slice(1) && data.challenges.some((c) => c.id === location.hash.slice(1)) ? location.hash.slice(1) : data.challenges[0].id);
    console.log("%cDamn Vulnerable dApp — type dvd.help()", "color:#7ee0b8;font-weight:bold");
  }

  boot().catch((e) => {
    $("#challenge").textContent = "Could not reach the backend: " + e.message + ". Is `npm run dev` running?";
  });
})();
