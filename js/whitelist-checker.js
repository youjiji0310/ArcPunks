document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("checkWalletInput");
  const btn = document.getElementById("checkWalletBtn");
  const result = document.getElementById("checkResult");

  if (!btn) return;

  let approvedWallets = [];

  try {
    const res = await fetch("assets/whitelist-final.json");
    approvedWallets = await res.json();
  } catch (err) {
    console.error("Error loading whitelist data:", err);
  }

  const allApproved = new Set(approvedWallets.map(w => w.toLowerCase()));

  function checkWallet() {
    const wallet = input.value.trim().toLowerCase();

    if (!wallet) {
      result.textContent = "Please enter a wallet address.";
      result.className = "whitelist-check-result error";
      return;
    }

    if (allApproved.has(wallet)) {
      result.textContent = "✓ You're whitelisted!";
      result.className = "whitelist-check-result success";
    } else {
      result.textContent = "Not on the whitelist.";
      result.className = "whitelist-check-result error";
    }
  }

  btn.addEventListener("click", checkWallet);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkWallet();
  });
});