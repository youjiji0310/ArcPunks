const NFT_CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const PUNK_TOKEN_ADDRESS = "0xfbc2c897049E0316d93C7e5dda7951B3F239D5BF";
const STAKING_CONTRACT_ADDRESS = "0xc533042F1E29f084231B0b5BFFBf9553ae05acD9";
const READ_RPC_URL = "https://rpc.arc-scan.org";
const MAX_SUPPLY = 10000;
const SCAN_BATCH = 25;
const SCAN_DELAY = 130;

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
let walletTokenIds = [];
let stakedTokenIds = [];
let selectedIds = new Set();
let liveRewards = {};
let dailyRate = 0.25;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function stakedKey() { return "arcpunks_staked_" + userAddress.toLowerCase(); }
function walletKey() { return "arcpunks_wallet_" + userAddress.toLowerCase(); }

function loadStakedIds() {
  try { stakedTokenIds = [...new Set(JSON.parse(localStorage.getItem(stakedKey()) || "[]"))]; }
  catch { stakedTokenIds = []; }
}
function saveStakedIds() { localStorage.setItem(stakedKey(), JSON.stringify(stakedTokenIds)); }

function loadWalletIds() {
  try { walletTokenIds = [...new Set(JSON.parse(localStorage.getItem(walletKey()) || "[]"))]; }
  catch { walletTokenIds = []; }
}
function saveWalletIds() { localStorage.setItem(walletKey(), JSON.stringify(walletTokenIds)); }

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
  } catch {}

  loadStakedIds();
  loadWalletIds();
  await refreshBalance();
  await refreshStakedGrid();
  renderWalletGrid();
  updatePointsPerDay();
  scanWalletInBackground();
}

async function refreshBalance() {
  try {
    const bal = await punkContract.balanceOf(userAddress);
    document.getElementById("statBalance").textContent = Number(ethers.formatEther(bal)).toFixed(4);
  } catch {}
}

function updatePointsPerDay() {
  const el = document.getElementById("statPointsPerDay");
  if (el) el.textContent = (stakedTokenIds.length * dailyRate).toFixed(2);
}

async function refreshStakedGrid() {
  const grid = document.getElementById("stakedGrid");
  const emptyMsg = document.getElementById("stakedEmptyMsg");
  const countLabel = document.getElementById("stakedCountLabel");
  const statStakedCount = document.getElementById("statStakedCount");

  const stillValid = [];
  for (const id of stakedTokenIds) {
    try {
      const staked = await stakingContract.isCurrentlyStaked(id);
      if (staked) stillValid.push(id);
    } catch {}
  }
  stakedTokenIds = stillValid;
  saveStakedIds();

  countLabel.textContent = "(" + stakedTokenIds.length + ")";
  if (statStakedCount) statStakedCount.textContent = stakedTokenIds.length;
  updatePointsPerDay();

  grid.innerHTML = "";
  if (stakedTokenIds.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  for (const id of stakedTokenIds) {
    const card = document.createElement("div");
    card.className = "soft-card";
    card.innerHTML =
      "<div class=\"soft-card-id\">#" + id + "</div>" +
      "<div class=\"soft-card-reward\"><span id=\"reward-" + id + "\">0.0000</span> $PUNK</div>" +
      "<div class=\"soft-card-actions\">" +
      "<button class=\"btn btn-outline btn-sm\" data-claim=\"" + id + "\">Claim</button>" +
      "<button class=\"btn btn-primary btn-sm\" data-unstake=\"" + id + "\">Unstake</button>" +
      "</div>" +
      "<p class=\"soft-lock\" id=\"lock-" + id + "\"></p>";
    grid.appendChild(card);

    try {
      const reward = await stakingContract.pendingReward(id);
      liveRewards[id] = Number(ethers.formatEther(reward));
    } catch { liveRewards[id] = 0; }

    try {
      const can = await stakingContract.canUnstake(id);
      const lockEl = document.getElementById("lock-" + id);
      if (lockEl) {
        lockEl.textContent = can ? "Unlocked" : "Locked (7 days)";
        lockEl.className = "soft-lock " + (can ? "unlocked" : "");
      }
    } catch {}
  }

  document.querySelectorAll("[data-claim]").forEach((btn) => btn.addEventListener("click", () => doClaim(btn.dataset.claim, btn)));
  document.querySelectorAll("[data-unstake]").forEach((btn) => btn.addEventListener("click", () => doUnstake(btn.dataset.unstake, btn)));
}

function renderWalletGrid() {
  const grid = document.getElementById("walletGrid");
  const emptyMsg = document.getElementById("walletEmptyMsg");
  const countLabel = document.getElementById("walletCountLabel");

  const available = walletTokenIds.filter((id) => !stakedTokenIds.includes(id));
  countLabel.textContent = "(" + available.length + ")";
  grid.innerHTML = "";

  if (available.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  available.sort((a, b) => Number(a) - Number(b)).forEach((id) => {
    const card = document.createElement("div");
    card.className = "soft-card selectable" + (selectedIds.has(id) ? " selected" : "");
    card.dataset.id = id;
    card.innerHTML = "<div class=\"soft-card-id\">#" + id + "</div><div class=\"soft-check\">✓</div>";
    card.addEventListener("click", () => {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      renderWalletGrid();
    });
    grid.appendChild(card);
  });
}

async function scanWalletInBackground() {
  const statusEl = document.getElementById("scanStatus");
  const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, readProvider);

  for (let start = 1; start <= MAX_SUPPLY; start += SCAN_BATCH) {
    const batch = [];
    for (let id = start; id < start + SCAN_BATCH && id <= MAX_SUPPLY; id++) batch.push(id);

    const results = await Promise.all(batch.map(async (id) => {
      try {
        const owner = await contract.ownerOf(id);
        return owner.toLowerCase() === userAddress.toLowerCase() ? id.toString() : null;
      } catch { return null; }
    }));

    const found = results.filter((r) => r !== null);
    if (found.length > 0) {
      walletTokenIds = [...new Set([...walletTokenIds, ...found])];
      saveWalletIds();
      renderWalletGrid();
    }

    const pct = Math.round((Math.min(start + SCAN_BATCH - 1, MAX_SUPPLY) / MAX_SUPPLY) * 100);
    if (statusEl) statusEl.textContent = "Scanning wallet... " + pct + "%";

    await sleep(SCAN_DELAY);
  }
  if (statusEl) statusEl.textContent = "";
}

async function doStakeOne(tokenId) {
  const alreadyStaked = await stakingContract.isCurrentlyStaked(tokenId);
  if (!alreadyStaked) {
    const tx = await stakingContract.stake(tokenId, { gasLimit: 300000 });
    await tx.wait();
  }
  if (!stakedTokenIds.includes(tokenId)) {
    stakedTokenIds.push(tokenId);
    saveStakedIds();
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
    stakedTokenIds = stakedTokenIds.filter((t) => t !== tokenId);
    saveStakedIds();
    await refreshStakedGrid();
    renderWalletGrid();
    await refreshBalance();
  } catch (err) {
    alert("Unstake failed: " + (err.reason || err.message));
    btn.disabled = false;
    btn.textContent = "Unstake";
  }
}

function tickLiveRewards() {
  stakedTokenIds.forEach((id) => {
    if (!(id in liveRewards)) liveRewards[id] = 0;
    liveRewards[id] += dailyRate / (24 * 60 * 60);
    const el = document.getElementById("reward-" + id);
    if (el) el.textContent = liveRewards[id].toFixed(6);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("stakingConnectBtn");
  const manualBtn = document.getElementById("manualAddBtn");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const stakeSelectedBtn = document.getElementById("stakeSelectedBtn");

  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      document.getElementById("navWalletBtn")?.click();
      setTimeout(initStaking, 1500);
    });
  }

  if (manualBtn) {
    manualBtn.addEventListener("click", async () => {
      const id = document.getElementById("manualTokenId").value.trim();
      if (!id) return;
      try {
        const owner = await nftContract.ownerOf(id);
        if (owner.toLowerCase() === userAddress.toLowerCase()) {
          walletTokenIds = [...new Set([...walletTokenIds, id])];
          saveWalletIds();
          renderWalletGrid();
        } else {
          alert("You don't own this token.");
        }
      } catch {
        alert("Couldn't verify that token ID.");
      }
    });
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      const available = walletTokenIds.filter((id) => !stakedTokenIds.includes(id));
      if (selectedIds.size === available.length) selectedIds.clear();
      else available.forEach((id) => selectedIds.add(id));
      renderWalletGrid();
    });
  }

  if (stakeSelectedBtn) {
    stakeSelectedBtn.addEventListener("click", async () => {
      if (selectedIds.size === 0) { alert("Select at least one ArcPunk first."); return; }
      stakeSelectedBtn.disabled = true;
      stakeSelectedBtn.textContent = "Staking...";
      for (const id of selectedIds) {
        try { await doStakeOne(id); } catch (err) { console.error(err); }
      }
      selectedIds.clear();
      await refreshStakedGrid();
      renderWalletGrid();
      await refreshBalance();
      stakeSelectedBtn.disabled = false;
      stakeSelectedBtn.textContent = "Stake selected";
    });
  }

  setTimeout(() => { if (walletState.connected) initStaking(); }, 800);

  document.getElementById("navWalletBtn")?.addEventListener("click", () => {
    setTimeout(initStaking, 1500);
  });

  setInterval(tickLiveRewards, 1000);
});