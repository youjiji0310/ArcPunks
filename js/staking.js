const NFT_CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const PUNK_TOKEN_ADDRESS = "0x3980594AF0E0A27436B3bAB04235E65131b26d94";
const STAKING_CONTRACT_ADDRESS = "0x86e233f0c3786C2612759b7d51a72c206FF4cb4C";
const RPC_URL = "https://rpc.arc-scan.org";

const NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
];

const PUNK_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

const STAKING_ABI = [
  "function stake(uint256 tokenId) external",
  "function unstake(uint256 tokenId) external",
  "function claim(uint256 tokenId) external",
  "function pendingReward(uint256 tokenId) view returns (uint256)",
  "function stakedSince(uint256 tokenId) view returns (uint256)",
  "function canUnstake(uint256 tokenId) view returns (bool)",
  "function dailyRatePerNFT() view returns (uint256)",
  "event Staked(address indexed user, uint256 tokenId)",
  "event Unstaked(address indexed user, uint256 tokenId)"
];

let provider, signer, userAddress;
let nftContract, punkContract, stakingContract;
let stakedTokenIds = [];
let walletTokenIds = [];
let liveRewards = {};
let dailyRate = 0.25;

function shorten(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function initStaking() {
  if (!walletState.connected || !walletState.provider) return;

  provider = new ethers.BrowserProvider(walletState.provider);
  signer = await provider.getSigner();
  userAddress = walletState.address;

  nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
  punkContract = new ethers.Contract(PUNK_TOKEN_ADDRESS, PUNK_ABI, signer);
  stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_ABI, signer);

  document.getElementById("stakingConnectPrompt").style.display = "none";

  try {
    const rate = await stakingContract.dailyRatePerNFT();
    dailyRate = Number(ethers.formatEther(rate));
    document.getElementById("statRate").textContent = dailyRate;
  } catch (err) {
    console.warn("Could not read rate:", err.message);
  }

  await refreshBalance();
  await checkApproval();
}

async function refreshBalance() {
  try {
    const bal = await punkContract.balanceOf(userAddress);
    document.getElementById("statBalance").textContent = Number(ethers.formatEther(bal)).toFixed(4);
  } catch (err) {
    console.warn("Balance read error:", err.message);
  }
}

async function checkApproval() {
  try {
    const approved = await nftContract.isApprovedForAll(userAddress, STAKING_CONTRACT_ADDRESS);
    if (approved) {
      document.getElementById("stakingApprovalPrompt").style.display = "none";
      document.getElementById("stakingContent").style.display = "block";
      await loadEverything();
    } else {
      document.getElementById("stakingApprovalPrompt").style.display = "block";
    }
  } catch (err) {
    console.error("Approval check error:", err);
  }
}

async function loadEverything() {
  await Promise.all([loadStakedTokens(), loadWalletTokens()]);
  renderStakedGrid();
  renderWalletGrid();
}

async function loadStakedTokens() {
  try {
    const stakedFilter = stakingContract.filters.Staked(userAddress);
    const unstakedFilter = stakingContract.filters.Unstaked(userAddress);

    const [stakedEvents, unstakedEvents] = await Promise.all([
      stakingContract.queryFilter(stakedFilter, 0, "latest"),
      stakingContract.queryFilter(unstakedFilter, 0, "latest")
    ]);

    const stakedIds = new Set(stakedEvents.map(e => e.args.tokenId.toString()));
    unstakedEvents.forEach(e => stakedIds.delete(e.args.tokenId.toString()));

    stakedTokenIds = Array.from(stakedIds);
  } catch (err) {
    console.error("Error loading staked tokens:", err);
    stakedTokenIds = [];
  }
}

async function loadWalletTokens() {
  walletTokenIds = [];
  try {
    const balance = await nftContract.balanceOf(userAddress);
    const count = Number(balance);
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await nftContract.tokenOfOwnerByIndex(userAddress, i);
        walletTokenIds.push(tokenId.toString());
      } catch (err) {
        break;
      }
    }
  } catch (err) {
    console.warn("Enumeration not available, use manual stake input.");
  }
}

function renderStakedGrid() {
  const grid = document.getElementById("stakedGrid");
  const emptyMsg = document.getElementById("stakedEmptyMsg");
  const countLabel = document.getElementById("stakedCountLabel");

  countLabel.textContent = `(${stakedTokenIds.length})`;
  document.getElementById("statStakedCount").textContent = stakedTokenIds.length;
  grid.innerHTML = "";

  if (stakedTokenIds.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  stakedTokenIds.forEach((tokenId) => {
    const card = document.createElement("div");
    card.className = "staking-card staked";
    card.innerHTML = `
      <div class="staking-card-header">
        <span class="staking-card-id">ArcPunk #${tokenId}</span>
        <span class="staking-gear spin">?</span>
      </div>
      <div class="staking-reward-display">
        <span class="staking-reward-value" id="reward-${tokenId}">0.0000</span>
        <span class="staking-reward-unit">$PUNK earned</span>
      </div>
      <div class="staking-card-actions">
        <button class="btn btn-outline staking-btn-sm" data-claim="${tokenId}">Claim</button>
        <button class="btn btn-primary staking-btn-sm" data-unstake="${tokenId}">Unstake</button>
      </div>
      <p class="staking-lock-status" id="lock-${tokenId}"></p>
    `;
    grid.appendChild(card);
  });

  attachStakedListeners();
  updateLockStatuses();
}

function renderWalletGrid() {
  document.getElementById("statWalletCount").textContent = walletTokenIds.length;
  const grid = document.getElementById("walletGrid");
  const emptyMsg = document.getElementById("walletEmptyMsg");
  grid.innerHTML = "";

  if (walletTokenIds.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  walletTokenIds.forEach((tokenId) => {
    const card = document.createElement("div");
    card.className = "staking-card";
    card.innerHTML = `
      <div class="staking-card-header">
        <span class="staking-card-id">ArcPunk #${tokenId}</span>
      </div>
      <button class="btn btn-primary staking-btn-sm staking-stake-btn" data-stake="${tokenId}">Stake</button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-stake]").forEach((btn) => {
    btn.addEventListener("click", () => doStake(btn.dataset.stake, btn));
  });
}

function attachStakedListeners() {
  document.querySelectorAll("[data-claim]").forEach((btn) => {
    btn.addEventListener("click", () => doClaim(btn.dataset.claim, btn));
  });
  document.querySelectorAll("[data-unstake]").forEach((btn) => {
    btn.addEventListener("click", () => doUnstake(btn.dataset.unstake, btn));
  });
}

async function doStake(tokenId, btn) {
  try {
    btn.disabled = true;
    btn.textContent = "Staking...";
    const tx = await stakingContract.stake(tokenId);
    await tx.wait();
    await loadEverything();
    await refreshBalance();
  } catch (err) {
    console.error(err);
    alert("Stake failed: " + (err.reason || err.message));
    btn.disabled = false;
    btn.textContent = "Stake";
  }
}

async function doClaim(tokenId, btn) {
  try {
    btn.disabled = true;
    btn.textContent = "Claiming...";
    const tx = await stakingContract.claim(tokenId);
    await tx.wait();
    await refreshBalance();
    btn.disabled = false;
    btn.textContent = "Claim";
  } catch (err) {
    console.error(err);
    alert("Claim failed: " + (err.reason || err.message));
    btn.disabled = false;
    btn.textContent = "Claim";
  }
}

async function doUnstake(tokenId, btn) {
  try {
    btn.disabled = true;
    btn.textContent = "Unstaking...";
    const tx = await stakingContract.unstake(tokenId);
    await tx.wait();
    await loadEverything();
    await refreshBalance();
  } catch (err) {
    console.error(err);
    alert("Unstake failed (still locked?): " + (err.reason || err.message));
    btn.disabled = false;
    btn.textContent = "Unstake";
  }
}

async function updateLockStatuses() {
  for (const tokenId of stakedTokenIds) {
    try {
      const can = await stakingContract.canUnstake(tokenId);
      const el = document.getElementById(`lock-${tokenId}`);
      if (el) {
        el.textContent = can ? "? Unlocked" : "?? Locked (7-day minimum)";
        el.className = "staking-lock-status " + (can ? "unlocked" : "locked");
      }
    } catch (err) {}
  }
}

function tickLiveRewards() {
  stakedTokenIds.forEach((tokenId) => {
    if (!(tokenId in liveRewards)) liveRewards[tokenId] = 0;
    liveRewards[tokenId] += dailyRate / (24 * 60 * 60);
    const el = document.getElementById(`reward-${tokenId}`);
    if (el) el.textContent = liveRewards[tokenId].toFixed(6);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("stakingConnectBtn");
  const approveBtn = document.getElementById("approveBtn");
  const manualBtn = document.getElementById("manualStakeBtn");

  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      const navBtn = document.getElementById("navWalletBtn");
      if (navBtn) navBtn.click();
      setTimeout(initStaking, 1500);
    });
  }

  if (approveBtn) {
    approveBtn.addEventListener("click", async () => {
      try {
        approveBtn.disabled = true;
        approveBtn.textContent = "Approving...";
        const tx = await nftContract.setApprovalForAll(STAKING_CONTRACT_ADDRESS, true);
        await tx.wait();
        document.getElementById("stakingApprovalPrompt").style.display = "none";
        document.getElementById("stakingContent").style.display = "block";
        await loadEverything();
      } catch (err) {
        console.error(err);
        alert("Approval failed: " + (err.reason || err.message));
        approveBtn.disabled = false;
        approveBtn.textContent = "Approve Vault";
      }
    });
  }

  if (manualBtn) {
    manualBtn.addEventListener("click", () => {
      const tokenId = document.getElementById("manualTokenId").value.trim();
      if (!tokenId) return;
      doStake(tokenId, manualBtn);
    });
  }

  setTimeout(() => {
    if (walletState.connected) initStaking();
  }, 800);

  const navWalletBtn = document.getElementById("navWalletBtn");
  if (navWalletBtn) {
    navWalletBtn.addEventListener("click", () => {
      setTimeout(initStaking, 1500);
    });
  }

  setInterval(tickLiveRewards, 1000);
  setInterval(() => {
    if (stakingContract) updateLockStatuses();
  }, 30000);
});