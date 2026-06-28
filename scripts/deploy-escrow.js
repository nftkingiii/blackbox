import "../server/env.js";
import { readFile } from "node:fs/promises";
import solc from "solc";
import { ethers } from "ethers";

const source = await readFile(new URL("../contracts/BlackBoxEscrow.sol", import.meta.url), "utf8");
const input = {
  language: "Solidity",
  sources: { "BlackBoxEscrow.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));

const artifact = output.contracts["BlackBoxEscrow.sol"].BlackBoxEscrow;
const rpcUrl = process.env.ZERO_G_RPC_URL || "https://evmrpc-testnet.0g.ai";
const privateKey = process.env.BLACKBOX_OPERATOR_PRIVATE_KEY || process.env.ZERO_G_TREASURY_PRIVATE_KEY;
if (!privateKey) throw new Error("BLACKBOX_OPERATOR_PRIVATE_KEY is required.");
const provider = new ethers.JsonRpcProvider(
  rpcUrl,
  { chainId: 16602, name: "0g-galileo" },
  { staticNetwork: true }
);
const wallet = new ethers.Wallet(privateKey, provider);
const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);
const contract = await factory.deploy(wallet.address);
await contract.waitForDeployment();
console.log(`BLACKBOX_ESCROW_ADDRESS=${await contract.getAddress()}`);
