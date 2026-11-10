// dApp runtime configuration (served to every visitor's browser).
window.DVD_CONFIG = {
  chainId: 31337,
  rpcUrl: "/rpc",
  // Relayer used for "gasless" reward claims (challenge 11) so users don't pay gas.
  // TODO(dev): move this to the backend before launch!!
  relayerPrivateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
};
