import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkbfAn7QTk6sEgalAnMB2fonJ8zR6sldA",
  authDomain: "arcpunk-43377.firebaseapp.com",
  projectId: "arcpunk-43377",
  storageBucket: "arcpunk-43377.firebasestorage.app",
  messagingSenderId: "202209493523",
  appId: "1:202209493523:web:34d8155c1b087d7f31f5e6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("whitelistForm");
  const status = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const xUsername = document.getElementById("xUsername").value.trim();
    const wallet = document.getElementById("wallet").value.trim();
    const commentLink = document.getElementById("commentLink").value.trim();

    if (!xUsername || !wallet || !commentLink) {
      status.textContent = "Please fill in all fields.";
      status.className = "whitelist-form-status error";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      await addDoc(collection(db, "whitelist"), {
        xUsername,
        wallet,
        commentLink,
        timestamp: serverTimestamp()
      });

      status.textContent = "You're in! We'll verify and whitelist your wallet soon.";
      status.className = "whitelist-form-status success";
      form.reset();
    } catch (err) {
      console.error("Whitelist submission error:", err);
      status.textContent = "Something went wrong. Please try again.";
      status.className = "whitelist-form-status error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit for Whitelist";
    }
  });
});