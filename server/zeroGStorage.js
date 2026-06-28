import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dataRoot = fileURLToPath(new URL("../data/zero-g/", import.meta.url));
const realStorageEnabled = process.env.ZERO_G_STORAGE === "true";
const strictRealStorage = process.env.ZERO_G_STORAGE_STRICT === "true";
const requireRealStorage = process.env.ZERO_G_STORAGE_REQUIRED === "true";
const rpcUrl = process.env.ZERO_G_RPC_URL || "https://evmrpc-testnet.0g.ai";
const indexerRpc = process.env.ZERO_G_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";
const explorerTxUrl = process.env.ZERO_G_EXPLORER_TX_URL || "https://chainscan-galileo.0g.ai/tx/{txHash}";
const storageExplorerUrl = process.env.ZERO_G_STORAGE_EXPLORER_URL || "https://storagescan-galileo.0g.ai";
const uploadTimeoutMs = Number(process.env.ZERO_G_UPLOAD_TIMEOUT_MS || 45000);
const answerPepper = process.env.BLACKBOX_ANSWER_PEPPER || "";
let realStorageClientPromise;
let manifestStatus = { state: "pending", proof: null, error: "" };

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function writeRecord(kind, record) {
  const id = digest(record);
  if (!requireRealStorage) {
    const dir = join(dataRoot, kind);
    await ensureDir(dir);
    await writeFile(join(dir, `${id}.json`), JSON.stringify(record, null, 2), "utf8");
  }

  if (realStorageEnabled) {
    try {
      const uploaded = await uploadRecordToZeroG({ id, kind, record });
      return uploaded;
    } catch (error) {
      if (strictRealStorage || requireRealStorage) throw error;
      return {
        id,
        uri: `0g://blackbox/${kind}/${id}`,
        provider: "local-dev-0g-adapter",
        warning: `0G upload failed, local fallback used: ${error.message}`
      };
    }
  }

  if (requireRealStorage) throw new Error("0G Storage is required but ZERO_G_STORAGE is not enabled.");
  return {
    id,
    uri: `0g://blackbox/${kind}/${id}`,
    provider: "local-dev-0g-adapter"
  };
}

export async function initializeStoryManifest(packs) {
  manifestStatus = { state: "uploading", proof: null, error: "" };
  try {
    if (requireRealStorage && !answerPepper) {
      throw new Error("BLACKBOX_ANSWER_PEPPER is required when strict 0G storage is enabled.");
    }
    const proof = await saveStoryPack({
      version: process.env.BLACKBOX_STORY_VERSION || "v2",
      packs: packs.map(storageSafePack),
      assets: await readClientAssets()
    });
    manifestStatus = { state: proof.provider === "0g-storage" ? "ready" : "local", proof, error: "" };
    if (requireRealStorage && proof.provider !== "0g-storage") throw new Error("Story manifest was not persisted to 0G Storage.");
    return proof;
  } catch (error) {
    manifestStatus = { state: "failed", proof: null, error: error.message };
    if (requireRealStorage) throw error;
    return null;
  }
}

function storageSafePack(pack) {
  const { answer, ...publicPack } = pack;
  return {
    ...publicPack,
    answerCommitment: createHash("sha256")
      .update(`${pack.id}:${normalizeAnswer(answer)}:${answerPepper || "local-dev"}`)
      .digest("hex")
  };
}

function normalizeAnswer(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function readClientAssets() {
  const files = [
    "index.html",
    "src/App.jsx",
    "src/styles.css",
    "src/audio.js",
    "src/socket.js",
    "src/store.js",
    "assets/favicon.svg",
    "assets/blackbox-cube.svg",
    "vendor/ethers.umd.min.js"
  ];
  return Promise.all(files.map(async (name) => {
    const path = fileURLToPath(new URL(`../client/${name}`, import.meta.url));
    const content = await readFile(path, "utf8");
    return { name, sha256: digest(content), content };
  }));
}

export function getStorageStatus() {
  return {
    enabled: realStorageEnabled,
    required: requireRealStorage,
    strict: strictRealStorage || requireRealStorage,
    manifest: manifestStatus
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
    storageExplorerUrl,
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
