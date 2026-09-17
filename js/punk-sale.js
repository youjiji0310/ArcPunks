const PUNK_TOKEN_ADDRESS = "0xfd75D1873b3F8639CEFF2bB83c4cf728B8bfD661";
const SALE_CONTRACT_ADDRESS = "0x5581a479c2Cf5FC281f457A27687063805a3BE27";
const READ_RPC_URL = "https://rpc.arc-scan.org";

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

async function refreshSaleStats() {
  try {
    const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);
    const readSale = new ethers.Contract(SALE_CONTRACT_ADDRESS, SALE_ABI, readProvider);
    const readToken = new ethers.Contract(PUNK_TOKEN_ADDRESS, TOKEN_ABI, readProvider);

    const [sold, remaining, price] = await Promise.all([
      readSale.totalSold(),
      readToken.balanceOf(SALE_CONTRACT_ADDRESS),
      readSale.pricePer500()
    ]);

    pricePer500Wei = price;
    document.getElementById("statSold").textContent = Number(ethers.formatEther(sold)).toLocaleString();
    document.getElementById("buySoldDetail").textContent =
      Number(ethers.formatEther(remaining)).toLocaleString() + " $PUNK remaining in this sale";
  } catch (err) {
    console.warn("Could not load sale stats:", err.message);
  }
}

async function refreshMyBalance() {
  if (!walletState.connected) return;
  try {
    const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);
    const readToken = new ethers.Contract(PUNK_TOKEN_ADDRESS, TOKEN_ABI, readProvider);
    const bal = await readToken.balanceOf(walletState.address);
    document.getElementById("statMyBalance").textContent = Number(ethers.formatEther(bal)).toLocaleString();
  } catch (err) {
    console.warn("Could not load balance:", err.message);
    document.getElementById("statMyBalance").textContent = "0";
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
    statusEl.textContent = "Purchase failed: " + (err.reason || err.message);
    statusEl.className = "punk-buy-status error";
  }

  buyBtn.disabled = false;
  buyBtn.textContent = originalText;
}

document.addEventListener("DOMContentLoaded", () => {
  refreshSaleStats();

  document.querySelectorAll(".punk-amount-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectAmount(Number(btn.dataset.amount), btn));
  });

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