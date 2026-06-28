const PROFILE_KEY = "blackbox:profile";

function readProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return {
      walletAddress: saved.walletAddress || "",
      walletPrivateKey: saved.walletPrivateKey || "",
      walletMnemonic: saved.walletMnemonic || "",
      balance: saved.balance || "0",
      fundingTxHash: saved.fundingTxHash || "",
      lastStakeMatchId: saved.lastStakeMatchId || "",
      walletCreatedAt: saved.walletCreatedAt || ""
    };
  } catch {
    return {
      walletAddress: "",
      walletPrivateKey: "",
      walletMnemonic: "",
      balance: "0",
      fundingTxHash: "",
      lastStakeMatchId: "",
      walletCreatedAt: ""
    };
  }
}

export const store = {
  packs: [],
  room: null,
  playerId: localStorage.getItem("blackbox:playerId") || "",
  profile: readProfile(),
  events: null
};

export function setPlayerId(playerId) {
  store.playerId = playerId;
  localStorage.setItem("blackbox:playerId", playerId);
}

export function saveProfile(profile) {
  store.profile = { ...store.profile, ...profile };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(store.profile));
  return store.profile;
}
