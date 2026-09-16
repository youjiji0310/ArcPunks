const CONTRACT_ADDRESS = "0x3A261C60153a39E0DA150E7650C2588FbEDC973e";

const CONTRACT_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)"
];

function ipfsToGateway(uri) {
  if (!uri) return "";
  return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
}

async function fetchMetadata(uri) {
  try {
    const res = await fetch(ipfsToGateway(uri));
    return await res.json();
  } catch (err) {
    console.warn("Metadata fetch failed:", err);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const emptyState = document.getElementById("profileEmptyState");
  const loading = document.getElementById("profileLoading");
  const grid = document.getElementById("profileGrid");
  const connectBtn = document.getElementById("profileConnectBtn");

  async function loadOwnedPunks() {
    if (!walletState.connected || !walletState.provider) return;

    emptyState.style.display = "none";
    loading.style.display = "block";
    grid.innerHTML = "";

    try {
      const provider = new ethers.BrowserProvider(walletState.provider);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const balance = Number(await contract.balanceOf(walletState.address));

      if (balance === 0) {
        loading.style.display = "none";
        grid.innerHTML = "<p class=\"profile-none\">You don't own any ArcPunks yet. <a href=\"/mint\">Mint one</a> or check the <a href=\"/marketplace\">marketplace</a>.</p>";
        return;
      }

      const tokenIds = [];
      for (let i = 0; i < balance; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(walletState.address, i);
        tokenIds.push(Number(tokenId));
      }

      const cards = await Promise.all(tokenIds.map(async (tokenId) => {
        const uri = await contract.tokenURI(tokenId);
        const metadata = await fetchMetadata(uri);
        return { tokenId, metadata };
      }));

      loading.style.display = "none";

      cards.forEach(({ tokenId, metadata }) => {
        const card = document.createElement("div");
        card.className = "profile-card";
        const imgSrc = metadata ? ipfsToGateway(metadata.image) : "";
        card.innerHTML =
          "<img src=\"" + imgSrc + "\" alt=\"ArcPunk #" + tokenId + "\">" +
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