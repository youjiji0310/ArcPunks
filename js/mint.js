document.addEventListener("DOMContentLoaded", () => {
  const qtyDisplay = document.getElementById("qtyDisplay");
  const decreaseBtn = document.getElementById("decreaseQty");
  const increaseBtn = document.getElementById("increaseQty");
  const totalPrice = document.getElementById("totalPrice");
  const mintBtn = document.getElementById("mintBtn");
  const mintedCount = document.getElementById("mintedCount");
  const progressFill = document.getElementById("progressFill");

  let qty = 1;
  const MAX_QTY = 10;

  function updateUI() {
    if (qtyDisplay) qtyDisplay.textContent = qty;
    if (totalPrice) totalPrice.textContent = "0.5000 USDC";
    if (mintedCount) mintedCount.textContent = "0 / 10,000";
    if (progressFill) progressFill.style.width = "0%";
    if (mintBtn) {
      mintBtn.textContent = "Mint Not Active Yet";
      mintBtn.disabled = true;
      mintBtn.classList.add("btn-disabled");
    }
  }

  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      if (qty > 1) qty--;
      updateUI();
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      if (qty < MAX_QTY) qty++;
      updateUI();
    });
  }

  updateUI();
});