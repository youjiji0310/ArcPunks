const PUNK_TOKEN_ADDRESS = "0xfd75D1873b3F8639CEFF2bB83c4cf728B8bfD661";
const SALE_CONTRACT_ADDRESS = "0x5581a479c2Cf5FC281f457A27687063805a3BE27";

const SALE_ABI = [
  "function buy(uint256 amount) external payable",
  "function pricePer500() view returns (uint256)",
  "function totalSold() view returns (uint256)"
];
const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

let provider, signer, saleContract, tokenContract;
let pricePer500Wei = ethers.parseEther("0.5");

async function refreshSaleStats() {
  try {
    const readProvider = new ethers.JsonRpcProvider("https://rpc.arc-scan.org");
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

function updateCostDisplay() {
  const amountInput = document.getElementById("buyAmount");
  const costEl = document.getElementById("buyCost");
  const amount = Number(amountInput.value);

  if (!amount || amount <= 0) {
    costEl.innerHTML = "Enter an amount to see the cost.";
    return;
  }

  const cost = (amount * Number(ethers.formatEther(pricePer500Wei))) / 500;
  costEl.innerHTML = "Total cost: <strong>" + cost.toFixed(4) + " USDC</strong> for " + amount.toLocaleString() + " $PUNK";
}

async function connectAndShowBuy() {
  if (!walletState.connected || !walletState.provider) return;

  provider = new ethers.BrowserProvider(walletState.provider);
  signer = await provider.getSigner();
  saleContract = new ethers.Contract(SALE_CONTRACT_ADDRESS, SALE_ABI, signer);

  document.getElementById("connectBuyBtn").style.display = "none";
  document.getElementById("buyBtn").style.display = "block";
}

async function doBuy() {
  const buyBtn = document.getElementById("buyBtn");
  const statusEl = document.getElementById("buyStatus");
  const amount = Number(document.getElementById("buyAmount").value);

  if (!amount || amount <= 0) {
    statusEl.textContent = "Enter a valid amount first.";
    statusEl.className = "buy-status error";
    return;
  }

  const cost = (BigInt(amount) * pricePer500Wei) / 500n;

  try {
    buyBtn.disabled = true;
    buyBtn.textContent = "Confirm in wallet...";
    statusEl.textContent = "";

    const tx = await saleContract.buy(amount, { value: cost, gasLimit: 300000 });
    buyBtn.textContent = "Processing...";
    await tx.wait();

    statusEl.textContent = "Success! " + amount.toLocaleString() + " $PUNK sent to your wallet.";
    statusEl.className = "buy-status success";
    await refreshSaleStats();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Purchase failed: " + (err.reason || err.message);
    statusEl.className = "buy-status error";
  }

  buyBtn.disabled = false;
  buyBtn.textContent = "Mint $PUNK";
}

document.addEventListener("DOMContentLoaded", () => {
  refreshSaleStats();

  const connectBtn = document.getElementById("connectBuyBtn");
  const buyBtn = document.getElementById("buyBtn");
  const amountInput = document.getElementById("buyAmount");

  amountInput.addEventListener("input", updateCostDisplay);

  connectBtn.addEventListener("click", async () => {
    if (walletState.connected) {
      connectAndShowBuy();
      return;
    }
    const navBtn = document.getElementById("navWalletBtn");
    if (navBtn) {
      navBtn.click();
    } else if (typeof openWalletModal === "function") {
      openWalletModal();
    }
    setTimeout(connectAndShowBuy, 1500);
  });

  buyBtn.addEventListener("click", doBuy);

  setTimeout(() => {
    if (walletState.connected) connectAndShowBuy();
  }, 800);

  setInterval(refreshSaleStats, 15000);
});