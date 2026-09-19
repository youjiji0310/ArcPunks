const NFT_CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const PUNK_TOKEN_ADDRESS = "0xfd75D1873b3F8639CEFF2bB83c4cf728B8bfD661";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const READ_RPC_URL = "https://rpc.arc-scan.org";
const MAX_SUPPLY = 10000;
const SCAN_BATCH = 25;
const SCAN_DELAY = 130;
const NFT_REQUIRED = 5;
const PUNK_REQUIRED = 10000;

const NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) external"
];
const PUNK_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

let provider, signer, userAddress, nftContract, punkContract;
let walletTokenIds = [];
let selectedIds = new Set();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function walletKey() { return "arcpunks_wallet_" + userAddress.toLowerCase(); }
function nftBurnKey() { return "arcpunks_burn_nft_" + userAddress.toLowerCase(); }
function punkBurnKey() { return "arcpunks_burn_punk_" + userAddress.toLowerCase(); }

function loadWalletIds() {
  try { walletTokenIds = [...new Set(JSON.parse(localStorage.getItem(walletKey()) || "[]"))]; }
  catch { walletTokenIds = []; }
}
function saveWalletIds() { localStorage.setItem(walletKey(), JSON.stringify(walletTokenIds)); }

function getNftBurnCount() { return Number(localStorage.getItem(nftBurnKey()) || "0"); }
function addNftBurnCount(n) { localStorage.setItem(nftBurnKey(), (getNftBurnCount() + n).toString()); }

function getPunkBurnCount() { return Number(localStorage.getItem(punkBurnKey()) || "0"); }
function addPunkBurnCount(n) { localStorage.setItem(punkBurnKey(), (getPunkBurnCount() + n).toString()); }

function updateGtdProgress() {
  const nftTotal = getNftBurnCount();
  const punkTotal = getPunkBurnCount();
  const nftInCycle = nftTotal % NFT_REQUIRED;
  const punkInCycle = punkTotal % PUNK_REQUIRED;
  const spotsEarned = Math.min(Math.floor(nftTotal / NFT_REQUIRED), Math.floor(punkTotal / PUNK_REQUIRED));

  const nftFill = document.getElementById("gtdNftFill");
  const nftCount = document.getElementById("gtdNftCount");
  const punkFill = document.getElementById("gtdPunkFill");
  const punkCount = document.getElementById("gtdPunkCount");
  const spotsEl = document.getElementById("gtdSpotsEarned");

  if (nftFill) nftFill.style.width = (nftInCycle / NFT_REQUIRED * 100) + "%";
  if (nftCount) nftCount.textContent = nftInCycle + " / " + NFT_REQUIRED;
  if (punkFill) punkFill.style.width = (punkInCycle / PUNK_REQUIRED * 100) + "%";
  if (punkCount) punkCount.textContent = punkInCycle.toLocaleString() + " / " + PUNK_REQUIRED.toLocaleString();
  if (spotsEl) spotsEl.textContent = spotsEarned;
}

async function refreshPunkBalance() {
  try {
    const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);
    const readToken = new ethers.Contract(PUNK_TOKEN_ADDRESS, PUNK_ABI, readProvider);
    const bal = await readToken.balanceOf(userAddress);
    document.getElementById("punkBalanceDisplay").textContent =
      "Your balance: " + Number(ethers.formatEther(bal)).toLocaleString() + " $PUNK";
  } catch (err) {
    console.warn("Could not load PUNK balance:", err.message);
  }
}

async function initBurn() {
  if (!walletState.connected || !walletState.provider) return;

  provider = new ethers.BrowserProvider(walletState.provider);
  signer = await provider.getSigner();
  userAddress = walletState.address;
  nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
  punkContract = new ethers.Contract(PUNK_TOKEN_ADDRESS, PUNK_ABI, signer);

  document.getElementById("stakingConnectPrompt").style.display = "none";
  document.getElementById("stakingContent").style.display = "block";

  loadWalletIds();
  renderWalletGrid();
  updateGtdProgress();
  await refreshPunkBalance();
  await pruneStaleTokens();
  scanWalletInBackground();
}

async function pruneStaleTokens() {
  if (walletTokenIds.length === 0) return;
  const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);
  const readContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ["function ownerOf(uint256) view returns (address)"], readProvider);

  const stillOwned = [];
  for (const id of walletTokenIds) {
    try {
      const owner = await readContract.ownerOf(id);
      if (owner.toLowerCase() === userAddress.toLowerCase()) stillOwned.push(id);
    } catch {}
  }
  walletTokenIds = stillOwned;
  saveWalletIds();
  renderWalletGrid();
}

function renderWalletGrid() {
  const grid = document.getElementById("walletGrid");
  const emptyMsg = document.getElementById("walletEmptyMsg");
  const countLabel = document.getElementById("walletCountLabel");

  countLabel.textContent = walletTokenIds.length + " ArcPunk" + (walletTokenIds.length === 1 ? "" : "s");
  grid.innerHTML = "";

  if (walletTokenIds.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  walletTokenIds.sort((a, b) => Number(a) - Number(b)).forEach((id) => {
    const card = document.createElement("div");
    card.className = "profile-card burn-card" + (selectedIds.has(id) ? " selected" : "");
    card.dataset.id = id;
    card.innerHTML =
      "<div class=\"profile-card-glow\"></div>" +
      "<div class=\"profile-card-visual\"><span class=\"profile-card-hash\">#</span><span class=\"profile-card-number\">" + id + "</span></div>" +
      "<div class=\"burn-card-footer\"><span class=\"profile-card-name\">ArcPunk</span><div class=\"burn-checkbox\"></div></div>";
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
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ["function ownerOf(uint256) view returns (address)"], readProvider);

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

function playBurnAnimation(label) {
  return new Promise((resolve) => {
    const machine = document.getElementById("burnMachine");
    const fallingItem = document.getElementById("burnFallingItem");
    const particlesEl = document.getElementById("burnParticles");

    machine.classList.add("active");
    fallingItem.textContent = label;
    fallingItem.classList.remove("falling");

    requestAnimationFrame(() => fallingItem.classList.add("falling"));

    setTimeout(() => {
      particlesEl.innerHTML = "";
      for (let i = 0; i < 16; i++) {
        const p = document.createElement("span");
        p.className = "burn-particle";
        p.style.left = (45 + Math.random() * 10) + "%";
        p.style.animationDelay = (Math.random() * 0.2) + "s";
        p.style.setProperty("--tx", (Math.random() * 80 - 40) + "px");
        particlesEl.appendChild(p);
      }
    }, 900);

    setTimeout(() => {
      machine.classList.remove("active");
      resolve();
    }, 1800);
  });
}

function showBurnSuccess(text) {
  const msgEl = document.getElementById("burnSuccessMsg");
  const textEl = document.getElementById("burnSuccessText");
  textEl.textContent = text;
  msgEl.classList.add("visible");
  setTimeout(() => msgEl.classList.remove("visible"), 5000);
}

async function doBurnSelected() {
  const statusEl = document.getElementById("burnStatus");
  const burnBtn = document.getElementById("burnSelectedBtn");

  if (selectedIds.size === 0) {
    statusEl.textContent = "Select at least one ArcPunk first.";
    statusEl.className = "punk-buy-status error";
    return;
  }

  const confirmed = confirm("Burn " + selectedIds.size + " ArcPunk(s)? This is PERMANENT and cannot be undone.");
  if (!confirmed) return;

  burnBtn.disabled = true;
  let burned = 0;

  for (const id of selectedIds) {
    try {
      burnBtn.textContent = "Burning #" + id + "...";
      const tx = await nftContract.transferFrom(userAddress, BURN_ADDRESS, id, { gasLimit: 200000 });
      await tx.wait();
      burned++;
      walletTokenIds = walletTokenIds.filter((t) => t !== id);
      await playBurnAnimation("#" + id);
    } catch (err) {
      console.error("Failed to burn #" + id + ":", err);
    }
  }

  saveWalletIds();
  selectedIds.clear();
  renderWalletGrid();

  if (burned > 0) {
    addNftBurnCount(burned);
    updateGtdProgress();
    showBurnSuccess(burned + " ArcPunk" + (burned > 1 ? "s" : "") + " burned. Keep going toward your next GTD spot.");
  }
  statusEl.textContent = "";
  burnBtn.disabled = false;
  burnBtn.textContent = "Burn selected";
}

async function doBurnPunk() {
  const amountInput = document.getElementById("punkBurnAmount");
  const burnBtn = document.getElementById("burnPunkBtn");
  const amount = Number(amountInput.value);

  if (!amount || amount <= 0) {
    alert("Enter a valid amount.");
    return;
  }

  const confirmed = confirm("Burn " + amount.toLocaleString() + " $PUNK? This is PERMANENT and cannot be undone.");
  if (!confirmed) return;

  try {
    burnBtn.disabled = true;
    burnBtn.textContent = "Confirm in wallet...";

    const amountWei = ethers.parseEther(amount.toString());
    const tx = await punkContract.transfer(BURN_ADDRESS, amountWei, { gasLimit: 150000 });
    burnBtn.textContent = "Burning...";
    await tx.wait();

    await playBurnAnimation(amount.toLocaleString() + " PUNK");

    addPunkBurnCount(amount);
    updateGtdProgress();
    await refreshPunkBalance();
    showBurnSuccess(amount.toLocaleString() + " $PUNK burned. Keep going toward your next GTD spot.");
  } catch (err) {
    console.error(err);
    alert("Burn failed: " + (err.reason || err.message));
  }

  burnBtn.disabled = false;
  burnBtn.textContent = "Burn $PUNK";
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("stakingConnectBtn");
  const manualBtn = document.getElementById("manualAddBtn");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const burnSelectedBtn = document.getElementById("burnSelectedBtn");
  const burnPunkBtn = document.getElementById("burnPunkBtn");

  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      document.getElementById("navWalletBtn")?.click();
      setTimeout(initBurn, 1500);
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
      if (selectedIds.size === walletTokenIds.length) selectedIds.clear();
      else walletTokenIds.forEach((id) => selectedIds.add(id));
      renderWalletGrid();
    });
  }

  if (burnSelectedBtn) burnSelectedBtn.addEventListener("click", doBurnSelected);
  if (burnPunkBtn) burnPunkBtn.addEventListener("click", doBurnPunk);

  setTimeout(() => { if (walletState.connected) initBurn(); }, 800);
  document.getElementById("navWalletBtn")?.addEventListener("click", () => setTimeout(initBurn, 1500));
});