const CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";

const CONTRACT_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const CHUNK_SIZE = 90000;

async function getTransferEventsChunked(contract, filter, provider) {
  const currentBlock = await provider.getBlockNumber();
  let fromBlock = 0;
  let allEvents = [];

  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
    try {
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      allEvents = allEvents.concat(events);
    } catch (err) {
      console.warn(`Erreur sur le range ${fromBlock}-${toBlock}:`, err.message);
    }
    fromBlock = toBlock + 1;
  }

  return allEvents;
}

document.addEventListener("DOMContentLoaded", () => {
  const emptyState = document.getElementById("profileEmptyState");
  const loading = document.getElementById("profileLoading");
  const grid = document.getElementById("profileGrid");
  const connectBtn = document.getElementById("profileConnectBtn");

  async function loadOwnedPunks() {
    if (!walletState.connected || !walletState.provider) return;

    if (emptyState) emptyState.style.display = "none";
    if (loading) loading.style.display = "block";
    grid.innerHTML = "";

    try {
      const provider = new ethers.BrowserProvider(walletState.provider);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const userAddress = walletState.address;

      const receivedFilter = contract.filters.Transfer(null, userAddress);
      const receivedEvents = await getTransferEventsChunked(contract, receivedFilter, provider);
      const candidateIds = new Set(receivedEvents.map(e => e.args.tokenId.toString()));

      const checks = await Promise.all(
        Array.from(candidateIds).map(async (tokenId) => {
          try {
            const currentOwner = await contract.ownerOf(tokenId);
            return currentOwner.toLowerCase() === userAddress.toLowerCase() ? tokenId : null;
          } catch {
            return null;
          }
        })
      );

      const ownedIds = checks.filter(id => id !== null);

      loading.style.display = "none";

      if (ownedIds.length === 0) {
        grid.innerHTML = "<p class=\"profile-none\">You don't own any ArcPunks yet. Check the <a href=\"https://opensea.io/collection/arc-punks-651893301\" target=\"_blank\">marketplace</a>.</p>";
        return;
      }

      ownedIds.forEach((tokenId) => {
        const card = document.createElement("div");
        card.className = "profile-card";
        card.innerHTML =
          "<div class=\"profile-card-placeholder\">ArcPunk #" + tokenId + "</div>" +
          "<p class=\"profile-card-id\">ArcPunk #" + tokenId + "</p>";
        grid.appendChild(card);
      });
    } catch (err) {
      console.error("Erreur de chargement des punks :", err);
      loading.style.display = "none";
      grid.innerHTML = "<p class=\"profile-none\">Couldn't load your punks. Try refreshing.</p>";
    }
  }

  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      const navBtn = document.getElementById("navWalletBtn");
      if (navBtn) navBtn.click();
      setTimeout(loadOwnedPunks, 1500);
    });
  }

  setTimeout(() => {
    if (walletState.connected) loadOwnedPunks();
  }, 800);

  const navWalletBtn = document.getElementById("navWalletBtn");
  if (navWalletBtn) {
    navWalletBtn.addEventListener("click", () => {
      setTimeout(loadOwnedPunks, 1500);
    });
  }
});