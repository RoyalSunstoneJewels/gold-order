import { db } from "./firebase-config.js";
import { ref, set, onValue, update, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const ORDERS_KEY = "rs_orders_100_v1";
const WALLET_KEY = "rs_wallet_100_v1";
const USERS_KEY = "rs_users_v1";
const CURRENT_UID_KEY = "rs_current_uid_v1";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80"
];

export const DEFAULT_SITE_IMAGES = {
  heroBg: "hero1.jpg",
  featureRing: "ring1.jpg"
};

let siteImages = { ...DEFAULT_SITE_IMAGES };

export function resolveImagePath(nameOrUrl, index = 0) {
  if (!nameOrUrl || !String(nameOrUrl).trim()) {
    return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
  }
  const clean = String(nameOrUrl).trim();
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("./") || clean.startsWith("/")) {
    return clean;
  }
  return "./images/" + clean;
}

export function buildInitialOrders100() {
  const orders = [];

  // Orders 1 - 25: Automatic with 25 image slots (order-1.jpg to order-25.jpg)
  for (let i = 1; i <= 25; i++) {
    orders.push({
      orderNo: i,
      isAuto: true,
      name: `Royal Sunstone Jewel #${i}`,
      image: `order-${i}.jpg`,
      price: Number((15 + i * 1.5).toFixed(2)),
      discount: 20
    });
  }

  // Orders 26 - 100: 75 customizable slots (name, image, price, discount)
  for (let i = 26; i <= 100; i++) {
    orders.push({
      orderNo: i,
      isAuto: false,
      name: `Custom Royal Piece #${i}`,
      image: `custom-${i}.jpg`,
      price: Number((25 + (i - 25) * 1.2).toFixed(2)),
      discount: 15
    });
  }

  return orders;
}

export function getDefaultWalletState() {
  return {
    availableBalance: 5000.00,
    dailyProfit: 0.00,
    outOfFunds: 0.00,
    completedOrders: 0,
    testCredit: 10000.00,
    boundMethod: "bKash",
    boundNumber: "45643"
  };
}

let orders100 = JSON.parse(localStorage.getItem(ORDERS_KEY) || "null") || buildInitialOrders100();
let walletState = JSON.parse(localStorage.getItem(WALLET_KEY) || "null") || getDefaultWalletState();

function persistState() {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders100));
  localStorage.setItem(WALLET_KEY, JSON.stringify(walletState));
}

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getActiveUser() {
  const uid = localStorage.getItem(CURRENT_UID_KEY);
  const users = getUsers();
  if (uid && users[uid]) return users[uid];
  return { uid: "2410380", username: "shuvoum", isGuest: true };
}

export function applySiteImagesToDom() {
  const heroEl = document.getElementById("heroSection");
  if (heroEl) {
    const heroSrc = resolveImagePath(siteImages.heroBg, 0);
    heroEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url('${heroSrc}')`;
  }

  const featureImg = document.getElementById("featureJewelImg");
  if (featureImg) {
    const featureSrc = resolveImagePath(siteImages.featureRing, 1);
    featureImg.onerror = function () {
      this.onerror = null;
      this.src = FALLBACK_IMAGES[1];
    };
    featureImg.src = featureSrc;
  }
}

export function initFirebaseSync() {
  // Sync site images from Firebase
  onValue(ref(db, "siteImages"), (snapshot) => {
    if (snapshot.exists()) {
      siteImages = { ...DEFAULT_SITE_IMAGES, ...snapshot.val() };
    } else {
      siteImages = { ...DEFAULT_SITE_IMAGES };
    }
    applySiteImagesToDom();
  });

  // Sync 100 orders from Firebase
  onValue(ref(db, "orders100"), (snapshot) => {
    const val = snapshot.val();
    if (Array.isArray(val) && val.length === 100) {
      orders100 = val;
      persistState();
      renderCurrentOrderCard();
    } else if (val && typeof val === "object") {
      const arr = Object.values(val).filter(Boolean);
      if (arr.length === 100) {
        orders100 = arr.sort((a, b) => a.orderNo - b.orderNo);
        persistState();
        renderCurrentOrderCard();
      }
    }
  });
}

export function renderAllViews() {
  persistState();
  applySiteImagesToDom();

  const user = getActiveUser();
  const uid = localStorage.getItem(CURRENT_UID_KEY);
  const users = getUsers();
  const totalWallet = Number((walletState.availableBalance + walletState.dailyProfit).toFixed(2));

  const headerAuthBtn = document.getElementById("headerAuthBtn");
  if (headerAuthBtn) {
    headerAuthBtn.textContent = (uid && users[uid]) ? `${user.username} (UID:${user.uid})` : "Login / Register";
  }

  const dashUsername = document.getElementById("dashUsername");
  const dashUid = document.getElementById("dashUid");
  if (dashUsername) dashUsername.textContent = user.username;
  if (dashUid) dashUid.textContent = `UID:${user.uid}`;

  const detAvailable = document.getElementById("detAvailable");
  const detProfit = document.getElementById("detProfit");
  const detOutOfFunds = document.getElementById("detOutOfFunds");
  const detOrderProgress = document.getElementById("detOrderProgress");
  const detTestCredit = document.getElementById("detTestCredit");

  if (detAvailable) detAvailable.textContent = walletState.availableBalance.toFixed(2);
  if (detProfit) detProfit.textContent = walletState.dailyProfit.toFixed(2);
  if (detOutOfFunds) detOutOfFunds.textContent = walletState.outOfFunds.toFixed(2);
  if (detOrderProgress) detOrderProgress.textContent = `${walletState.completedOrders} / 100`;
  if (detTestCredit) detTestCredit.textContent = walletState.testCredit.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const payoutWalletFunds = document.getElementById("payoutWalletFunds");
  const payoutMethodLabel = document.getElementById("payoutMethodLabel");
  const payoutNumberLabel = document.getElementById("payoutNumberLabel");
  if (payoutWalletFunds) payoutWalletFunds.textContent = totalWallet.toFixed(2);
  if (payoutMethodLabel) payoutMethodLabel.textContent = walletState.boundMethod || "bKash";
  if (payoutNumberLabel) payoutNumberLabel.textContent = walletState.boundNumber || "45643";

  const currentDispNo = walletState.completedOrders >= 100 ? 100 : walletState.completedOrders + 1;
  const snatchCounterText = document.getElementById("snatchCounterText");
  const snatchAvailText = document.getElementById("snatchAvailText");
  const snatchProfitText = document.getElementById("snatchProfitText");

  if (snatchCounterText) snatchCounterText.textContent = `${currentDispNo} / 100`;
  if (snatchAvailText) snatchAvailText.textContent = walletState.availableBalance.toFixed(2);
  if (snatchProfitText) snatchProfitText.textContent = walletState.dailyProfit.toFixed(2);

  renderCurrentOrderCard();
}

export function renderCurrentOrderCard() {
  const card = document.getElementById("snatchOrderCard");
  if (!card) return;

  if (walletState.completedOrders >= 100) {
    card.innerHTML = `
      <div class="order-badge">Completed (100 / 100)</div>
      <div class="order-title">All 100 Orders Confirmed</div>
      <p style="font-size:13px; color:#444; margin-bottom:14px;">
        Total Discount Profit Earned: <strong>৳${walletState.dailyProfit.toFixed(2)}</strong>
      </p>
      <button type="button" class="btn-primary" onclick="closeSnatchPanel(); openPayOutPanel();">Go to Pay Out</button>
    `;
    return;
  }

  const idx = walletState.completedOrders;
  const item = orders100[idx];
  const imgSrc = resolveImagePath(item.image, idx);
  const fallbackSrc = FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
  const canAfford = walletState.availableBalance >= item.price;

  let customEditorMarkup = "";
  if (!item.isAuto) {
    customEditorMarkup = `
      <div class="custom-editor-box">
        <h4>Customize Order #${item.orderNo} (Name, Image, Price, Discount)</h4>
        <input type="text" id="editName_${item.orderNo}" class="edit-input" value="${item.name}" placeholder="Product Name" />
        <input type="text" id="editImg_${item.orderNo}" class="edit-input" value="${item.image}" placeholder="Image file name (e.g. ring26.jpg)" />
        <div class="edit-grid">
          <input type="number" step="0.01" id="editPrice_${item.orderNo}" class="edit-input" value="${item.price}" placeholder="Price" />
          <input type="number" step="0.01" id="editDiscount_${item.orderNo}" class="edit-input" value="${item.discount}" placeholder="Discount" />
        </div>
        <button type="button" class="btn-save-item" onclick="saveCustomOrder(${item.orderNo})">Save Order #${item.orderNo}</button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="order-badge">Order ${item.orderNo} of 100 (${item.isAuto ? "Auto 1-25" : "Custom 26-100"})</div>
    <img src="${imgSrc}" alt="${item.name}" class="order-img" onerror="this.onerror=null; this.src='${fallbackSrc}';" />
    <div class="order-title">${item.name}</div>
    <div class="order-calc">
      <div><span>Order Price:</span><strong>৳${Number(item.price).toFixed(2)}</strong></div>
      <div><span>Order Discount (Profit):</span><span class="discount-highlight">+৳${Number(item.discount).toFixed(2)}</span></div>
    </div>
    <button type="button" class="btn-primary" onclick="confirmOrder(${item.orderNo})" ${!canAfford ? "disabled" : ""}>
      ${canAfford ? `Confirm Order (${item.orderNo}/100)` : `Insufficient Balance (৳${Number(item.price).toFixed(2)})`}
    </button>
    ${customEditorMarkup}
  `;
}

export function saveCustomOrder(orderNo) {
  const idx = orderNo - 1;
  if (!orders100[idx]) return;

  const nameVal = document.getElementById(`editName_${orderNo}`)?.value.trim();
  const imgVal = document.getElementById(`editImg_${orderNo}`)?.value.trim();
  const priceVal = parseFloat(document.getElementById(`editPrice_${orderNo}`)?.value);
  const discVal = parseFloat(document.getElementById(`editDiscount_${orderNo}`)?.value);

  if (nameVal) orders100[idx].name = nameVal;
  if (imgVal) orders100[idx].image = imgVal;
  if (!isNaN(priceVal) && priceVal >= 0) orders100[idx].price = Number(priceVal.toFixed(2));
  if (!isNaN(discVal) && discVal >= 0) orders100[idx].discount = Number(discVal.toFixed(2));

  renderAllViews();
}

export function confirmOrder(orderNo) {
  if (walletState.completedOrders !== orderNo - 1 || walletState.completedOrders >= 100) return;
  const item = orders100[walletState.completedOrders];
  if (walletState.availableBalance < item.price) return;

  walletState.availableBalance = Number((walletState.availableBalance - item.price).toFixed(2));
  walletState.dailyProfit = Number((walletState.dailyProfit + item.discount).toFixed(2));
  walletState.completedOrders += 1;

  renderAllViews();
}

export function submitPayOut() {
  const totalWallet = Number((walletState.availableBalance + walletState.dailyProfit).toFixed(2));
  const inputEl = document.getElementById("payoutAmountInput");
  const amt = parseFloat(inputEl?.value);

  if (isNaN(amt) || amt <= 0) return;
  if (amt < 500) return alert("Minimum Pay Out ৳500");
  if (amt > totalWallet) return alert("Insufficient Wallet Funds");

  let rem = amt;
  if (walletState.dailyProfit >= rem) {
    walletState.dailyProfit = Number((walletState.dailyProfit - rem).toFixed(2));
  } else {
    rem = Number((rem - walletState.dailyProfit).toFixed(2));
    walletState.dailyProfit = 0;
    walletState.availableBalance = Number((walletState.availableBalance - rem).toFixed(2));
  }

  walletState.outOfFunds = Number((walletState.outOfFunds + amt).toFixed(2));
  if (inputEl) inputEl.value = "";
  renderAllViews();
  alert("Pay Out request submitted.");
}

export function submitBindRequest(e) {
  e.preventDefault();
  const user = getActiveUser();
  const customerName = document.getElementById("bindName")?.value.trim();
  const customerNumber = document.getElementById("bindNumber")?.value.trim();
  const method = document.getElementById("bindMethod")?.value;

  if (!customerName || !customerNumber || !method) return;

  walletState.boundMethod = method;
  walletState.boundNumber = customerNumber;
  renderAllViews();

  set(ref(db, `bindRequests/${user.uid}`), {
    uid: user.uid,
    customerName,
    customerNumber,
    method,
    status: "waiting",
    shopNumber: "",
    transactionType: "",
    updatedAt: Date.now()
  });

  listenBindStatus(user.uid);
}

export function listenBindStatus(uid) {
  onValue(ref(db, `bindRequests/${uid}`), (snapshot) => {
    const data = snapshot.val();
    const card = document.getElementById("bindStatusCard");
    const badgeArea = document.getElementById("statusBadgeArea");
    const instText = document.getElementById("statusInstructionText");
    const shopBox = document.getElementById("shopNumberBox");

    if (!card) return;
    if (!data) {
      card.style.display = "none";
      return;
    }

    card.style.display = "block";
    if (data.shopNumber && data.shopNumber.trim() !== "") {
      badgeArea.innerHTML = `<span class="badge-ready">Shop Details Ready</span>`;
      instText.textContent = "Please use the shop payment details below:";
      shopBox.style.display = "block";
      document.getElementById("resMethod").textContent = data.method;
      document.getElementById("resShopNumber").textContent = data.shopNumber;
      document.getElementById("resTxType").textContent = data.transactionType || "Send Money";
    } else {
      badgeArea.innerHTML = `<span class="badge-wait">Please wait</span>`;
      instText.textContent = "Your request is confirmed. Please wait while admin assigns the shop number and transaction type.";
      shopBox.style.display = "none";
    }
  });
}

export function sendCustomerMessage(e) {
  e.preventDefault();
  const input = document.getElementById("msgInput");
  const text = input?.value.trim();
  if (!text) return;

  const user = getActiveUser();
  const sessionId = "cust_" + user.uid;

  set(push(ref(db, `chats/${sessionId}/messages`)), {
    sender: "customer",
    text,
    timestamp: Date.now()
  });

  update(ref(db, `chats/${sessionId}/meta`), {
    name: `${user.username} (UID:${user.uid})`,
    lastMessage: text,
    unreadByAdmin: true
  });

  input.value = "";
}

export function initChatListener() {
  const user = getActiveUser();
  onValue(ref(db, `chats/cust_${user.uid}/messages`), (snapshot) => {
    const box = document.getElementById("chatMessages");
    if (!box) return;
    box.innerHTML = "";
    const data = snapshot.val();
    if (!data) {
      box.innerHTML = `<div class="msg admin">Welcome to ROYAL SUNSTONE — JEWELS.</div>`;
      return;
    }
    Object.values(data).forEach((m) => {
      const div = document.createElement("div");
      div.className = "msg " + (m.sender === "admin" ? "admin" : "customer");
      div.textContent = m.text;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

export function submitRegister(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim().toLowerCase();
  const password = document.getElementById("regPassword")?.value;
  if (!username || !email || !password) return;

  const uid = String(Math.floor(1000000 + Math.random() * 9000000));
  const users = getUsers();
  users[uid] = { uid, username, email, password };
  saveUsers(users);
  localStorage.setItem(CURRENT_UID_KEY, uid);

  document.getElementById("authModal")?.classList.remove("open");
  renderAllViews();
  initChatListener();
  document.getElementById("profilePanel")?.classList.add("open");
}

export function submitLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById("loginIdentifier")?.value.trim().toLowerCase();
  const password = document.getElementById("loginPassword")?.value;
  const found = Object.values(getUsers()).find(
    (u) => (u.email === identifier || u.username.toLowerCase() === identifier) && u.password === password
  );
  if (!found) return alert("Invalid credentials.");

  localStorage.setItem(CURRENT_UID_KEY, found.uid);
  document.getElementById("authModal")?.classList.remove("open");
  renderAllViews();
  initChatListener();
  document.getElementById("profilePanel")?.classList.add("open");
}

export function signOutUser() {
  localStorage.removeItem(CURRENT_UID_KEY);
  renderAllViews();
  initChatListener();
  document.getElementById("profilePanel")?.classList.remove("open");
}

window.confirmOrder = confirmOrder;
window.saveCustomOrder = saveCustomOrder;
window.submitPayOut = submitPayOut;
window.submitBindRequest = submitBindRequest;
window.sendCustomerMessage = sendCustomerMessage;
window.submitRegister = submitRegister;
window.submitLogin = submitLogin;
window.signOutUser = signOutUser;
window.renderAllViews = renderAllViews;
window.listenBindStatus = listenBindStatus;
window.getActiveUser = getActiveUser;