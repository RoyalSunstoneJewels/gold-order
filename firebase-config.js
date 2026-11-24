import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAcuEEKzTc5qOXXjhhu3qxaHdn-smDRSP4",
  authDomain: "royal-sunstone-jewels.firebaseapp.com",
  databaseURL: "https://royal-sunstone-jewels-default-rtdb.firebaseio.com",
  projectId: "royal-sunstone-jewels",
  storageBucket: "royal-sunstone-jewels.firebasestorage.app",
  messagingSenderId: "593998471961",
  appId: "1:593998471961:web:bb4102e5d20d94d31a1b88",
  measurementId: "G-V7VEWDYC32"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);