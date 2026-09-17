const ARC_TESTNET = {
  chainId: "0x4CEF52",
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"]
};

const KNOWN_WALLETS = [
  { rdns: "io.metamask", name: "MetaMask", color: "#f6851b", installUrl: "https://metamask.io/download/" },
  { rdns: "com.coinbase.wallet", name: "Coinbase Wallet", color: "#0052ff", installUrl: "https://www.coinbase.com/wallet/downloads" },
  { rdns: "io.rabby", name: "Rabby Wallet", color: "#7084ff", installUrl: "https://rabby.io/" },
  { rdns: "com.okex.wallet", name: "OKX Wallet", color: "#000000", installUrl: "https://www.okx.com/web3" }
];

let walletState = { connected: false, address: null, provider: null };
let detectedProviders = [];

window.addEventListener("eip6963:announceProvider", (event) => {
  const { info, provider } = event.detail;
  if (!detectedProviders.find((p) => p.info.uuid === info.uuid)) {
    detectedProviders.push({ info, provider });
  }
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function switchToArcTestnet(provider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET.chainId }] });
  } catch (switchError) {
    const message = (switchError.message || "").toLowerCase();
    const isUnrecognizedChain = switchError.code === 4902 || message.includes("unrecognized chain");
    if (!isUnrecognizedChain) throw switchError;
    await provider.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET] });
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET.chainId }] });
    } catch {}
  }
}

function rememberProvider(rdns) {
  try { localStorage.setItem("arcpunks_wallet_rdns", rdns); } catch {}
}
function forgetProvider() {
  try { localStorage.removeItem("arcpunks_wallet_rdns"); } catch {}
}
function getRememberedProviderRdns() {
  try { return localStorage.getItem("arcpunks_wallet_rdns"); } catch { return null; }
}

async function connectToProvider(provider, rdns) {
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    await switchToArcTestnet(provider);
    walletState.connected = true;
    walletState.address = accounts[0];
    walletState.provider = provider;
    if (rdns) rememberProvider(rdns);
    return true;
  } catch (err) {
    console.error("Connexion refusee ou echouee :", err);
    return false;
  }
}

async function trySilentReconnect() {
  const rdns = getRememberedProviderRdns();
  if (!rdns) return false;

  await new Promise((r) => setTimeout(r, 300));

  const found = detectedProviders.find((p) => p.info.rdns === rdns);
  const provider = found ? found.provider : (rdns === "browser" ? window.ethereum : null);
  if (!provider) return false;

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      walletState.connected = true;
      walletState.address = accounts[0];
      walletState.provider = provider;
      updateAllWalletButtons();
      window.dispatchEvent(new Event("arcpunks:walletReady"));
      return true;
    }
  } catch {}
  return false;
}

function updateAllWalletButtons() {
  const buttons = [document.getElementById("navWalletBtn"), document.getElementById("mintWalletBtn")].filter(Boolean);
  buttons.forEach((btn) => {
    if (walletState.connected) {
      btn.textContent = shortenAddress(walletState.address);
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-outline");
    } else {
      btn.textContent = "Connect Wallet";
    }
  });
}

function buildWalletList() {
  return KNOWN_WALLETS.map((known) => {
    const found = detectedProviders.find((p) => p.info.rdns === known.rdns);
    return { name: known.name, color: known.color, installed: !!found, provider: found ? found.provider : null, rdns: known.rdns, installUrl: known.installUrl };
  });
}

function openWalletModal() {
  closeWalletModal();

  const overlay = document.createElement("div");
  overlay.id = "walletModalOverlay";
  overlay.className = "wallet-modal-overlay";

  const panel = document.createElement("div");
  panel.className = "wallet-modal-panel";

  const header = document.createElement("div");
  header.className = "wallet-modal-header";
  header.innerHTML = "<span>Connect Wallet</span>";
  panel.appendChild(header);

  const wallets = buildWalletList();
  const hasAnyInstalled = wallets.some((w) => w.installed);

  if (!hasAnyInstalled && typeof window.ethereum !== "undefined") {
    wallets.unshift({ name: "Browser Wallet", color: "#3ec9f2", installed: true, provider: window.ethereum, rdns: "browser", installUrl: null });
  }

  const list = document.createElement("div");
  list.className = "wallet-modal-list";

  wallets.forEach((w) => {
    const row = document.createElement("button");
    row.className = "wallet-modal-row";

    const dot = document.createElement("span");
    dot.className = "wallet-modal-dot";
    dot.style.background = w.color;
    row.appendChild(dot);

    const label = document.createElement("span");
    label.className = "wallet-modal-label";
    label.textContent = w.name;
    row.appendChild(label);

    const status = document.createElement("span");
    status.className = "wallet-modal-status";
    status.textContent = w.installed ? "Connect" : "Install";
    row.appendChild(status);

    row.addEventListener("click", async () => {
      if (w.installed && w.provider) {
        status.textContent = "Connecting...";
        const ok = await connectToProvider(w.provider, w.rdns);
        if (ok) {
          updateAllWalletButtons();
          closeWalletModal();
          window.dispatchEvent(new Event("arcpunks:walletReady"));
        } else {
          status.textContent = "Failed — retry";
        }
      } else if (w.installUrl) {
        window.open(w.installUrl, "_blank", "noopener,noreferrer");
      }
    });

    list.appendChild(row);
  });

  panel.appendChild(list);

  const closeBtn = document.createElement("button");
  closeBtn.className = "wallet-modal-cancel";
  closeBtn.textContent = "Cancel";
  closeBtn.addEventListener("click", closeWalletModal);
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeWalletModal(); });
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("visible"));
}

function openAccountModal() {
  closeWalletModal();

  const overlay = document.createElement("div");
  overlay.id = "walletModalOverlay";
  overlay.className = "wallet-modal-overlay";

  const panel = document.createElement("div");
  panel.className = "wallet-modal-panel";

  panel.innerHTML =
    "<div class=\"wallet-modal-header\"><span>Wallet Connected</span></div>" +
    "<div class=\"wallet-account-address\">" + shortenAddress(walletState.address) + "</div>";

  const copyBtn = document.createElement("button");
  copyBtn.className = "wallet-modal-row";
  copyBtn.innerHTML = "<span class=\"wallet-modal-label\">Copy Address</span>";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(walletState.address);
    copyBtn.querySelector(".wallet-modal-label").textContent = "Copied!";
    setTimeout(() => { copyBtn.querySelector(".wallet-modal-label").textContent = "Copy Address"; }, 1500);
  });
  panel.appendChild(copyBtn);

  const disconnectBtn = document.createElement("button");
  disconnectBtn.className = "wallet-modal-row wallet-disconnect-row";
  disconnectBtn.innerHTML = "<span class=\"wallet-modal-label\">Disconnect</span>";
  disconnectBtn.addEventListener("click", () => {
    disconnectWallet();
    closeWalletModal();
  });
  panel.appendChild(disconnectBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "wallet-modal-cancel";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeWalletModal);
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeWalletModal(); });
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("visible"));
}

function closeWalletModal() {
  const existing = document.getElementById("walletModalOverlay");
  if (existing) existing.remove();
}

function disconnectWallet() {
  walletState.connected = false;
  walletState.address = null;
  walletState.provider = null;
  forgetProvider();
  updateAllWalletButtons();
}

document.addEventListener("DOMContentLoaded", async () => {
  await trySilentReconnect();

  const buttons = [document.getElementById("navWalletBtn"), document.getElementById("mintWalletBtn")].filter(Boolean);
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (walletState.connected) {
        openAccountModal();
        return;
      }
      openWalletModal();
    });
  });

  if (typeof window.ethereum !== "undefined") {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        walletState.address = accounts[0];
      }
      updateAllWalletButtons();
    });
  }
});