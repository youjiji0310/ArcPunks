const NFT_CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const READ_RPC_URL = "https://rpc.arc-scan.org";
const MAX_SUPPLY = 10000;
const SCAN_BATCH = 25;
const SCAN_DELAY = 130;

const NFT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) external"
];

let provider, signer, userAddress, nftContract;
let walletTokenIds = [];
let selectedIds = new Set();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function walletKey() { return "arcpunks_wallet_" + userAddress.toLowerCase(); }

function loadWalletIds() {
  try { walletTokenIds = [...new Set(JSON.parse(localStorage.getItem(walletKey()) || "[]"))]; }
  catch { walletTokenIds = []; }
}
function saveWalletIds() { localStorage.setItem(walletKey(), JSON.stringify(walletTokenIds)); }

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

async function initBurn() {
  if (!walletState.connected || !walletState.provider) return;

  provider = new ethers.BrowserProvider(walletState.provider);
  signer = await provider.getSigner();
  userAddress = walletState.address;
  nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);

  document.getElementById("stakingConnectPrompt").style.display = "none";
  document.getElementById("stakingContent").style.display = "block";

  loadWalletIds();
  renderWalletGrid();
  await pruneStaleTokens();
  scanWalletInBackground();
}

function renderWalletGrid() {
  const grid = document.getElementById("walletGrid");
  const emptyMsg = document.getElementById("walletEmptyMsg");
  const countLabel = document.getElementById("walletCountLabel");

  countLabel.textContent = "(" + walletTokenIds.length + ")";
  grid.innerHTML = "";

  if (walletTokenIds.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  walletTokenIds.sort((a, b) => Number(a) - Number(b)).forEach((id) => {
    const card = document.createElement("div");
    card.className = "soft-card selectable" + (selectedIds.has(id) ? " selected" : "");
    card.dataset.id = id;
    card.innerHTML = "<div class=\"soft-card-id\">#" + id + "</div><div class=\"soft-check\">?</div>";
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
    } catch (err) {
      console.error("Failed to burn #" + id + ":", err);
    }
  }

  saveWalletIds();
  selectedIds.clear();
  renderWalletGrid();

  statusEl.textContent = burned + " ArcPunk(s) burned successfully. Your wallet is now recorded for future GTD WL eligibility.";
  statusEl.className = "punk-buy-status success";
  burnBtn.disabled = false;
  burnBtn.textContent = "Burn selected";
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("stakingConnectBtn");
  const manualBtn = document.getElementById("manualAddBtn");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const burnSelectedBtn = document.getElementById("burnSelectedBtn");

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

  if (burnSelectedBtn) {
    burnSelectedBtn.addEventListener("click", doBurnSelected);
  }

  setTimeout(() => { if (walletState.connected) initBurn(); }, 800);
  document.getElementById("navWalletBtn")?.addEventListener("click", () => setTimeout(initBurn, 1500));
});