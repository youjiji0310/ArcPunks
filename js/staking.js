const NFT_CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const PUNK_TOKEN_ADDRESS = "0xfbc2c897049E0316d93C7e5dda7951B3F239D5BF";
const STAKING_CONTRACT_ADDRESS = "0xc533042F1E29f084231B0b5BFFBf9553ae05acD9";

const NFT_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];
const PUNK_ABI = ["function balanceOf(address account) view returns (uint256)"];
const STAKING_ABI = [
  "function stake(uint256 tokenId) external",
  "function unstake(uint256 tokenId) external",
  "function claim(uint256 tokenId) external",
  "function pendingReward(uint256 tokenId) view returns (uint256)",
  "function canUnstake(uint256 tokenId) view returns (bool)",
  "function isCurrentlyStaked(uint256 tokenId) view returns (bool)",
  "function dailyRatePerNFT() view returns (uint256)"
];

let provider, signer, userAddress;
let nftContract, punkContract, stakingContract;
let trackedTokenIds = [];
let liveRewards = {};
let dailyRate = 0.25;

function storageKey() {
  return "arcpunks_staked_" + userAddress.toLowerCase();
}

function loadTrackedIds() {
  try {
    const raw = localStorage.getItem(storageKey());
    trackedTokenIds = raw ? JSON.parse(raw) : [];
  } catch {
    trackedTokenIds = [];
  }
}

function saveTrackedIds() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(trackedTokenIds));
  } catch {}
}

function addTrackedId(tokenId) {
  const id = tokenId.toString();
  if (!trackedTokenIds.includes(id)) {
    trackedTokenIds.push(id);
    saveTrackedIds();
  }
}

function removeTrackedId(tokenId) {
  const id = tokenId.toString();
  trackedTokenIds = trackedTokenIds.filter((t) => t !== id);
  saveTrackedIds();
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
  document.getElementById("stakingContent").style.display = "block";

  try {
    const rate = await stakingContract.dailyRatePerNFT();
    dailyRate = Number(ethers.formatEther(rate));
    const rateEl = document.getElementById("statRate");
    if (rateEl) rateEl.textContent = dailyRate;
  } catch (err) {}

  loadTrackedIds();
  await refreshBalance();
  await refreshDashboard();
}

async function refreshBalance() {
  try {
    const bal = await punkContract.balanceOf(userAddress);
    document.getElementById("statBalance").textContent = Number(ethers.formatEther(bal)).toFixed(4);
  } catch (err) {}
}

async function refreshDashboard() {
  const grid = document.getElementById("stakedGrid");
  const emptyMsg = document.getElementById("stakedEmptyMsg");
  const countLabel = document.getElementById("stakedCountLabel");
  const statStakedCount = document.getElementById("statStakedCount");

  const stillValid = [];

  for (const tokenId of trackedTokenIds) {
    try {
      const staked = await stakingContract.isCurrentlyStaked(tokenId);
      if (staked) stillValid.push(tokenId);
      else removeTrackedId(tokenId);
    } catch (err) {}
  }
  trackedTokenIds = stillValid;

  countLabel.textContent = "(" + trackedTokenIds.length + ")";
  if (statStakedCount) statStakedCount.textContent = trackedTokenIds.length;
  grid.innerHTML = "";

  if (trackedTokenIds.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  for (const tokenId of trackedTokenIds) {
    const card = document.createElement("div");
    card.className = "staking-card staked";
    card.innerHTML =
      "<div class=\"staking-card-header\"><span class=\"staking-card-id\">ArcPunk #" + tokenId + "</span></div>" +
      "<div class=\"staking-reward-display\"><span class=\"staking-reward-value\" id=\"reward-" + tokenId + "\">0.0000</span><span class=\"staking-reward-unit\">$PUNK earned</span></div>" +
      "<div class=\"staking-card-actions\"><button class=\"btn btn-outline staking-btn-sm\" data-claim=\"" + tokenId + "\">Claim</button><button class=\"btn btn-primary staking-btn-sm\" data-unstake=\"" + tokenId + "\">Unstake</button></div>" +
      "<p class=\"staking-lock-status\" id=\"lock-" + tokenId + "\"></p>";
    grid.appendChild(card);

    try {
      const reward = await stakingContract.pendingReward(tokenId);
      liveRewards[tokenId] = Number(ethers.formatEther(reward));
    } catch {
      liveRewards[tokenId] = 0;
    }

    try {
      const can = await stakingContract.canUnstake(tokenId);
      const el = document.getElementById("lock-" + tokenId);
      if (el) {
        el.textContent = can ? "Unlocked" : "Locked (7-day minimum)";
        el.className = "staking-lock-status " + (can ? "unlocked" : "locked");
      }
    } catch {}
  }

  attachStakedListeners();
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

    const alreadyStaked = await stakingContract.isCurrentlyStaked(tokenId);
    if (alreadyStaked) {
      addTrackedId(tokenId);
      await refreshDashboard();
      btn.disabled = false;
      btn.textContent = "Stake";
      alert("This punk is already staked!");
      return;
    }

    const tx = await stakingContract.stake(tokenId, { gasLimit: 300000 });
    await tx.wait();

    addTrackedId(tokenId);
    await refreshDashboard();
    await refreshBalance();

    btn.disabled = false;
    btn.textContent = "Stake";
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
    const tx = await stakingContract.claim(tokenId, { gasLimit: 300000 });
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
    const tx = await stakingContract.unstake(tokenId, { gasLimit: 300000 });
    await tx.wait();
    removeTrackedId(tokenId);
    await refreshDashboard();
    await refreshBalance();
  } catch (err) {
    console.error(err);
    alert("Unstake failed (still locked?): " + (err.reason || err.message));
    btn.disabled = false;
    btn.textContent = "Unstake";
  }
}

function tickLiveRewards() {
  trackedTokenIds.forEach((tokenId) => {
    if (!(tokenId in liveRewards)) liveRewards[tokenId] = 0;
    liveRewards[tokenId] += dailyRate / (24 * 60 * 60);
    const el = document.getElementById("reward-" + tokenId);
    if (el) el.textContent = liveRewards[tokenId].toFixed(6);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("stakingConnectBtn");
  const manualBtn = document.getElementById("manualStakeBtn");

  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      const navBtn = document.getElementById("navWalletBtn");
      if (navBtn) navBtn.click();
      setTimeout(initStaking, 1500);
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
    if (stakingContract) refreshDashboard();
  }, 30000);
});