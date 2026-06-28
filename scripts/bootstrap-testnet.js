import "../server/env.js";
import { readFile, writeFile } from "node:fs/promises";
import solc from "solc";
import { ethers } from "ethers";

const rpcUrl = process.env.ZERO_G_RPC_URL || "https://evmrpc-testnet.0g.ai";
const sourceKey = process.env.ZERO_G_PRIVATE_KEY;
if (!sourceKey) throw new Error("ZERO_G_PRIVATE_KEY is required to bootstrap service wallets.");

const provider = new ethers.JsonRpcProvider(
  rpcUrl,
  { chainId: 16602, name: "0g-galileo" },
  { staticNetwork: true }
);
const source = new ethers.Wallet(sourceKey, provider);
const operator = process.env.BLACKBOX_OPERATOR_PRIVATE_KEY
  ? new ethers.Wallet(process.env.BLACKBOX_OPERATOR_PRIVATE_KEY, provider)
  : ethers.Wallet.createRandom().connect(provider);
const treasury = process.env.ZERO_G_TREASURY_PRIVATE_KEY
  ? new ethers.Wallet(process.env.ZERO_G_TREASURY_PRIVATE_KEY, provider)
  : ethers.Wallet.createRandom().connect(provider);

const envUrl = new URL("../.env", import.meta.url);
let envText = await readFile(envUrl, "utf8");
envText = setEnv(envText, "BLACKBOX_OPERATOR_PRIVATE_KEY", operator.privateKey);
envText = setEnv(envText, "ZERO_G_TREASURY_PRIVATE_KEY", treasury.privateKey);
await writeFile(envUrl, envText, "utf8");

const operatorTarget = ethers.parseEther(process.env.BLACKBOX_OPERATOR_BOOTSTRAP_AMOUNT || "0.2");
const treasuryTarget = ethers.parseEther(process.env.ZERO_G_TREASURY_BOOTSTRAP_AMOUNT || "0.5");
await topUp(source, operator.address, operatorTarget);
await topUp(source, treasury.address, treasuryTarget);

let escrowAddress = process.env.BLACKBOX_ESCROW_ADDRESS || "";
if (!escrowAddress) {
  const sourceCode = await readFile(new URL("../contracts/BlackBoxEscrow.sol", import.meta.url), "utf8");
  const input = {
    language: "Solidity",
    sources: { "BlackBoxEscrow.sol": { content: sourceCode } },
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
  const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, operator);
  const contract = await factory.deploy(operator.address);
  escrowAddress = await contract.getAddress();
  await waitForReceipt(contract.deploymentTransaction().hash);
  console.log(`Escrow deployed: ${escrowAddress}`);
}

envText = setEnv(envText, "BLACKBOX_ESCROW_ADDRESS", escrowAddress);
await writeFile(envUrl, envText, "utf8");

console.log(`Operator wallet: ${operator.address}`);
console.log(`Welcome treasury: ${treasury.address}`);
console.log("Local .env updated. Add the same three values to Railway.");

async function topUp(sender, address, target) {
  const current = await provider.getBalance(address);
  if (current >= target) return;
  const tx = await sender.sendTransaction({ to: address, value: target - current });
  await waitForReceipt(tx.hash);
  console.log(`Funded ${address}: ${tx.hash}`);
}

async function waitForReceipt(txHash, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status !== 1) throw new Error(`Transaction reverted: ${txHash}`);
        return receipt;
      }
    } catch (error) {
      if (!String(error.message).includes("no matching receipts found")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for transaction: ${txHash}`);
}

function setEnv(text, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.trimEnd()}\n${line}\n`;
}