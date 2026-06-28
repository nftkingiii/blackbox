import { ethers } from "ethers";

export const CHAIN_ID = 16602;
export const RPC_URL = process.env.ZERO_G_RPC_URL || "https://evmrpc-testnet.0g.ai";
export const EXPLORER_URL = process.env.ZERO_G_EXPLORER_URL || "https://chainscan-galileo.0g.ai";
export const FAUCET_URL = process.env.ZERO_G_FAUCET_URL || "https://faucet.0g.ai";
export const ESCROW_ADDRESS = process.env.BLACKBOX_ESCROW_ADDRESS || "";
const TREASURY_KEY = process.env.ZERO_G_TREASURY_PRIVATE_KEY || "";
const OPERATOR_KEY = process.env.BLACKBOX_OPERATOR_PRIVATE_KEY || TREASURY_KEY;
const WELCOME_AMOUNT = process.env.ZERO_G_WELCOME_AMOUNT || "0.005";
const provider = new ethers.JsonRpcProvider(
  RPC_URL,
  { chainId: CHAIN_ID, name: "0g-galileo" },
  { staticNetwork: true }
);
const fundedWallets = new Set();
const fundedSources = new Set();

export const ESCROW_ABI = [
  "function joinMatch(bytes32 matchId,uint256 stake,bytes authorization) payable",
  "function lock(bytes32 matchId)",
  "function deposits(bytes32 matchId,address player) view returns (uint256)",
  "function matchStake(bytes32 matchId) view returns (uint256)",
  "function settle(bytes32 matchId,address[] recipients,uint256[] amounts,bytes32 resultRoot)",
  "function cancel(bytes32 matchId)",
  "function claim(bytes32 matchId)",
  "function claimRefund(bytes32 matchId)",
  "function claimable(bytes32 matchId,address player) view returns (uint256)",
  "event MatchJoined(bytes32 indexed matchId,address indexed player,uint256 stake)",
  "event MatchSettled(bytes32 indexed matchId,bytes32 resultRoot)"
];

export function getChainConfig() {
  return {
    chainId: CHAIN_ID,
    chainName: "0G Galileo Testnet",
    tokenSymbol: "0G",
    rpcUrl: RPC_URL,
    explorerUrl: EXPLORER_URL,
    faucetUrl: FAUCET_URL,
    escrowAddress: ESCROW_ADDRESS,
    stakingEnabled: Boolean(ESCROW_ADDRESS && OPERATOR_KEY),
    sponsoredFundingEnabled: Boolean(TREASURY_KEY),
    welcomeAmount: WELCOME_AMOUNT
  };
}

export async function getWalletBalance(address) {
  assertAddress(address);
  const balance = await provider.getBalance(address);
  return {
    address,
    balanceWei: balance.toString(),
    balance: ethers.formatEther(balance),
    symbol: "0G",
    explorerUrl: `${EXPLORER_URL}/address/${address}`
  };
}

export async function sponsorWallet(address, source = "") {
  assertAddress(address);
  if (!TREASURY_KEY) throw httpError("Sponsored welcome funding is not configured.", 503);
  const normalized = ethers.getAddress(address);
  if (fundedWallets.has(normalized)) throw httpError("This wallet already received welcome funding.", 409);
  if (source && fundedSources.has(source)) throw httpError("Welcome funding was already requested from this connection.", 429);

  const treasury = new ethers.Wallet(TREASURY_KEY, provider);
  const tx = await treasury.sendTransaction({
    to: normalized,
    value: ethers.parseEther(WELCOME_AMOUNT)
  });
  const receipt = await waitForReceipt(tx.hash);
  fundedWallets.add(normalized);
  if (source) fundedSources.add(source);
  return {
    amount: WELCOME_AMOUNT,
    symbol: "0G",
    txHash: tx.hash,
    explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}`,
    blockNumber: receipt.blockNumber
  };
}

export function matchIdForCode(code) {
  return ethers.id(`blackbox:${String(code || "").toUpperCase()}`);
}

export async function verifyStake({ room, player, txHash }) {
  if (!ESCROW_ADDRESS) throw httpError("Multiplayer staking is not configured.", 503);
  if (!txHash || !/^0x[0-9a-f]{64}$/i.test(txHash)) throw httpError("A valid stake transaction hash is required.", 400);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) throw httpError("Stake transaction is not confirmed.", 409);
  if (receipt.to?.toLowerCase() !== ESCROW_ADDRESS.toLowerCase()) throw httpError("Stake was sent to the wrong contract.", 400);

  const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
  const deposited = await contract.deposits(room.stake.matchId, player.walletAddress);
  const required = BigInt(room.stake.amountWei);
  if (deposited < required) throw httpError("Confirmed escrow deposit is below the room stake.", 409);
  return {
    confirmed: true,
    txHash,
    amountWei: deposited.toString(),
    explorerUrl: `${EXPLORER_URL}/tx/${txHash}`
  };
}

export async function authorizeStake({ room, player }) {
  if (!room?.stake?.enabled || !ESCROW_ADDRESS || !OPERATOR_KEY) {
    throw httpError("Multiplayer staking is not configured.", 503);
  }
  if (!player?.walletAddress) throw httpError("Player wallet is missing.", 400);
  const operator = new ethers.Wallet(OPERATOR_KEY);
  const authorizationHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256", "address", "uint256"],
    [room.stake.matchId, player.walletAddress, BigInt(room.stake.amountWei), ESCROW_ADDRESS, CHAIN_ID]
  ));
  return {
    signature: await operator.signMessage(ethers.getBytes(authorizationHash)),
    matchId: room.stake.matchId,
    amountWei: room.stake.amountWei
  };
}

export async function lockRoomStake(room) {
  if (!room?.stake?.enabled) return null;
  if (!ESCROW_ADDRESS || !OPERATOR_KEY) throw httpError("Multiplayer staking is not configured.", 503);
  const operator = new ethers.Wallet(OPERATOR_KEY, provider);
  const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, operator);
  const tx = await contract.lock(room.stake.matchId);
  await waitForReceipt(tx.hash);
  return { txHash: tx.hash, explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}` };
}

export async function settleRoomStake(room, resultRoot = ethers.ZeroHash) {
  if (!room?.stake?.enabled || room.stake.settlement?.txHash) return room?.stake?.settlement || null;
  if (!ESCROW_ADDRESS || !OPERATOR_KEY) throw new Error("Escrow settlement is not configured.");

  const eligible = room.players.filter((player) => !player.bot && player.connected !== false && player.stakeConfirmed && player.walletAddress);
  if (!eligible.length) {
    const cancellation = await cancelRoomStake(room);
    return { cancelled: true, ...cancellation, recipients: [] };
  }
  const ranked = [...eligible].sort((a, b) => b.score - a.score);
  const shares = distributionFor(ranked.length);
  const fundedPlayers = room.players.filter((player) => !player.bot && player.stakeConfirmed && player.walletAddress);
  const pool = BigInt(room.stake.amountWei) * BigInt(fundedPlayers.length);
  const recipients = ranked.slice(0, shares.length).map((player) => player.walletAddress);
  const amounts = shares.map((share, index) => (
    index === shares.length - 1
      ? pool - shares.slice(0, -1).reduce((sum, item) => sum + (pool * BigInt(item)) / 100n, 0n)
      : (pool * BigInt(share)) / 100n
  ));

  const operator = new ethers.Wallet(OPERATOR_KEY, provider);
  const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, operator);
  const tx = await contract.settle(room.stake.matchId, recipients, amounts, normalizeRoot(resultRoot));
  await waitForReceipt(tx.hash);
  return {
    txHash: tx.hash,
    explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}`,
    recipients: recipients.map((address, index) => ({
      address,
      amountWei: amounts[index].toString(),
      amount: ethers.formatEther(amounts[index])
    }))
  };
}

export async function cancelRoomStake(room) {
  if (!room?.stake?.enabled || !ESCROW_ADDRESS || !OPERATOR_KEY) return null;
  const operator = new ethers.Wallet(OPERATOR_KEY, provider);
  const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, operator);
  const tx = await contract.cancel(room.stake.matchId);
  await waitForReceipt(tx.hash);
  return { txHash: tx.hash, explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}` };
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

function distributionFor(playerCount) {
  if (playerCount <= 1) return [100];
  if (playerCount === 2) return [100];
  if (playerCount <= 7) return [60, 25, 15];
  return [45, 25, 15, 10, 5];
}

function normalizeRoot(value) {
  return /^0x[0-9a-f]{64}$/i.test(value || "") ? value : ethers.ZeroHash;
}

function assertAddress(address) {
  if (!ethers.isAddress(address || "")) throw httpError("Invalid wallet address.", 400);
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
