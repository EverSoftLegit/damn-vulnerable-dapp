// Challenge 10 lives in the backend (server/siwe.js). There is nothing to deploy.
module.exports = {
  id: "10-backend-sig-auth",
  title: "Sign In As Anyone",
  layer: "Web / integration (backend)",
  difficulty: "Medium",
  swc: "n/a (off-chain); related: SWC-121 replay, SWC-122 lack of proper signature verification",
  owasp: "OWASP API2:2023 Broken Authentication; OWASP A07:2021 Identification & Authentication Failures",
  goal: "The dApp's backend has a 'Sign in with Ethereum' login. Only the admin (the deployer account) may read GET /api/c10/admin. Read it.",
  hint: "Sign in normally once and inspect the request in DevTools → Network. Which field does the server use to decide who you are: the signature, or something next to it?",
  async setup({ signers }) {
    return { admin: signers.deployer.address, login: "/api/c10/login", adminEndpoint: "/api/c10/admin" };
  },
  async isSolved({ serverFlags }) {
    return serverFlags.has("10-backend-sig-auth");
  },
};
