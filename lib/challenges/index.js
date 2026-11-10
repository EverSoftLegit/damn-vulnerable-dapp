// Ordered list of all challenges. Each module exports metadata plus:
//   setup(ctx) -> state, isSolved(ctx, state) -> bool, and optional bots { name(ctx, state, body) }.
// ctx = { provider, signers: {deployer, player, victim, bot, relayer, secureMinter}, variant, serverFlags }
module.exports = [
  "01-reentrancy", "02-access-control", "03-tx-origin", "04-share-inflation", "05-weak-randomness",
  "06-signature-replay", "07-approval-abuse", "08-oracle-manipulation", "09-front-running",
  "10-backend-sig-auth", "11-leaked-key", "12-untrusted-token-data",
].map((id) => require(`./${id}`));
