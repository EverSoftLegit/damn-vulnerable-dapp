// Fixed roles for Hardhat's default test accounts (public, well-known keys — TEST ONLY).
// index -> role
module.exports = {
  DEPLOYER: 0, // deploys everything; also the voucher issuer (06) and admin (10)
  PLAYER: 1, // you
  VICTIM: 2, // "Alice", a simulated user the bots act for
  BOT: 3, // simulated solver bot (09)
  RELAYER: 5, // challenge 11 relayer — its key is (deliberately) shipped in app/config.js
  SECURE_MINTER: 6, // challenge 11 secure minter — key stays server-side only
};
