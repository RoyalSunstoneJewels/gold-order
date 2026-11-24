import { db } from "./firebase-config.js";
import {
  ref,
  set,
  push,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const TOTAL_SNATCH_ITEMS = 25;

const DEFAULT_PRODUCTS = [
  {
    id: "rs-01",
    name: "7 Three Prong Sunstone Tennis Bracelet In 14K White Gold",
    category: "Bracelets",
    price: 480,
    reward: 18.5,
    reviews: "2,507 Reviews",
    image: "./images/bracelet-1.jpg",
    description: "Hand-set sunstones in a 14K white gold tennis setting."
  },
  {
    id: "rs-02",
    name: "Imperial Sunstone & Round Bezel Earrings in 14K Yellow Gold",
    category: "Earrings",
    price: 540,
    reward: 21.0,
    reviews: "17,362 Reviews",
    image: "./images/earrings-1.jpg",
    description: "Warm golden sunstones with fine bezel detailing in 14K yellow gold."
  },
  {
    id: "rs-03",
    name: "Oval Cut Sunstone & Alternating Bracelet In 14K White Gold",
    category: "Bracelets",
    price: 620,
    reward: 24.0,
    reviews: "14,853 Reviews",
    image: "./images/bracelet-2.jpg",
    description: "Oval cut sunstones crafted for fluid brilliance."
  },
  {
    id: "rs-04",
    name: "Royal Sunstone & Pave Stud Earrings In 14K White Gold",
    category: "Earrings",
    price: 390,
    reward: 15.0,
    reviews: "6,477 Reviews",
    image: "./images/earrings-2.jpg",
    description: "Radiant sunstone stud earrings with crisp finish."
  },
  {
    id: "rs-05",
    name: "Dot Dash Sunstone Ring in 14k Yellow Gold",
    category: "Rings",
    price: 450,
    reward: 17.5,
    reviews: "11,348 Reviews",
    image: "./images/ring-1.jpg",
    description: "Geometric sunstone ring in 14k yellow gold."
  }
];

function build25QueueItems(baseList) {
  const pool = Array.isArray(baseList) && baseList.length > 0 ? baseList : DEFAULT_PRODUCTS;
  const items = [];
  for (let i = 0; i < TOTAL_SNATCH_ITEMS; i++) {
    const src = pool[i % pool.length];
    items.push({
      queueIndex: i + 1,
      id: `${src.id || "item"}-${i + 1}`,
      name: i < pool.length ? src.name : `${src.name} — Edition #${i + 1}`,
      category: src.category || "Jewelry",
      price: Number(src.price || 450) + (i % 5) * 20,
      reward: Number(src.reward || 15) + (i % 4) * 2.5,
      reviews: src.reviews || `${(1200 + i * 340).toLocaleString()} Reviews`,
      image: src.image || "",
      description: src.description || "Authentic Royal Sunstone Jewels crafted piece."
    });
  }
  return items;
}

const FALLBACK_SVG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#f3efe8"/>
      <polygon points="200,75 245,135 200,195 155,135" fill="#5a0710"/>
      <circle cx="200" cy="135" r="18" fill="#c69c53"/>
      <text x="200" y="235" font-family="Georgia, serif" font-size="16" fill="#142238" text-anchor="middle">ROYAL SUNSTONE JEWELS</text>
    </svg>`
  );

const STORAGE_KEY = "royal_sunstone_full_suite_v1";

const state = {
  selectedCategory: "All",
  activeView: null, // null | "payOutView" | "contactUsView" | "snatchWorkspace"
  snatchTab: "collection",
  products: [...DEFAULT_PRODUCTS],
  queue25: build25QueueItems(DEFAULT_PRODUCTS),
  completedStep: 0,
  dailyProfit: 0,
  testCredit: 10000,
  outOfFunds: 0,
  orders: [],
  history: [],
  registeredAccounts: {},
  supportConfig: {
    telegramUrl: "https://t.me/royalsunstone_support",
    whatsappNumber: "8801700000000"
  },
  session: {
    loggedIn: false,
    name: "shuvoum",
    uid: "UID:2410380",
    countryCode: "+880",
    phone: "",
    fullPhone: "",
    balance: 698.34,
    bindMethod: "bkash",
    bindAddress: "45643"
  }
};

function saveLocalState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products: state.products,
        completedStep: state.completedStep,
        dailyProfit: state.dailyProfit,
        testCredit: state.testCredit,
        outOfFunds: state.outOfFunds,
        orders: state.orders,
        history: state.history,
        registeredAccounts: state.registeredAccounts,
        supportConfig: state.supportConfig,
        session: state.session
      })
    );
  } catch (_) {}
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (Array.isArray(p.products) && p.products.length > 0) {
      state.products = p.products;
      state.queue25 = build25QueueItems(state.products);
    }
    if (typeof p.completedStep === "number") state.completedStep = p.completedStep;
    if (typeof p.dailyProfit === "number") state.dailyProfit = p.dailyProfit;
    if (typeof p.testCredit === "number") state.testCredit = p.testCredit;
    if (typeof p.outOfFunds === "number") state.outOfFunds = p.outOfFunds;
    if (Array.isArray(p.orders)) state.orders = p.orders;
    if (Array.isArray(p.history)) state.history = p.history;
    if (p.registeredAccounts && typeof p.registeredAccounts === "object") {
      state.registeredAccounts = p.registeredAccounts;
    }
    if (p.supportConfig && typeof p.supportConfig === "object") {
      state.supportConfig = { ...state.supportConfig, ...p.supportConfig };
    }
    if (p.session && typeof p.session === "object") {
      state.session = { ...state.session, ...p.session };
    }
  } catch (_) {}
}

function normalizePhone(raw) {
  return String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
}

function buildFullPhone(code, raw) {
  const clean = normalizePhone(raw);
  if (!clean) return "";
  const digits = String(code || "+880").replace(/\D/g, "");
  return `+${digits}${clean}`;
}

function showToast(msg) {
  const el = document.getElementById("toastBox");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2800);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(val);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function addHistoryEntry(label) {
  state.history.unshift({
    label,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
  state.history = state.history.slice(0, 20);
}

function openFeatureView(viewId) {
  state.activeView = viewId;
  ["payOutView", "contactUsView", "snatchWorkspace"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("active", id === viewId);
  });
  document.getElementById(viewId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeFeatureView(viewId) {
  if (state.activeView === viewId) state.activeView = null;
  document.getElementById(viewId)?.classList.remove("active");
}

function renderDrawerAndStats() {
  const loggedIn = Boolean(state.session.loggedIn);
  const bal = Number(state.session.balance || 0);

  setText("drawerUserName", loggedIn ? state.session.fullPhone : state.session.name || "shuvoum");
  setText("drawerUserUid", state.session.uid || "UID:2410380");

  setText("heroBalanceText", `৳ ${bal.toFixed(2)}`);
  setText("heroOrderStepText", `${state.completedStep} / ${TOTAL_SNATCH_ITEMS}`);
  setText("heroProfitText", Number(state.dailyProfit || 0).toFixed(2));
  setText("heroMemberText", loggedIn ? state.session.fullPhone : "Guest");

  setText("payoutWalletAmount", `৳ ${bal.toFixed(2)}`);
  setText("boundMethodLabel", state.session.bindMethod || "bkash");
  setText("boundAddressLabel", state.session.bindAddress || "45643");

  const headerSnatchBtn = document.getElementById("headerSnatchBtn");
  const authActionBtn = document.getElementById("authActionBtn");
  const heroPrimaryBtn = document.getElementById("heroPrimaryBtn");

  if (headerSnatchBtn) headerSnatchBtn.style.display = loggedIn ? "inline-flex" : "none";
  setText("snatchProgressBadge", `${state.completedStep} / ${TOTAL_SNATCH_ITEMS}`);

  if (authActionBtn) authActionBtn.textContent = loggedIn ? "Logout" : "Login / Register";
  if (heroPrimaryBtn) {
    heroPrimaryBtn.textContent = loggedIn
      ? `Open Snatch Orders (${state.completedStep} / ${TOTAL_SNATCH_ITEMS})`
      : "Login with Phone";
  }

  const histEl = document.getElementById("drawerHistoryContent");
  if (histEl) {
    histEl.innerHTML = state.history.length
      ? state.history
          .map((h) => `<div style="padding:4px 0; border-bottom:1px dashed #e5e7eb;">${escapeHtml(h.label)} <span style="color:#6b7280;">(${escapeHtml(h.time)})</span></div>`)
          .join("")
      : "No activity recorded yet.";
  }

  const cleanWa = String(state.supportConfig.whatsappNumber || "").replace(/\D/g, "");
  setText(
    "contactMetaHint",
    `Telegram: ${state.supportConfig.telegramUrl || "Not set"} • WhatsApp: +${cleanWa || "Not set"}`
  );
}

function renderShowcaseProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const filtered =
    state.selectedCategory === "All"
      ? state.products
      : state.products.filter((p) => p.category === state.selectedCategory);

  grid.innerHTML = filtered
    .map((item) => {
      const img = item.image || FALLBACK_SVG;
      return `
        <article class="card">
          <img
            src="${img}"
            alt="${escapeHtml(item.name)}"
            class="card-img"
            onerror="this.onerror=null;this.src='${FALLBACK_SVG}';"
          />
          <div class="card-body">
            <span class="badge">${escapeHtml(item.category || "Jewelry")}</span>
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <p class="card-desc">${escapeHtml(item.description || "")}</p>
            <div class="price-row">
              <span class="price">$${Number(item.price || 0).toFixed(2)}</span>
              <span class="reward">+৳${Number(item.reward || 0).toFixed(2)} Reward</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSnatchWorkspace() {
  const listEl = document.getElementById("snatchQueueList");
  const startBtn = document.getElementById("startBatchBtn");
  const tabCol = document.getElementById("tabCollectionBtn");
  const tabDesc = document.getElementById("tabDescriptionBtn");

  if (tabCol) tabCol.classList.toggle("active", state.snatchTab === "collection");
  if (tabDesc) tabDesc.classList.toggle("active", state.snatchTab === "description");

  const nextStep = Math.min(TOTAL_SNATCH_ITEMS, state.completedStep + 1);
  if (startBtn) {
    if (state.completedStep >= TOTAL_SNATCH_ITEMS) {
      startBtn.disabled = true;
      startBtn.textContent = "Completed 25 / 25";
    } else {
      startBtn.disabled = false;
      startBtn.innerHTML = `Start <span id="startCurrentStep">${nextStep}</span> / ${TOTAL_SNATCH_ITEMS}`;
    }
  }

  if (!listEl) return;

  const visible = state.queue25.slice(0, 5);
  listEl.innerHTML =
    visible
      .map((item) => {
        const img = item.image || FALLBACK_SVG;
        const done = item.queueIndex <= state.completedStep;
        return `
          <div class="queue-row">
            <div class="queue-left">
              <span class="queue-num">${item.queueIndex}</span>
              <img
                src="${img}"
                alt="${escapeHtml(item.name)}"
                class="queue-thumb"
                onerror="this.onerror=null;this.src='${FALLBACK_SVG}';"
              />
              <div>
                <div style="font-size:15px; font-weight:700; color:#111827;">${escapeHtml(item.name)}</div>
                <div style="font-size:13px; color:#4b5563; margin-top:3px;">
                  &#9733; ${escapeHtml(item.reviews)} &bull; $${Number(item.price).toFixed(2)}
                  ${done ? ` &bull; <strong style="color:#15803d;">Completed</strong>` : ""}
                </div>
              </div>
            </div>
            <span style="font-size:20px; color:#6b7280;">&rsaquo;</span>
          </div>
        `;
      })
      .join("") +
    `<div style="padding:12px 8px; font-size:13px; color:#4b5563; background:#f9fafb; border-bottom:1px solid #eceef2;">
      Showing 5 of <strong>25</strong> queue items. Tap <strong>Start ${nextStep} / 25</strong> to process sequentially.
    </div>`;
}

function openModalBox(innerHtml) {
  const backdrop = document.getElementById("appModal");
  const box = document.getElementById("modalBox");
  if (!backdrop || !box) return;
  box.innerHTML = innerHtml;
  backdrop.classList.add("open");
}

function closeModalBox() {
  document.getElementById("appModal")?.classList.remove("open");
}

/* Phone Login & Register Popup */
function openPhoneAuthModal() {
  openModalBox(`
    <div class="modal-banner-header" style="background:#fff; border-bottom:1px solid #e5e7eb;">
      <h3 style="font-size:22px; color:#111827;">Login</h3>
      <button type="button" class="close-btn" id="closeModalX">&times;</button>
    </div>
    <div class="modal-body-pad">
      <form id="phoneLoginForm">
        <div class="form-group">
          <label for="loginPhone">Phone</label>
          <div class="phone-row">
            <select id="loginCode" class="phone-code">
              <option value="+880" selected>BAN (+88</option>
              <option value="+91">IND (+91</option>
              <option value="+1">USA (+1</option>
            </select>
            <input type="tel" id="loginPhone" class="phone-input" required placeholder="1XXXXXXXXX" />
          </div>
        </div>
        <div class="form-group">
          <label for="loginPass">Password</label>
          <input type="password" id="loginPass" class="input" required placeholder="Enter password" />
        </div>
        <button type="submit" class="btn btn-navy" style="width:100%; padding:13px; font-size:15px;">
          Sign In
        </button>
      </form>

      <div style="border-top:1px solid #e5e7eb; margin-top:20px; padding-top:16px;">
        <div style="font-weight:700; font-size:15px; margin-bottom:6px;">Don't have an account?</div>
        <p class="section-sub" style="margin-bottom:12px;">Register with your mobile number to continue.</p>
        <form id="phoneRegForm">
          <div class="form-group">
            <label for="regPhone">Mobile Number</label>
            <div class="phone-row">
              <select id="regCode" class="phone-code">
                <option value="+880" selected>BAN (+88</option>
                <option value="+91">IND (+91</option>
                <option value="+1">USA (+1</option>
              </select>
              <input type="tel" id="regPhone" class="phone-input" required placeholder="1XXXXXXXXX" />
            </div>
          </div>
          <div class="form-group">
            <label for="regPass">Password</label>
            <input type="password" id="regPass" class="input" required minlength="6" placeholder="Min 6 characters" />
          </div>
          <button type="submit" class="btn btn-outline" style="width:100%; padding:12px; border:2px solid #111827;">
            Register
          </button>
        </form>
      </div>
    </div>
  `);

  document.getElementById("closeModalX")?.addEventListener("click", closeModalBox);

  document.getElementById("phoneLoginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("loginCode").value;
    const phone = document.getElementById("loginPhone").value;
    const pass = document.getElementById("loginPass").value;
    const fullPhone = buildFullPhone(code, phone);
    if (!fullPhone || !pass) return;

    const acc = state.registeredAccounts[fullPhone];
    if (acc && acc.password !== pass) {
      showToast("Incorrect password.");
      return;
    }

    state.session.loggedIn = true;
    state.session.countryCode = code;
    state.session.phone = normalizePhone(phone);
    state.session.fullPhone = fullPhone;
    state.session.balance = acc?.balance ?? state.session.balance;

    if (!acc) {
      state.registeredAccounts[fullPhone] = {
        fullPhone,
        password: pass,
        balance: state.session.balance
      };
    }

    addHistoryEntry(`Logged in: ${fullPhone}`);
    saveLocalState();
    renderAllViews();
    closeModalBox();
    showToast(`Logged in with ${fullPhone}`);
  });

  document.getElementById("phoneRegForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("regCode").value;
    const phone = document.getElementById("regPhone").value;
    const pass = document.getElementById("regPass").value;
    const fullPhone = buildFullPhone(code, phone);
    if (!fullPhone || pass.length < 6) return;

    state.registeredAccounts[fullPhone] = {
      fullPhone,
      password: pass,
      balance: state.session.balance
    };
    state.session.loggedIn = true;
    state.session.countryCode = code;
    state.session.phone = normalizePhone(phone);
    state.session.fullPhone = fullPhone;

    addHistoryEntry(`Registered: ${fullPhone}`);
    saveLocalState();
    renderAllViews();
    closeModalBox();
    showToast(`Registered ${fullPhone}`);
  });
}

/* Account Details Modal matching Image 4 */
function openAccountDetailsModal() {
  const bal = Number(state.session.balance || 0);
  openModalBox(`
    <div class="modal-banner-header">
      <h3 style="font-size:20px; font-weight:700; color:#111827; margin:0 auto;">Account Details</h3>
      <button type="button" class="close-btn" id="closeModalX">&times;</button>
    </div>
    <div class="modal-body-pad">
      <div class="account-metrics-grid">
        <div>
          <div class="metric-title">Available Balance</div>
          <div class="metric-val">${bal.toFixed(2)}</div>
        </div>
        <div>
          <div class="metric-title">Daily Profit</div>
          <div class="metric-val">${Number(state.dailyProfit || 0).toFixed(2)}</div>
        </div>
        <div>
          <div class="metric-title">Out of funds</div>
          <div class="metric-val">${Number(state.outOfFunds || 0).toFixed(2)}</div>
        </div>
        <div>
          <div class="metric-title">Current Digging Order</div>
          <div class="metric-val">${state.completedStep} / ${TOTAL_SNATCH_ITEMS}</div>
        </div>
        <div>
          <div class="metric-title">Test Credit</div>
          <div class="metric-val">${Number(state.testCredit || 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <button type="button" class="btn btn-navy" id="closeAccountModalBtn" style="width:100%; padding:13px; font-size:16px;">
        Close
      </button>
    </div>
  `);

  document.getElementById("closeModalX")?.addEventListener("click", closeModalBox);
  document.getElementById("closeAccountModalBtn")?.addEventListener("click", closeModalBox);
}

function openOrderRecordModal() {
  const listHtml = state.orders.length
    ? state.orders
        .map(
          (o) => `
            <div style="border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; margin-bottom:8px; background:#faf8f5;">
              <div style="font-weight:700; font-size:13px;">#${escapeHtml(o.step)} ${escapeHtml(o.itemName)}</div>
              <div style="font-size:12px; color:#4b5563;">Reward: +৳${Number(o.reward).toFixed(2)} &bull; $${Number(o.price).toFixed(2)}</div>
            </div>
          `
        )
        .join("")
    : `<p class="section-sub">No orders processed yet.</p>`;

  openModalBox(`
    <div class="modal-banner-header">
      <h3 style="font-size:19px; font-weight:700; color:#111827; margin:0 auto;">Order Record</h3>
      <button type="button" class="close-btn" id="closeModalX">&times;</button>
    </div>
    <div class="modal-body-pad" style="max-height:380px; overflow-y:auto;">
      ${listHtml}
      <button type="button" class="btn btn-navy" id="closeRecBtn" style="width:100%; margin-top:12px;">Close</button>
    </div>
  `);

  document.getElementById("closeModalX")?.addEventListener("click", closeModalBox);
  document.getElementById("closeRecBtn")?.addEventListener("click", closeModalBox);
}

function requireLoginThen(actionFn) {
  if (!state.session.loggedIn) {
    openPhoneAuthModal();
    return false;
  }
  actionFn();
  return true;
}

function bindUIEvents() {
  if (bindUIEvents._bound) return;
  bindUIEvents._bound = true;

  loadLocalState();

  const drawer = document.getElementById("sideDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  const openDrawer = () => {
    drawer?.classList.add("open");
    backdrop?.classList.add("open");
  };
  const closeDrawer = () => {
    drawer?.classList.remove("open");
    backdrop?.classList.remove("open");
  };

  document.getElementById("menuToggleBtn")?.addEventListener("click", openDrawer);
  document.getElementById("closeDrawerBtn")?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);

  document.getElementById("brandHomeBtn")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.querySelectorAll("[data-scroll]").forEach((el) => {
    el.addEventListener("click", () => {
      closeDrawer();
      document.getElementById(el.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-close-view]").forEach((btn) => {
    btn.addEventListener("click", () => closeFeatureView(btn.dataset.closeView));
  });

  document.querySelectorAll("#categoryFilters .filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#categoryFilters .filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.selectedCategory = pill.dataset.cat || "All";
      renderShowcaseProducts();
    });
  });

  /* Drawer quick actions */
  document.getElementById("drawerBuyInBtn")?.addEventListener("click", () => {
    closeDrawer();
    requireLoginThen(() => openFeatureView("snatchWorkspace"));
  });

  document.getElementById("drawerPayOutTile")?.addEventListener("click", () => {
    closeDrawer();
    requireLoginThen(() => openFeatureView("payOutView"));
  });

  document.getElementById("drawerContactTile")?.addEventListener("click", () => {
    closeDrawer();
    openFeatureView("contactUsView");
  });

  document.getElementById("drawerAccountTile")?.addEventListener("click", () => {
    closeDrawer();
    requireLoginThen(() => openAccountDetailsModal());
  });

  /* Drawer accordion rows */
  document.querySelectorAll(".menu-row-btn[data-acc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(`acc-${btn.dataset.acc}`);
      if (panel) panel.classList.toggle("open");
    });
  });

  document.getElementById("bindAccountForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.session.bindMethod = document.getElementById("bindMethod").value;
    state.session.bindAddress = document.getElementById("bindNumber").value.trim();
    addHistoryEntry(`Bound ${state.session.bindMethod}: ${state.session.bindAddress}`);
    saveLocalState();
    renderDrawerAndStats();
    showToast("Collection address updated.");
  });

  document.getElementById("dailyCheckInBtn")?.addEventListener("click", () => {
    state.session.balance = Number(state.session.balance || 0) + 10;
    state.dailyProfit = Number(state.dailyProfit || 0) + 10;
    addHistoryEntry("Daily check-in +৳10.00");
    saveLocalState();
    renderDrawerAndStats();
    showToast("Daily check-in claimed (+৳10.00)");
  });

  document.getElementById("changePasswordForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const newPass = document.getElementById("newPassInput").value;
    if (state.session.fullPhone && state.registeredAccounts[state.session.fullPhone]) {
      state.registeredAccounts[state.session.fullPhone].password = newPass;
    }
    e.target.reset();
    addHistoryEntry("Password updated");
    saveLocalState();
    showToast("Password changed.");
  });

  const handleSignOut = () => {
    state.session.loggedIn = false;
    closeFeatureView("snatchWorkspace");
    closeFeatureView("payOutView");
    saveLocalState();
    renderAllViews();
    showToast("Signed out.");
  };

  document.getElementById("drawerSignOutBtn")?.addEventListener("click", () => {
    closeDrawer();
    handleSignOut();
  });

  document.getElementById("authActionBtn")?.addEventListener("click", () => {
    if (state.session.loggedIn) {
      handleSignOut();
    } else {
      openPhoneAuthModal();
    }
  });

  document.getElementById("heroPrimaryBtn")?.addEventListener("click", () => {
    if (state.session.loggedIn) {
      openFeatureView("snatchWorkspace");
    } else {
      openPhoneAuthModal();
    }
  });

  document.getElementById("navSnatchBtn")?.addEventListener("click", () => {
    requireLoginThen(() => openFeatureView("snatchWorkspace"));
  });

  document.getElementById("headerSnatchBtn")?.addEventListener("click", () => {
    requireLoginThen(() => openFeatureView("snatchWorkspace"));
  });

  document.getElementById("navContactBtn")?.addEventListener("click", () => {
    openFeatureView("contactUsView");
  });

  /* Contact Us Telegram & WhatsApp (from Control Panel config) */
  document.getElementById("telegramContactBtn")?.addEventListener("click", () => {
    const url = state.supportConfig.telegramUrl || "https://t.me/royalsunstone_support";
    window.open(url, "_blank", "noopener,noreferrer");
  });

  document.getElementById("whatsappContactBtn")?.addEventListener("click", () => {
    const num = String(state.supportConfig.whatsappNumber || "8801700000000").replace(/\D/g, "");
    window.open(`https://wa.me/${num}`, "_blank", "noopener,noreferrer");
  });

  /* Pay Out submission */
  document.getElementById("payOutForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.session.loggedIn) {
      openPhoneAuthModal();
      return;
    }

    const amount = Number(document.getElementById("payOutAmountInput").value || 0);
    if (amount < 500) {
      showToast("Minimum Pay Out is ৳500.");
      return;
    }
    if (amount > Number(state.session.balance || 0)) {
      showToast("Insufficient Wallet Funds.");
      return;
    }

    state.session.balance = Number(state.session.balance) - amount;
    state.outOfFunds = Number(state.outOfFunds || 0) + amount;
    addHistoryEntry(`Pay Out request: ৳${amount.toFixed(2)}`);
    document.getElementById("payOutAmountInput").value = "";

    saveLocalState();
    renderDrawerAndStats();
    showToast(`Pay Out of ৳${amount.toFixed(2)} submitted.`);

    push(ref(db, "payouts"), {
      fullPhone: state.session.fullPhone,
      method: state.session.bindMethod,
      address: state.session.bindAddress,
      amount,
      createdAt: new Date().toISOString()
    }).catch(() => {});
  });

  /* Snatch 25 controls */
  document.querySelectorAll("[data-snatch-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.snatchTab = btn.dataset.snatchTab || "collection";
      renderSnatchWorkspace();
    });
  });

  document.getElementById("snatchAccountDetailsBtn")?.addEventListener("click", openAccountDetailsModal);
  document.getElementById("snatchOrderRecordBtn")?.addEventListener("click", openOrderRecordModal);

  document.getElementById("startBatchBtn")?.addEventListener("click", () => {
    if (!state.session.loggedIn) {
      openPhoneAuthModal();
      return;
    }
    if (state.completedStep >= TOTAL_SNATCH_ITEMS) return;

    const nextStep = state.completedStep + 1;
    const item = state.queue25[nextStep - 1] || DEFAULT_PRODUCTS[0];

    state.completedStep = nextStep;
    state.session.balance = Number(state.session.balance || 0) + Number(item.reward || 15);
    state.dailyProfit = Number(state.dailyProfit || 0) + Number(item.reward || 15);

    const ord = {
      id: `ORD-${Date.now()}-${nextStep}`,
      step: nextStep,
      itemName: item.name,
      price: Number(item.price || 450),
      reward: Number(item.reward || 15),
      fullPhone: state.session.fullPhone,
      createdAt: new Date().toISOString()
    };

    state.orders.unshift(ord);
    addHistoryEntry(`Order ${nextStep}/25 (+৳${ord.reward.toFixed(2)})`);
    saveLocalState();
    renderAllViews();
    showToast(`Order ${nextStep} / 25 completed (+৳${ord.reward.toFixed(2)})`);

    push(ref(db, "orders"), ord).catch(() => {});
  });

  document.getElementById("appModal")?.addEventListener("click", (e) => {
    if (e.target.id === "appModal") closeModalBox();
  });
}

export function renderAllViews() {
  bindUIEvents();
  renderDrawerAndStats();
  renderShowcaseProducts();
  renderSnatchWorkspace();
}

export function initChatListener() {}

export function initFirebaseSync() {
  const statusEl = document.getElementById("syncStatusText");

  try {
    onValue(
      ref(db, "support_config"),
      (snap) => {
        if (!snap.exists()) return;
        const cfg = snap.val();
        state.supportConfig = {
          telegramUrl: cfg.telegramUrl || state.supportConfig.telegramUrl,
          whatsappNumber: cfg.whatsappNumber || state.supportConfig.whatsappNumber
        };
        saveLocalState();
        renderDrawerAndStats();
      },
      () => {}
    );

    onValue(
      ref(db, "products"),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.val();
          const list = Array.isArray(raw)
            ? raw.filter(Boolean)
            : Object.entries(raw).map(([id, item]) => ({ id, ...item }));
          if (list.length > 0) {
            state.products = list;
            state.queue25 = build25QueueItems(state.products);
            saveLocalState();
            renderShowcaseProducts();
            renderSnatchWorkspace();
          }
        }
        if (statusEl) statusEl.textContent = "Catalog synced";
      },
      () => {
        if (statusEl) statusEl.textContent = "Catalog ready";
      }
    );
  } catch (_) {}
}