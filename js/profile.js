const CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const CONTRACT_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];
const READ_RPC_URL = "https://rpc.arc-scan.org";
const MAX_SUPPLY = 10000;
const BATCH_SIZE = 25;
const BATCH_DELAY = 150;

let userAddress = "";
let ownedTokenIds = [];

function storageKey() {
  return "arcpunks_owned_" + userAddress.toLowerCase();
}

function loadOwnedIds() {
  try {
    const raw = localStorage.getItem(storageKey());
    ownedTokenIds = raw ? [...new Set(JSON.parse(raw))] : [];
  } catch {
    ownedTokenIds = [];
  }
}

function saveOwnedIds() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(ownedTokenIds));
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

document.addEventListener("DOMContentLoaded", () => {
  const emptyState = document.getElementById("profileEmptyState");
  const manualAdd = document.getElementById("profileManualAdd");
  const grid = document.getElementById("profileGrid");
  const connectBtn = document.getElementById("profileConnectBtn");
  const addBtn = document.getElementById("manualAddBtn");
  const addResult = document.getElementById("manualAddResult");
  const scanStatus = document.getElementById("autoScanStatus");
  const scanProgress = document.getElementById("autoScanProgress");
  const scanFill = document.getElementById("autoScanFill");
  const scanText = document.getElementById("autoScanText");

  function renderGrid() {
    grid.innerHTML = "";
    if (ownedTokenIds.length === 0) {
      grid.innerHTML = "<p class=\"profile-none\">No punks found yet. They'll appear automatically as the scan finds them, or add one manually above.</p>";
      return;
    }
    const sorted = [...ownedTokenIds].sort((a, b) => Number(a) - Number(b));
    sorted.forEach((tokenId) => {
      const card = document.createElement("div");
      card.className = "profile-card";
      card.innerHTML =
        "<div class=\"profile-card-visual\"><span class=\"profile-card-number\">#" + tokenId + "</span></div>" +
        "<div class=\"profile-card-footer\"><span class=\"profile-card-name\">ArcPunk</span><a href=\"https://opensea.io/assets/arc/" + CONTRACT_ADDRESS + "/" + tokenId + "\" target=\"_blank\" class=\"profile-card-link\">View on OpenSea</a></div>";
      grid.appendChild(card);
    });
  }

  async function checkAndAddToken(tokenId) {
    if (!walletState.connected || !walletState.provider) {
      addResult.textContent = "Connect your wallet first.";
      addResult.className = "whitelist-check-result error";
      return;
    }

    addBtn.disabled = true;
    addBtn.textContent = "Checking...";

    try {
      const provider = new ethers.BrowserProvider(walletState.provider);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const owner = await contract.ownerOf(tokenId);

      if (owner.toLowerCase() === userAddress.toLowerCase()) {
        ownedTokenIds = [...new Set([...ownedTokenIds, tokenId.toString()])];
        saveOwnedIds();
        addResult.textContent = "Added ArcPunk #" + tokenId + " to your collection.";
        addResult.className = "whitelist-check-result success";
        renderGrid();
      } else {
        addResult.textContent = "This wallet doesn't own that token.";
        addResult.className = "whitelist-check-result error";
      }
    } catch (err) {
      addResult.textContent = "Couldn't verify that token ID.";
      addResult.className = "whitelist-check-result error";
    }

    addBtn.disabled = false;
    addBtn.textContent = "Add to My Punks";
  }

  async function autoScanCollection() {
    scanStatus.style.display = "block";
    const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);

    for (let start = 1; start <= MAX_SUPPLY; start += BATCH_SIZE) {
      const batch = [];
      for (let id = start; id < start + BATCH_SIZE && id <= MAX_SUPPLY; id++) {
        batch.push(id);
      }

      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            const owner = await contract.ownerOf(id);
            return owner.toLowerCase() === userAddress.toLowerCase() ? id.toString() : null;
          } catch {
            return null;
          }
        })
      );

      const found = results.filter((r) => r !== null);
      if (found.length > 0) {
        ownedTokenIds = [...new Set([...ownedTokenIds, ...found])];
        saveOwnedIds();
        renderGrid();
      }

      const progressPct = Math.round((Math.min(start + BATCH_SIZE - 1, MAX_SUPPLY) / MAX_SUPPLY) * 100);
      scanProgress.textContent = progressPct + "%";
      scanFill.style.width = progressPct + "%";

      await sleep(BATCH_DELAY);
    }

    scanText.textContent = "Scan complete.";
    setTimeout(() => { scanStatus.style.display = "none"; }, 3000);
  }

  function activateProfile() {
    if (!walletState.connected) return;
    userAddress = walletState.address;
    emptyState.style.display = "none";
    manualAdd.style.display = "block";
    loadOwnedIds();
    renderGrid();
    autoScanCollection();
  }

  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      const navBtn = document.getElementById("navWalletBtn");
      if (navBtn) navBtn.click();
      setTimeout(activateProfile, 1500);
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const tokenId = document.getElementById("manualAddTokenId").value.trim();
      if (!tokenId) return;
      checkAndAddToken(tokenId);
    });
  }

  setTimeout(() => {
    if (walletState.connected) activateProfile();
  }, 800);

  const navWalletBtn = document.getElementById("navWalletBtn");
  if (navWalletBtn) {
    navWalletBtn.addEventListener("click", () => {
      setTimeout(activateProfile, 1500);
    });
  }
});