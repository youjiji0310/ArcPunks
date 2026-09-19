const NFT_CONTRACT_ADDRESS = "0x0b009536afcbe40e41197d1e633a437ed6e30ada";
const PUNK_TOKEN_ADDRESS = "0xfd75D1873b3F8639CEFF2bB83c4cf728B8bfD661";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const READ_RPC_URL = "https://rpc.arc-scan.org";
const CHUNK_SIZE = 45000;
const SEARCH_RANGE = 600000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getEventsChunked(contract, filter, provider, statusEl, label) {
  const currentBlock = await provider.getBlockNumber();
  let fromBlock = Math.max(0, currentBlock - SEARCH_RANGE);
  let allEvents = [];

  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
    try {
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      allEvents = allEvents.concat(events);
    } catch (err) {
      console.warn("Chunk failed:", err.message);
    }
    const pct = Math.round((toBlock - (currentBlock - SEARCH_RANGE)) / SEARCH_RANGE * 100);
    if (statusEl) statusEl.textContent = label + "... " + Math.min(pct, 100) + "%";
    fromBlock = toBlock + 1;
    await sleep(100);
  }
  return allEvents;
}

async function runScan() {
  const statusEl = document.getElementById("scanProgress");
  const resultsEl = document.getElementById("resultsTable");
  const scanBtn = document.getElementById("scanBtn");

  scanBtn.disabled = true;
  resultsEl.innerHTML = "";

  const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL);

  const nftContract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    ["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"],
    readProvider
  );
  const punkContract = new ethers.Contract(
    PUNK_TOKEN_ADDRESS,
    ["event Transfer(address indexed from, address indexed to, uint256 amount)"],
    readProvider
  );

  const nftFilter = nftContract.filters.Transfer(null, BURN_ADDRESS);
  const nftEvents = await getEventsChunked(nftContract, nftFilter, readProvider, statusEl, "Scanning NFT burns");

  const punkFilter = punkContract.filters.Transfer(null, BURN_ADDRESS);
  const punkEvents = await getEventsChunked(punkContract, punkFilter, readProvider, statusEl, "Scanning PUNK burns");

  statusEl.textContent = "Aggregating results...";

  const walletData = {};

  nftEvents.forEach((e) => {
    const from = e.args.from.toLowerCase();
    if (!walletData[from]) walletData[from] = { nftBurned: 0, punkBurned: 0n };
    walletData[from].nftBurned += 1;
  });

  punkEvents.forEach((e) => {
    const from = e.args.from.toLowerCase();
    if (!walletData[from]) walletData[from] = { nftBurned: 0, punkBurned: 0n };
    walletData[from].punkBurned += e.args.amount;
  });

  const rows = Object.entries(walletData).map(([wallet, data]) => {
    const punkBurnedNum = Number(ethers.formatEther(data.punkBurned));
    const nftCycles = Math.floor(data.nftBurned / 5);
    const punkCycles = Math.floor(punkBurnedNum / 10000);
    const spotsEarned = Math.min(nftCycles, punkCycles);
    return { wallet, nftBurned: data.nftBurned, punkBurned: punkBurnedNum, spotsEarned };
  }).sort((a, b) => b.spotsEarned - a.spotsEarned || b.nftBurned - a.nftBurned);

  statusEl.textContent = "Done — " + rows.length + " wallets found.";

  let html = "<table style='width:100%; border-collapse:collapse;'>";
  html += "<tr style='border-bottom:1px solid var(--line);'><th style='padding:10px; text-align:left; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);'>Wallet</th><th style='padding:10px; text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);'>NFT Burned</th><th style='padding:10px; text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-dim);'>$PUNK Burned</th><th style='padding:10px; text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--cyan);'>GTD Spots</th></tr>";

  rows.forEach((r) => {
    html += "<tr style='border-bottom:1px solid var(--line);'>" +
      "<td style='padding:10px; font-family:var(--font-mono); font-size:0.8rem;'>" + r.wallet + "</td>" +
      "<td style='padding:10px; text-align:right; font-family:var(--font-mono);'>" + r.nftBurned + "</td>" +
      "<td style='padding:10px; text-align:right; font-family:var(--font-mono);'>" + r.punkBurned.toLocaleString() + "</td>" +
      "<td style='padding:10px; text-align:right; font-family:var(--font-mono); font-weight:800; color:" + (r.spotsEarned > 0 ? "var(--cyan)" : "var(--text-dim)") + ";'>" + r.spotsEarned + "</td>" +
      "</tr>";
  });
  html += "</table>";

  resultsEl.innerHTML = html;
  scanBtn.disabled = false;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scanBtn").addEventListener("click", runScan);
});