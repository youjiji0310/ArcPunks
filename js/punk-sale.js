const PUNK_TOKEN_ADDRESS = "0xfd75D1873b3F8639CEFF2bB83c4cf728B8bfD661";
const SALE_CONTRACT_ADDRESS = "0x279A1B879cbB43d50C2d64Cc4D1C5E91Ae7E1447";
const READ_RPC_URLS = ["https://rpc.arc-scan.org", "https://ethereum-rpc.publicnode.com"];

const SALE_ABI = [
  "function buy(uint256 amount) external payable",
  "function pricePer500() view returns (uint256)",
  "function totalSold() view returns (uint256)"
];
const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

let provider, signer, saleContract;
let pricePer500Wei = ethers.parseEther("0.5");
let selectedAmount = 0;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function withRetry(fn, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await sleep(700 * (i + 1));
    }
  }
  throw lastErr;
}

function getReadProvider() {
  return new ethers.JsonRpcProvider(READ_RPC_URLS[0]);
}

async function refreshSaleStats() {
  try {
    await withRetry(async () => {
      const readProvider = getReadProvider();
      const readSale = new ethers.Contract(SALE_CONTRACT_ADDRESS, SALE_ABI, readProvider);
      const readToken = new ethers.Contract(PUNK_TOKEN_ADDRESS, TOKEN_ABI, readProvider);

      const sold = await readSale.totalSold();
      const remaining = await readToken.balanceOf(SALE_CONTRACT_ADDRESS);
      const price = await readSale.pricePer500();

      pricePer500Wei = price;
      document.getElementById("statSold").textContent = Number(ethers.formatEther(sold)).toLocaleString();
      // ligne retiree
    });
  } catch (err) {
    console.warn("Could not load sale stats after retries:", err.message);
    document.getElementById("statSold").textContent = "—";
  }
}

async function refreshMyBalance() {
  if (!walletState.connected) return;
  try {
    await withRetry(async () => {
      const readProvider = getReadProvider();
      const readToken = new ethers.Contract(PUNK_TOKEN_ADDRESS, TOKEN_ABI, readProvider);
      const bal = await readToken.balanceOf(walletState.address);
      document.getElementById("statMyBalance").textContent = Number(ethers.formatEther(bal)).toLocaleString();
    });
  } catch (err) {
    console.warn("Could not load balance after retries:", err.message);
    document.getElementById("statMyBalance").textContent = "—";
  }
}

function updateCostDisplay() {
  const costEl = document.getElementById("buyCost");
  const buyBtn = document.getElementById("buyBtn");

  if (!selectedAmount) {
    costEl.textContent = "Select an amount above.";
    buyBtn.textContent = "Select an amount first";
    buyBtn.disabled = true;
    return;
  }

  const cost = (selectedAmount * Number(ethers.formatEther(pricePer500Wei))) / 500;
  costEl.innerHTML = "Total cost: <strong>" + cost.toFixed(4) + " USDC</strong> for " + selectedAmount.toLocaleString() + " $PUNK";
  buyBtn.textContent = "Mint " + selectedAmount.toLocaleString() + " $PUNK";
  buyBtn.disabled = !walletState.connected;
}

function selectAmount(amount, btnEl) {
  selectedAmount = amount;
  document.querySelectorAll(".punk-amount-btn").forEach((b) => b.classList.remove("selected"));
  if (btnEl) btnEl.classList.add("selected");
  updateCostDisplay();
}

async function connectAndShowBuy() {
  if (!walletState.connected || !walletState.provider) return;

  provider = new ethers.BrowserProvider(walletState.provider);
  signer = await provider.getSigner();
  saleContract = new ethers.Contract(SALE_CONTRACT_ADDRESS, SALE_ABI, signer);

  document.getElementById("connectPrompt").style.display = "none";
  document.getElementById("buyBtn").style.display = "block";

  updateCostDisplay();
  await refreshMyBalance();
}

async function doBuy() {
  const buyBtn = document.getElementById("buyBtn");
  const statusEl = document.getElementById("buyStatus");

  if (!selectedAmount) return;

  const cost = (BigInt(selectedAmount) * pricePer500Wei) / 500n;
  const originalText = buyBtn.textContent;

  try {
    buyBtn.disabled = true;
    buyBtn.textContent = "Confirm in wallet...";
    statusEl.textContent = "";

    const tx = await saleContract.buy(selectedAmount, { value: cost, gasLimit: 300000 });
    buyBtn.textContent = "Processing...";
    await tx.wait();

    statusEl.textContent = "Success! " + selectedAmount.toLocaleString() + " $PUNK sent to your wallet.";
    statusEl.className = "punk-buy-status success";
    await refreshSaleStats();
    await refreshMyBalance();
  } catch (err) {
    console.error(err);
    if (err.code === "ACTION_REJECTED") {
      statusEl.textContent = "Transaction cancelled.";
    } else {
      statusEl.textContent = "Purchase failed: " + (err.reason || err.message);
    }
    statusEl.className = "punk-buy-status error";
  }

  buyBtn.disabled = false;
  buyBtn.textContent = originalText;
}

document.addEventListener("DOMContentLoaded", () => {
  refreshSaleStats();

  document.querySelectorAll(".punk-amount-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("customAllocations").value = "";
      selectAmount(Number(btn.dataset.amount), btn);
    });
  });

  const customInput = document.getElementById("customAllocations");
  if (customInput) {
    customInput.addEventListener("input", () => {
      const allocations = Number(customInput.value);
      if (allocations > 0) {
        selectAmount(allocations * 500, null);
      } else {
        selectAmount(0, null);
      }
    });
  }

  const connectBtn = document.getElementById("connectBuyBtn");
  const buyBtn = document.getElementById("buyBtn");

  connectBtn.addEventListener("click", async () => {
    if (walletState.connected) {
      connectAndShowBuy();
      return;
    }
    const navBtn = document.getElementById("navWalletBtn");
    if (navBtn) navBtn.click();
    setTimeout(connectAndShowBuy, 1500);
  });

  buyBtn.addEventListener("click", doBuy);

  setTimeout(() => {
    if (walletState.connected) connectAndShowBuy();
  }, 800);

  setInterval(refreshSaleStats, 15000);
});