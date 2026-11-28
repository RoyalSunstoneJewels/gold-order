import { db } from "./firebase-config.js";
import {
  ref,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const TOTAL_SNATCH_ITEMS = 25;

const DEFAULT_PRODUCTS = [
  {
    id: "rs-1",
    name: "7 Three Prong Sunstone Tennis Bracelet In 14K White Gold",
    category: "Bracelets",
    price: 480,
    reward: 18.5,
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
    reward: 14.0,
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
    reward: 21.0,
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
    reward: 17.5,
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
    cta: "SHOP THE COLLECTION →",
    filterCategory: "Necklaces",
    image: "./images/necklace-1.jpg"
  },
  {
    title: "A LUMINOUS EXPRESSION OF DIMENSIONAL FORM",
    subtitle: "WOVEN PAVÉ COLLECTION",
    cta: "SHOP THE COLLECTION →",
    filterCategory: "Rings",
    image: "./images/ring-1.jpg"
  },
  {
    title: "RADIANT SUNSTONE BRILLIANCE",
    subtitle: "LIMITED EDITION SERIES",
    cta: "SHOP THE COLLECTION →",
    filterCategory: "Bracelets",
    image: "./images/bracelet-1.jpg"
  }
];

function build25Queue(baseList) {
  const pool = Array.isArray(baseList) && baseList.length > 0 ? baseList : DEFAULT_PRODUCTS;
  const out = [];
  for (let i = 0; i < TOTAL_SNATCH_ITEMS; i++) {
    const src = pool[i % pool.length];
    out.push({
      queueIndex: i + 1,
      id: `${src.id || "item"}-${i + 1}`,
      name: i < pool.length ? src.name : `${src.name} — Edition #${i + 1}`,
      category: src.category || "Jewelry",
      price: Number(src.price || 450) + (i % 5) * 20,
      reward: Number(src.reward || 15) + (i % 4) * 2.5,
      reviews: src.reviews || `${(1400 + i * 310).toLocaleString()} Reviews`,
      image: src.image || "",
      description: src.description || "Royal Sunstone Jewels fine piece."
    });
  }
  return out;
}

const FALLBACK_IMG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="#efebe3"/>
      <polygon points="300,90 355,165 300,240 245,165" fill="#142238"/>
      <circle cx="300" cy="165" r="22" fill="#c69c53"/>
      <text x="300" y="295" font-family="Georgia, serif" font-size="18" fill="#141414" text-anchor="middle">ROYAL SUNSTONE JEWELS</text>
    </svg>`
  );

const STORAGE_KEY = "royal_sunstone_separate_snatch_v1";

const state = {
  selectedCategory: "All",
  slideIndex: 0,
  pageMode: "main", // "main" | "snatch"
  snatchSubMode: "queue", // "queue" | "payout" | "contact"
  snatchTab: "collection",
  isProcessingOrder: false,
  products: [...DEFAULT_PRODUCTS],
  queue25: build25Queue(DEFAULT_PRODUCTS),
  completedStep: 0,
  dailyProfit: 0,
  outOfFunds: 0,
  testCredit: 10000,
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

function saveLocal() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products: state.products,
        completedStep: state.completedStep,
        dailyProfit: state.dailyProfit,
        outOfFunds: state.outOfFunds,
        testCredit: state.testCredit,
        orders: state.orders,
        history: state.history,
        registeredAccounts: state.registeredAccounts,
        supportConfig: state.supportConfig,
        session: state.session
      })
    );
  } catch (_) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (Array.isArray(p.products) && p.products.length > 0) {
      state.products = p.products;
      state.queue25 = build25Queue(state.products);
    }
    if (typeof p.completedStep === "number") state.completedStep = p.completedStep;
    if (typeof p.dailyProfit === "number") state.dailyProfit = p.dailyProfit;
    if (typeof p.outOfFunds === "number") state.outOfFunds = p.outOfFunds;
    if (typeof p.testCredit === "number") state.testCredit = p.testCredit;
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
  return `+${String(code || "+880").replace(/\D/g, "")}${clean}`;
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

function addHistory(text) {
  state.history.unshift({
    text,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
  state.history = state.history.slice(0, 20);
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
  const bal = Number(state.session.balance || 0);

  setText(
    "statusSummary",
    `${loggedIn ? state.session.fullPhone : "Member: Guest"} • Wallet: ৳ ${bal.toFixed(2)}`
  );
  setText("snatchPageBalance", `৳ ${bal.toFixed(2)}`);

  const snatchBtn = document.getElementById("topSnatchBtn");
  const authBtn = document.getElementById("topAuthBtn");
  if (snatchBtn) snatchBtn.style.display = loggedIn ? "inline-block" : "none";
  setText("snatchBadge", `${state.completedStep} / ${TOTAL_SNATCH_ITEMS}`);
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
    const bal = Number(state.session.balance || 0);
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
      const amt = Number(document.getElementById("pagePayOutAmt").value || 0);
      if (amt < 500) return showToast("Minimum Pay Out is ৳500.");
      if (amt > Number(state.session.balance || 0)) return showToast("Insufficient Wallet Funds.");
      state.session.balance = Number(state.session.balance) - amt;
      state.outOfFunds = Number(state.outOfFunds || 0) + amt;
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

  /* Default Snatch Queue View */
  const nextStep = Math.min(TOTAL_SNATCH_ITEMS, state.completedStep + 1);
  const visibleItems = state.queue25.slice(0, 5);

  body.innerHTML = `
    <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Home &gt; Snatch Orders</div>
    <h1 style="font-size:28px; font-weight:800; color:#111827; margin-bottom:14px;">Royal Sunstone Order</h1>

    <div class="tab-strip">
      <button type="button" class="tab-btn ${state.snatchTab === "collection" ? "active" : ""}" id="sTabCol">
        Collection (25)
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
                    &#9733; ${escapeHtml(item.reviews)} &bull; $${Number(item.price).toFixed(2)}
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
      Queue progress: <strong>${state.completedStep} / ${TOTAL_SNATCH_ITEMS}</strong> confirmed. Tap <strong>Start ${nextStep} / 25</strong> to run animation &amp; confirm.
    </div>

    <div class="action-pair">
      <button type="button" class="btn btn-purple" id="sAccBtn">Account Details</button>
      <button type="button" class="btn btn-purple" id="sRecBtn">Order Record</button>
    </div>

    <button
      type="button"
      class="start-batch-btn"
      id="sStartBtn"
      ${state.completedStep >= TOTAL_SNATCH_ITEMS || state.isProcessingOrder ? "disabled" : ""}
    >
      ${state.completedStep >= TOTAL_SNATCH_ITEMS ? "Completed 25 / 25" : `Start ${nextStep} / ${TOTAL_SNATCH_ITEMS}`}
    </button>
  `;

  document.getElementById("sTabCol")?.addEventListener("click", () => {
    state.snatchTab = "collection";
    renderSnatchDedicatedPage();
  });
  document.getElementById("sTabDesc")?.addEventListener("click", () => {
    state.snatchTab = "description";
    renderSnatchDedicatedPage();
    showToast("Showing 25-item jewelry order queue.");
  });
  document.getElementById("sAccBtn")?.addEventListener("click", openAccountDetailsModal);
  document.getElementById("sRecBtn")?.addEventListener("click", openOrderRecordModal);
  document.getElementById("sStartBtn")?.addEventListener("click", runAnimatedOrderConfirmation);
}

/* Two-stage animation (Image 1 Digging Order -> Image 2 Luxury Splash -> Confirm) */
function runAnimatedOrderConfirmation() {
  if (!state.session.loggedIn) {
    openPhoneAuthModal();
    return;
  }
  if (state.isProcessingOrder || state.completedStep >= TOTAL_SNATCH_ITEMS) return;

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

      const nextStep = state.completedStep + 1;
      const item = state.queue25[nextStep - 1] || DEFAULT_PRODUCTS[0];
      const rewardAmt = Number(item.reward || 15);

      state.completedStep = nextStep;
      state.session.balance = Number(state.session.balance || 0) + rewardAmt;
      state.dailyProfit = Number(state.dailyProfit || 0) + rewardAmt;

      const ord = {
        step: nextStep,
        itemName: item.name,
        price: Number(item.price || 450),
        reward: rewardAmt,
        fullPhone: state.session.fullPhone,
        status: "Confirmed",
        createdAt: new Date().toISOString()
      };
      state.orders.unshift(ord);
      addHistory(`Confirmed #${nextStep}/25 (+৳${rewardAmt.toFixed(2)})`);

      state.isProcessingOrder = false;
      saveLocal();
      renderTopAndDrawer();
      renderSnatchDedicatedPage();
      showToast(`Order ${nextStep} / 25 Confirmed! (+৳${rewardAmt.toFixed(2)})`);

      push(ref(db, "orders"), ord).catch(() => {});
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
    const acc = state.registeredAccounts[fullPhone];
    if (!isReg && acc && acc.password !== pass) {
      showToast("Incorrect password.");
      return;
    }
    state.registeredAccounts[fullPhone] = {
      fullPhone,
      password: pass,
      balance: acc?.balance ?? state.session.balance
    };
    state.session.loggedIn = true;
    state.session.countryCode = code;
    state.session.phone = normalizePhone(phone);
    state.session.fullPhone = fullPhone;
    state.session.balance = state.registeredAccounts[fullPhone].balance;

    addHistory(`${isReg ? "Register" : "Login"}: ${fullPhone}`);
    saveLocal();
    renderTopAndDrawer();
    closeModal();
    switchToSnatchPage("queue");
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
  const bal = Number(state.session.balance || 0);
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
          <div style="font-size:17px; font-weight:700;">${Number(state.dailyProfit || 0).toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Out of funds</div>
          <div style="font-size:17px; font-weight:700;">${Number(state.outOfFunds || 0).toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Current Digging Order</div>
          <div style="font-size:17px; font-weight:700;">${state.completedStep} / ${TOTAL_SNATCH_ITEMS}</div>
        </div>
        <div>
          <div style="font-size:12px; color:#4b5563;">Test Credit</div>
          <div style="font-size:17px; font-weight:700;">${Number(state.testCredit || 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
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
              <div style="font-size:12px; color:#4b5563;">Confirmed &bull; Reward: +৳${Number(o.reward).toFixed(2)} &bull; $${Number(o.price).toFixed(2)}</div>
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
      state.session.loggedIn = false;
      switchToMainPage();
      saveLocal();
      renderTopAndDrawer();
      showToast("Logged out.");
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

  /* Drawer actions */
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
    state.session.balance = Number(state.session.balance || 0) + 10;
    state.dailyProfit = Number(state.dailyProfit || 0) + 10;
    addHistory("Check In +৳10.00");
    saveLocal();
    renderTopAndDrawer();
    showToast("Daily check-in claimed (+৳10.00)");
  });

  document.getElementById("changePassForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = document.getElementById("newPassField").value;
    if (state.session.fullPhone && state.registeredAccounts[state.session.fullPhone]) {
      state.registeredAccounts[state.session.fullPhone].password = p;
    }
    e.target.reset();
    addHistory("Password changed");
    saveLocal();
    showToast("Password updated.");
  });

  document.getElementById("drawerSignOutBtn")?.addEventListener("click", () => {
    closeDrawer();
    state.session.loggedIn = false;
    switchToMainPage();
    saveLocal();
    renderTopAndDrawer();
    showToast("Signed out.");
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
        state.queue25 = build25Queue(state.products);
        saveLocal();
        renderMainSections();
        if (state.pageMode === "snatch") renderSnatchDedicatedPage();
      }
    });
  } catch (_) {}
}