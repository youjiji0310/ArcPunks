const CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const CONTRACT_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];

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

document.addEventListener("DOMContentLoaded", () => {
  const emptyState = document.getElementById("profileEmptyState");
  const manualAdd = document.getElementById("profileManualAdd");
  const loading = document.getElementById("profileLoading");
  const grid = document.getElementById("profileGrid");
  const connectBtn = document.getElementById("profileConnectBtn");
  const addBtn = document.getElementById("manualAddBtn");
  const addResult = document.getElementById("manualAddResult");

  function renderGrid() {
    grid.innerHTML = "";
    if (ownedTokenIds.length === 0) {
      grid.innerHTML = "<p class=\"profile-none\">No punks added yet. Enter a Token ID above to add it to your collection view.</p>";
      return;
    }
    ownedTokenIds.forEach((tokenId) => {
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
        ownedTokenIds = [...new Set([...ownedTokenIds, tokenId.toString()])]; saveOwnedIds();
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

  function activateProfile() {
    if (!walletState.connected) return;
    userAddress = walletState.address;
    emptyState.style.display = "none";
    manualAdd.style.display = "block";
    loading.style.display = "none";
    loadOwnedIds();
    renderGrid();
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