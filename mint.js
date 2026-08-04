// mint.js — gère la quantité, le prix (fixe 0.5 USDC), le mint réel, et le compteur de progression.
// Fichier autonome : ne dépend plus de wallet.js pour CONTRACT_ADDRESS/CONTRACT_ABI
// (wallet.js s'occupe maintenant uniquement de la connexion wallet).
//
// ✅ CONTRACT_ADDRESS mis à jour avec la nouvelle adresse du contrat déployé via Remix.
// ⚠️ Les noms de fonctions ci-dessous (mint, totalMinted, MAX_SUPPLY, mintActive)
// sont toujours des suppositions basées sur le contrat précédent tant que tu n'as pas
// confirmé l'ABI exacte depuis Remix ("Deployed Contracts" > icône ABI/copy).
// Si le mint échoue encore avec une erreur du style "is not a function" ou
// "execution reverted", c'est probablement un nom à corriger ici (CONTRACT_ABI)
// et dans l'appel contract.mint(...) plus bas.

const CONTRACT_ADDRESS = '0x5858e9A63fedD759e4fb8fe2F8D7ccDde85dAEc3';

const CONTRACT_ABI = [
  'function mint(uint256 quantity) external payable',
  'function mintActive() view returns (bool)',
  'function totalMinted() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)'
];

const MAX_QTY = 3; // max 3 par wallet (confirmé)
const MINT_PRICE_USDC = '0.5'; // prix fixe confirmé, pas besoin de le lire depuis le contract

let currentQty = 1;
let mintPriceWei = null; // sera fixé au DOMContentLoaded une fois ethers.js chargé

const qtyDisplay = document.getElementById('qtyDisplay');
const totalPriceEl = document.getElementById('totalPrice');
const mintBtn = document.getElementById('mintBtn');
const decreaseBtn = document.getElementById('decreaseQty');
const increaseBtn = document.getElementById('increaseQty');
const countEl = document.getElementById('mintedCount');
const fillEl = document.getElementById('progressFill');

function refreshTotalPriceDisplay() {
  if (!totalPriceEl) return;

  if (mintPriceWei === null || typeof ethers === 'undefined') {
    totalPriceEl.textContent = 'TBA';
    return;
  }

  const totalWei = mintPriceWei * BigInt(currentQty);
  const totalUSDC = ethers.formatEther(totalWei);
  totalPriceEl.textContent = totalUSDC + ' USDC';
}

function updateQtyUI() {
  if (qtyDisplay) qtyDisplay.textContent = currentQty;
  if (decreaseBtn) decreaseBtn.disabled = currentQty <= 1;
  if (increaseBtn) increaseBtn.disabled = currentQty >= MAX_QTY;
  refreshTotalPriceDisplay();
}

// ---- Prix fixe : pas besoin d'appeler le contract ----
function loadMintPrice() {
  if (typeof ethers === 'undefined') return;
  mintPriceWei = ethers.parseEther(MINT_PRICE_USDC);
  refreshTotalPriceDisplay();
}

// ---- RPCs de lecture, avec fallback si un des deux est bloqué par une extension du navigateur ----
const READ_RPC_URLS = [
  ARC_MAINNET.rpcUrls[0],
  'https://5042.rpc.thirdweb.com'
];

// staticNetwork évite qu'ethers relance eth_chainId en boucle (source du spam
// "retry in 1s" quand une extension bloque la requête réseau)
function makeReadProvider(url) {
  return new ethers.JsonRpcProvider(url, 5042, { staticNetwork: true });
}

// ---- Compteur de progression (lecture publique, pas besoin de wallet connecté) ----
async function loadMintProgress() {
  if (typeof ethers === 'undefined') return;

  let lastErr = null;

  for (const url of READ_RPC_URLS) {
    try {
      const readProvider = makeReadProvider(url);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);

      const [totalMinted, maxSupply] = await Promise.all([
        contract.totalMinted(),
        contract.MAX_SUPPLY()
      ]);

      const minted = Number(totalMinted);
      const max = Number(maxSupply);

      if (countEl) countEl.textContent = minted.toLocaleString('en-US') + ' / ' + max.toLocaleString('en-US');
      if (fillEl) fillEl.style.width = (max > 0 ? (minted / max) * 100 : 0) + '%';
      return; // succès, pas besoin d'essayer le RPC suivant
    } catch (err) {
      lastErr = err;
      // Essaye le RPC suivant (ex: si rpc.blockdaemon est bloqué par une extension)
    }
  }

  console.error(
    'Impossible de charger le compteur de mint (RPC bloqué par une extension du navigateur, ou nom de fonction incorrect dans CONTRACT_ABI) :',
    lastErr
  );
}

// ---- Mint réel ----
async function handleMintClick() {
  if (!walletState.connected || !walletState.provider) {
    openWalletModal();
    return;
  }

  if (typeof ethers === 'undefined') {
    alert('ethers.js manquant, voir la console.');
    return;
  }

  if (mintPriceWei === null) {
    alert('Prix du mint pas encore chargé, réessaie dans une seconde.');
    return;
  }

  const originalText = mintBtn.textContent;

  try {
    mintBtn.disabled = true;
    mintBtn.textContent = 'Confirme dans ton wallet...';

    const ethersProvider = new ethers.BrowserProvider(walletState.provider);
    const signer = await ethersProvider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Vérifie que le mint est actif avant d'envoyer la tx (si la fonction n'existe pas,
    // on log l'erreur mais on continue quand même — le contract rejettera si besoin)
    try {
      const isActive = await contract.mintActive();
      if (!isActive) {
        alert('Le mint n\'est pas encore actif.');
        mintBtn.disabled = false;
        mintBtn.textContent = originalText;
        return;
      }
    } catch (checkErr) {
      console.warn('Impossible de vérifier mintActive() (nom de fonction incorrect ?) :', checkErr);
    }

    const totalWei = mintPriceWei * BigInt(currentQty);

    const tx = await contract.mint(currentQty, { value: totalWei });
    mintBtn.textContent = 'Transaction en cours...';
    await tx.wait();

    alert('Mint réussi ✅');
    await loadMintProgress();
  } catch (err) {
    console.error('Mint échoué :', err);
    const reason = err?.shortMessage || err?.reason || err?.message || 'voir la console';
    alert('Mint échoué : ' + reason);
  } finally {
    mintBtn.disabled = false;
    mintBtn.textContent = originalText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadMintPrice();
  loadMintProgress();
  updateQtyUI();

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      if (currentQty > 1) {
        currentQty -= 1;
        updateQtyUI();
      }
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      if (currentQty < MAX_QTY) {
        currentQty += 1;
        updateQtyUI();
      }
    });
  }

  if (mintBtn) {
    mintBtn.addEventListener('click', handleMintClick);
  }
});