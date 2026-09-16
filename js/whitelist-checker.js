function launchConfetti() {
  const colors = ["#3ec9f2", "#bdf1ff", "#7ac97a", "#e8d23e", "#e14b4b"];
  const container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 0.5) + "s";
    piece.style.animationDuration = (2.5 + Math.random() * 1.5) + "s";
    piece.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 4500);
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("checkWalletInput");
  const btn = document.getElementById("checkWalletBtn");
  const result = document.getElementById("checkResult");
  const card = document.querySelector(".whitelist-checker-card");

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

    card.classList.remove("celebrate");

    if (!wallet) {
      result.innerHTML = "Please enter a wallet address.";
      result.className = "whitelist-check-result error";
      return;
    }

    if (allApproved.has(wallet)) {
      result.innerHTML = "🎉 <strong>Congratulations!</strong><br>You're whitelisted!";
      result.className = "whitelist-check-result success";
      card.classList.add("celebrate");
      launchConfetti();
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