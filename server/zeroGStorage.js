import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dataRoot = fileURLToPath(new URL("../data/zero-g/", import.meta.url));
const realStorageEnabled = process.env.ZERO_G_STORAGE === "true";
const strictRealStorage = process.env.ZERO_G_STORAGE_STRICT === "true";
const rpcUrl = process.env.ZERO_G_RPC_URL || "https://evmrpc-testnet.0g.ai";
const indexerRpc = process.env.ZERO_G_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";
const explorerTxUrl = process.env.ZERO_G_EXPLORER_TX_URL || "https://chainscan-galileo.0g.ai/tx/{txHash}";
const uploadTimeoutMs = Number(process.env.ZERO_G_UPLOAD_TIMEOUT_MS || 45000);
let realStorageClientPromise;

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function writeRecord(kind, record) {
  const id = digest(record);
  const dir = join(dataRoot, kind);
  await ensureDir(dir);
  await writeFile(join(dir, `${id}.json`), JSON.stringify(record, null, 2), "utf8");

  if (realStorageEnabled) {
    try {
      const uploaded = await uploadRecordToZeroG({ id, kind, record });
      return uploaded;
    } catch (error) {
      if (strictRealStorage) throw error;
      return {
        id,
        uri: `0g://blackbox/${kind}/${id}`,
        provider: "local-dev-0g-adapter",
        warning: `0G upload failed, local fallback used: ${error.message}`
      };
    }
  }

  return {
    id,
    uri: `0g://blackbox/${kind}/${id}`,
    provider: "local-dev-0g-adapter"
  };
}

export async function saveStoryPack(pack) {
  return writeRecord("story-packs", {
    ...pack,
    savedAt: new Date().toISOString()
  });
}

export async function saveRoundProof(proof) {
  return writeRecord("round-proofs", {
    ...proof,
    savedAt: new Date().toISOString()
  });
}

export async function readLocalRecord(kind, id) {
  const path = join(dataRoot, kind, `${id}.json`);
  return JSON.parse(await readFile(path, "utf8"));
}

async function uploadRecordToZeroG({ id, kind, record }) {
  if (!process.env.ZERO_G_PRIVATE_KEY) {
    throw new Error("ZERO_G_PRIVATE_KEY is required when ZERO_G_STORAGE=true");
  }

  const { Indexer, MemData, ethers } = await getRealStorageClient();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(process.env.ZERO_G_PRIVATE_KEY, provider);
  const indexer = new Indexer(indexerRpc);
  const payload = JSON.stringify({ id, kind, record, savedAt: new Date().toISOString() });
  const data = new TextEncoder().encode(payload);
  const memData = new MemData(data);
  const [, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`0G Merkle tree error: ${treeErr}`);

  const [tx, uploadErr] = await withTimeout(indexer.upload(memData, rpcUrl, signer), uploadTimeoutMs, "0G upload timed out while waiting for the storage indexer/finality");
  if (uploadErr !== null) throw new Error(`0G upload error: ${uploadErr}`);

  const rootHash = tx.rootHash || tx.rootHashes?.[0];
  const txHash = tx.txHash || tx.txHashes?.[0];
  if (!rootHash) throw new Error("0G upload completed without a root hash");

  return {
    id: rootHash,
    localId: id,
    rootHash,
    txHash,
    explorerUrl: txHash ? buildExplorerUrl(txHash) : "",
    uri: `0g://storage/${rootHash}`,
    provider: "0g-storage",
    indexerRpc,
    rpcUrl
  };
}

function buildExplorerUrl(txHash) {
  if (explorerTxUrl.includes("{txHash}")) return explorerTxUrl.replace("{txHash}", txHash);
  return `${explorerTxUrl.replace(/\/$/, "")}/${txHash}`;
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${message} after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function getRealStorageClient() {
  if (!realStorageClientPromise) {
    realStorageClientPromise = Promise.all([
      import("@0gfoundation/0g-storage-ts-sdk"),
      import("ethers")
    ]).then(([storageSdk, ethersModule]) => ({
      Indexer: storageSdk.Indexer,
      MemData: storageSdk.MemData,
      ethers: ethersModule.ethers
    }));
  }
  return realStorageClientPromise;
}
