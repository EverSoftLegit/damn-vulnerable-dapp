// Loads compiled Hardhat artifacts by contract name and deploys/attaches with plain ethers v6.
// Shared by the tests and the server, so both exercise exactly the same deployment code.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..", "artifacts", "contracts");
let index = null;

function buildIndex() {
  index = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".json") && !entry.name.endsWith(".dbg.json")) {
        index[entry.name.slice(0, -5)] = p;
      }
    }
  };
  walk(ROOT);
}

function loadArtifact(name) {
  if (!index || !index[name]) buildIndex(); // rebuild so freshly compiled contracts are found
  if (!index[name]) throw new Error(`Unknown contract artifact: ${name} (did you run "npx hardhat compile"?)`);
  const { abi, bytecode } = JSON.parse(fs.readFileSync(index[name], "utf8"));
  return { abi, bytecode };
}

async function deploy(signer, name, args = [], overrides = {}) {
  const { abi, bytecode } = loadArtifact(name);
  const contract = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args, overrides);
  await contract.waitForDeployment();
  return contract;
}

function at(name, address, runner) {
  return new ethers.Contract(address, loadArtifact(name).abi, runner);
}

module.exports = { loadArtifact, deploy, at };
