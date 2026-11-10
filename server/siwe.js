// "Sign in with Ethereum" style login for challenge 10.
// variant "Vulnerable" = the bug; variant "Secure" = the fix. Same routes, same response shapes.
const crypto = require("crypto");
const express = require("express");
const { ethers } = require("ethers");

const FLAG = "DVD{you-are-not-the-admin}";

function buildLoginMessage({ domain, address, chainId, nonce, issuedAt }) {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to Damn Vulnerable dApp.",
    "",
    `URI: http://${domain}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

function createSiweRouter({ variant, adminAddress, chainId = 31337, domain = "localhost:3000", onAdminAccess = () => {} }) {
  const router = express.Router();
  const sessions = new Map(); // token -> address
  const pending = new Map(); // nonce -> { address, message, expires }  (secure only)
  const admin = ethers.getAddress(adminAddress);

  const newSession = (address) => {
    const token = crypto.randomBytes(16).toString("hex");
    sessions.set(token, address);
    return token;
  };
  const whoAmI = (req) => sessions.get((req.headers.authorization || "").replace(/^Bearer /, ""));

  if (variant === "Vulnerable") {
    router.post("/login", (req, res) => {
      const { address, message, signature } = req.body || {};
      try {
        ethers.verifyMessage(message, signature); // only proves the signature is valid for SOME address
      } catch {
        return res.status(401).json({ error: "invalid signature" });
      }
      // BUG 1: identity is taken from the client-supplied `address`, not from the recovered signer.
      // BUG 2: no server nonce, domain, chain or expiry check, so an old signed message works forever.
      const who = ethers.getAddress(address);
      res.json({ token: newSession(who), address: who });
    });
  } else {
    // Step 1: the server issues a single-use nonce and the exact message to sign.
    router.post("/nonce", (req, res) => {
      let address;
      try {
        address = ethers.getAddress(req.body.address);
      } catch {
        return res.status(400).json({ error: "bad address" });
      }
      const nonce = crypto.randomBytes(12).toString("hex");
      const message = buildLoginMessage({ domain, address, chainId, nonce, issuedAt: new Date().toISOString() });
      pending.set(nonce, { address, message, expires: Date.now() + 5 * 60 * 1000 });
      res.json({ nonce, message });
    });
    // Step 2: verify the signature over THAT message, and derive identity from the signature.
    router.post("/login", (req, res) => {
      const { nonce, signature } = req.body || {};
      const p = pending.get(nonce);
      pending.delete(nonce); // single use, even on failure
      if (!p || p.expires < Date.now()) return res.status(401).json({ error: "unknown or expired nonce" });
      let recovered;
      try {
        recovered = ethers.verifyMessage(p.message, signature);
      } catch {
        return res.status(401).json({ error: "invalid signature" });
      }
      if (recovered !== p.address) return res.status(401).json({ error: "signature does not match address" });
      res.json({ token: newSession(recovered), address: recovered });
    });
  }

  router.get("/me", (req, res) => {
    const who = whoAmI(req);
    if (!who) return res.status(401).json({ error: "not signed in" });
    res.json({ address: who, isAdmin: who === admin });
  });

  router.get("/admin", (req, res) => {
    const who = whoAmI(req);
    if (!who) return res.status(401).json({ error: "not signed in" });
    if (who !== admin) return res.status(403).json({ error: "admins only" });
    onAdminAccess(who);
    res.json({ flag: FLAG, message: "Welcome, admin." });
  });

  return router;
}

module.exports = { createSiweRouter, buildLoginMessage, FLAG };
