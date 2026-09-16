// Wallet connect réel avec sélecteur multi-wallet (EIP-6963) + fallback window.ethereum
// Arc Mainnet (Chain ID 5042)

const ARC_MAINNET = {
  chainId: '0x13B2', // 5042 en hexadécimal
  chainName: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://arc-mainnet.infura.io/v3/b6bf7d3508c941499b10025c0776eaf8'],
  blockExplorerUrls: [] // TODO: ajouter l'URL de l'explorer Arc Mainnet si disponible
};

const KNOWN_WALLETS = [
  { rdns: 'io.metamask', name: 'MetaMask', color: '#f6851b', installUrl: 'https://metamask.io/download/' },
  { rdns: 'com.coinbase.wallet', name: 'Coinbase Wallet', color: '#0052ff', installUrl: 'https://www.coinbase.com/wallet/downloads' },
  { rdns: 'io.rabby', name: 'Rabby Wallet', color: '#7084ff', installUrl: 'https://rabby.io/' },
  { rdns: 'com.okex.wallet', name: 'OKX Wallet', color: '#000000', installUrl: 'https://www.okx.com/web3' }
];

let walletState = { connected: false, address: null, provider: null };
let detectedProviders = [];

// ---- Détection multi-wallet via EIP-6963 ----
window.addEventListener('eip6963:announceProvider', (event) => {
  const { info, provider } = event.detail;
  if (!detectedProviders.find((p) => p.info.uuid === info.uuid)) {
    detectedProviders.push({ info, provider });
  }
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

function shortenAddress(addr) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

async function switchToArcMainnet(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_MAINNET.chainId }] });
  } catch (switchError) {
    const message = (switchError.message || '').toLowerCase();
    const isUnrecognizedChain = switchError.code === 4902 || message.includes('unrecognized chain');

    if (!isUnrecognizedChain) {
      throw switchError;
    }

    // Ajoute le réseau
    await provider.request({ method: 'wallet_addEthereumChain', params: [ARC_MAINNET] });

    // Certains wallets (Rabby inclus) n'activent pas le réseau après l'ajout -> on force le switch
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_MAINNET.chainId }] });
    } catch (secondSwitchError) {
      console.warn('Réseau ajouté mais switch automatique échoué, l\'utilisateur devra basculer manuellement :', secondSwitchError);
    }
  }
}

async function connectToProvider(provider) {
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    await switchToArcMainnet(provider);
    walletState.connected = true;
    walletState.address = accounts[0];
    walletState.provider = provider;
    return true;
  } catch (err) {
    console.error('Connexion refusée ou échouée :', err);
    return false;
  }
}

function updateAllWalletButtons() {
  const buttons = [document.getElementById('navWalletBtn'), document.getElementById('mintWalletBtn')].filter(Boolean);
  buttons.forEach((btn) => {
    if (walletState.connected) {
      btn.textContent = shortenAddress(walletState.address);
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline');
    } else {
      btn.textContent = 'Connect Wallet';
    }
  });
}

// ---- Modal de sélection ----
function buildWalletList() {
  return KNOWN_WALLETS.map((known) => {
    const found = detectedProviders.find((p) => p.info.rdns === known.rdns);
    return {
      name: known.name,
      color: known.color,
      installed: !!found,
      provider: found ? found.provider : null,
      installUrl: known.installUrl
    };
  });
}

function openWalletModal() {
  closeWalletModal();

  const overlay = document.createElement('div');
  overlay.id = 'walletModalOverlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(5,6,15,0.7);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: #0e1e33; border: 1px solid rgba(255,255,255,0.1); border-radius: 18px;
    padding: 24px; width: 320px; max-width: 90vw; font-family: 'Inter', sans-serif;
  `;

  const title = document.createElement('div');
  title.textContent = 'Connect a wallet';
  title.style.cssText = 'color:#eaf2fa; font-weight:700; font-size:1.05rem; margin-bottom:16px;';
  panel.appendChild(title);

  const wallets = buildWalletList();
  const hasAnyInstalled = wallets.some((w) => w.installed);

  // Si aucun wallet connu détecté mais que window.ethereum existe (wallet générique) -> fallback
  if (!hasAnyInstalled && typeof window.ethereum !== 'undefined') {
    wallets.unshift({ name: 'Browser Wallet', color: '#3ec9f2', installed: true, provider: window.ethereum, installUrl: null });
  }

  wallets.forEach((w) => {
    const row = document.createElement('button');
    row.style.cssText = `
      display: flex; align-items: center; gap: 12px; width: 100%;
      background: #0c1a2c; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 12px 14px; margin-bottom: 10px; cursor: pointer; color: #eaf2fa;
      font-size: 0.9rem; font-family: inherit; transition: border-color .2s ease;
    `;

    const dot = document.createElement('span');
    dot.style.cssText = `width:10px; height:10px; border-radius:50%; background:${w.color}; flex-shrink:0;`;
    row.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = w.name;
    label.style.flex = '1';
    label.style.textAlign = 'left';
    row.appendChild(label);

    const status = document.createElement('span');
    status.textContent = w.installed ? 'Connect' : 'Install';
    status.style.cssText = `font-size:0.75rem; color:${w.installed ? '#3ec9f2' : '#8fa3b8'};`;
    row.appendChild(status);

    row.addEventListener('mouseenter', () => { row.style.borderColor = 'rgba(62,201,242,0.4)'; });
    row.addEventListener('mouseleave', () => { row.style.borderColor = 'rgba(255,255,255,0.08)'; });

    row.addEventListener('click', async () => {
      if (w.installed && w.provider) {
        status.textContent = 'Connecting...';
        const ok = await connectToProvider(w.provider);
        if (ok) {
          updateAllWalletButtons();
          closeWalletModal();
        } else {
          status.textContent = 'Failed — retry';
        }
      } else if (w.installUrl) {
        window.open(w.installUrl, '_blank', 'noopener,noreferrer');
      }
    });

    panel.appendChild(row);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  closeBtn.style.cssText = `
    width: 100%; background: transparent; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 10px; color: #8fa3b8; font-family: inherit;
    cursor: pointer; margin-top: 4px;
  `;
  closeBtn.addEventListener('click', closeWalletModal);
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeWalletModal(); });
  document.body.appendChild(overlay);
}

function closeWalletModal() {
  const existing = document.getElementById('walletModalOverlay');
  if (existing) existing.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  const buttons = [document.getElementById('navWalletBtn'), document.getElementById('mintWalletBtn')].filter(Boolean);
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (walletState.connected) return;
      openWalletModal();
    });
  });

  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        walletState.connected = false;
        walletState.address = null;
      } else {
        walletState.address = accounts[0];
      }
      updateAllWalletButtons();
    });
  }
});