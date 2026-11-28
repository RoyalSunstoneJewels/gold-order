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

function createFreshUserProfile(fullPhone, password, startingBalance = NEW_USER_STARTING_BALANCE) {
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

function syncCurrentProfileToState() {
  const fullPhone = state.session.fullPhone;
  if (!fullPhone || !state.userProfilesMap[fullPhone]) {
    state.completedStep = 0;
    state.dailyProfit = 0;
    state.outOfFunds = 0;
    state.testCredit = 10000;
    state.orders = [];
    state.history = [];
    state.session.balance = NEW_USER_STARTING_BALANCE;
    applyUserOrderAssignment();
    return;
  }

  const prof = state.userProfilesMap[fullPhone];
  state.session.balance = roundMoney(prof.balance || 0);
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

function persistStateToCurrentProfile() {
  const fullPhone = state.session.fullPhone;
  if (!fullPhone || !state.userProfilesMap[fullPhone]) return;
  state.userProfilesMap[fullPhone] = {
    ...state.userProfilesMap[fullPhone],
    fullPhone,
    balance: roundMoney(state.session.balance || 0),
    bindMethod: state.session.bindMethod || "bkash",
    bindAddress: state.session.bindAddress || "45643",
    completedStep: state.completedStep,
    dailyProfit: roundMoney(state.dailyProfit || 0),
    outOfFunds: roundMoney(state.outOfFunds || 0),
    testCredit: roundMoney(state.testCredit ?? 10000),
    orders: state.orders,
    history: state.history
  };
}

function saveLocal() {
  persistStateToCurrentProfile();
  try {
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
    if (!raw) return;
    const p = JSON.parse(raw);
    if (Array.isArray(p.products) && p.products.length > 0) state.products = p.products;
    if (p.assignedOrdersMap && typeof p.assignedOrdersMap === "object") state.assignedOrdersMap = p.assignedOrdersMap;
    if (p.userProfilesMap && typeof p.userProfilesMap === "object") state.userProfilesMap = p.userProfilesMap;
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
    if (state.session.loggedIn && state.session.fullPhone) {
      syncCurrentProfileToState();
    } else {
      state.session.loggedIn = false;
      state.session.balance = NEW_USER_STARTING_BALANCE;
      state.completedStep = 0;
      state.dailyProfit = 0;
      state.outOfFunds = 0;