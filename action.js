import { db, auth } from "./firebase-config.js";
import {
  ref,
  set,
  push,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const DEFAULT_PRODUCTS = [
  {
    id: "rs-ring-01",
    name: "Imperial Sunstone Solitaire Ring",
    category: "Rings",
    price: 480,
    reward: 24,
    image: "./images/ring-1.jpg",
    description: "Natural sunstone set in 18k warm gold with refined royal prong detailing."
  },
  {
    id: "rs-neck-01",
    name: "Auric Dawn Sunstone Pendant",
    category: "Necklaces",
    price: 690,
    reward: 35,
    image: "./images/necklace-1.jpg",
    description: "Luminous golden-orange sunstone drop suspended from a delicate gold chain."
  },
  {
    id: "rs-brace-01",
    name: "Sovereign Sunstone Cuff Bracelet",
    category: "Bracelets",
    price: 540,
    reward: 27,
    image: "./images/bracelet-1.jpg",
    description: "Sculpted gold cuff accented with hand-selected faceted sunstones."
  },
  {
    id: "rs-ear-01",
    name: "Solstice Drop Earrings",
    category: "Earrings",
    price: 360,
    reward: 18,
    image: "./images/earrings-1.jpg",
    description: "Lightweight drop earrings crafted for evening brilliance and everyday poise."
  }
];

const FALLBACK_SVG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="#efe7da"/>
      <circle cx="300" cy="175" r="56" fill="#c69c53" opacity="0.35"/>
      <polygon points="300,125 345,175 300,225 255,175" fill="#5a0710"/>
      <text x="300" y="275" font-family="Georgia, serif" font-size="22" fill="#142238" text-anchor="middle">ROYAL SUNSTONE JEWELS</text>
    </svg>`
  );

const STORAGE_KEY = "royal_sunstone_state_v1";

const state = {
  selectedCategory: "All",
  products: [...DEFAULT_PRODUCTS],
  orders: [],
  messages: [
    {
      id: "welcome-msg",
      sender: "admin",
      text: "Welcome to Royal Sunstone Jewels Concierge. How may we assist you today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ],
  user: {
    name: "Royal Guest",
    email: "",
    balance: 1250,
    quota: 100,
    loggedIn: false,
    uid: "guest"
  }
};

function saveLocalState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products: state.products,
        orders: state.orders,
        messages: state.messages,
        user: state.user
      })
    );
  } catch (_) {}
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.products) && parsed.products.length > 0) {
      state.products = parsed.products;
    }
    if (Array.isArray(parsed.orders)) {
      state.orders = parsed.orders;
    }
    if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
      state.messages = parsed.messages;
    }
    if (parsed.user && typeof parsed.user === "object") {
      state.user = { ...state.user, ...parsed.user };
    }
  } catch (_) {}
}

function showToast(message) {
  const box = document.getElementById("toastBox");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => box.classList.remove("show"), 2800);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function renderHeroStats() {
  setText("snatchCount", state.user.quota);
  setText("quotaText", state.user.quota);
  setText("userBalanceText", `$${Number(state.user.balance || 0).toFixed(2)}`);
  setText("activeOrdersText", state.orders.length);
  setText("memberStatusText", state.user.loggedIn ? "Verified" : "Guest");

  const authBtn = document.getElementById("authActionBtn");
  if (authBtn) {
    authBtn.textContent = state.user.loggedIn ? "Sign Out" : "Login / Register";
  }
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const filtered =
    state.selectedCategory === "All"
      ? state.products
      : state.products.filter((p) => p.category === state.selectedCategory);

  if (!filtered.length) {
    grid.innerHTML = `<div class="panel"><p class="section-sub">No jewelry items in this category yet.</p></div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const safeImg = item.image || FALLBACK_SVG;
      return `
        <article class="card">
          <img
            src="${safeImg}"
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
              <span class="reward">+$${Number(item.reward || 0).toFixed(2)} Reward</span>
            </div>
            <button class="btn btn-gold" style="width:100%; justify-content:center; margin-top:8px;" data-snatch-id="${escapeHtml(item.id)}">
              Snatch This Piece
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-snatch-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prod = state.products.find((p) => p.id === btn.dataset.snatchId);
      handleSnatchOrder(prod);
    });
  });
}

function renderOrders() {
  const list = document.getElementById("ordersList");
  if (!list) return;

  if (!state.orders.length) {
    list.innerHTML = `<p class="section-sub">No snatch orders placed yet. Click "Snatch" to start.</p>`;
    return;
  }

  list.innerHTML = state.orders
    .slice(0, 8)
    .map(
      (ord) => `
        <div class="order-item">
          <div>
            <strong style="color:var(--navy); font-size:14px;">${escapeHtml(ord.itemName)}</strong>
            <div class="section-sub" style="font-size:12px;">
              Amount: $${Number(ord.price).toFixed(2)} &bull; Reward: +$${Number(ord.reward).toFixed(2)}
            </div>
          </div>
          <span class="status-pill">${escapeHtml(ord.status || "Completed")}</span>
        </div>
      `
    )
    .join("");
}

function renderMessages() {
  const log = document.getElementById("chatLog");
  if (!log) return;

  log.innerHTML = state.messages
    .map(
      (m) => `
        <div class="msg ${m.sender === "admin" ? "admin" : "user"}">
          <div>${escapeHtml(m.text)}</div>
          <div style="font-size:10px; opacity:0.65; margin-top:3px;">${escapeHtml(m.time || "")}</div>
        </div>
      `
    )
    .join("");

  log.scrollTop = log.scrollHeight;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function handleSnatchOrder(specificProduct) {
  if (state.user.quota <= 0) {
    showToast("Daily snatch order quota reached.");
    return;
  }

  const product =
    specificProduct ||
    state.products[Math.floor(Math.random() * state.products.length)] ||
    DEFAULT_PRODUCTS[0];

  const newOrder = {
    id: "ORD-" + Date.now(),
    itemName: product.name,
    price: Number(product.price || 100),
    reward: Number(product.reward || 10),
    status: "Confirmed",
    userEmail: state.user.email || "guest@royalsunstone.local",
    createdAt: new Date().toISOString()
  };

  state.user.quota = Math.max(0, Number(state.user.quota) - 1);
  state.user.balance = Number(state.user.balance || 0) + Number(newOrder.reward);
  state.orders.unshift(newOrder);

  saveLocalState();
  renderAllViews();
  showToast(`Snatched "${newOrder.itemName}" (+$${newOrder.reward.toFixed(2)} reward)`);

  try {
    push(ref(db, "orders"), newOrder).catch(() => {});
    if (state.user.uid && state.user.uid !== "guest") {
      update(ref(db, `users/${state.user.uid}`), {
        balance: state.user.balance,
        quota: state.user.quota
      }).catch(() => {});
    }
  } catch (_) {}
}

function openModal(title, htmlContent) {
  const modal = document.getElementById("authModal");
  const titleEl = document.getElementById("modalTitle");
  const bodyEl = document.getElementById("modalContent");
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = htmlContent;
  modal.classList.add("open");
}

function closeModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("open");
}

function openAccountModal() {
  openModal(
    "Account Details",
    `
      <div style="display:flex; flex-direction:column; gap:10px; font-size:14px;">
        <div><strong>Member:</strong> ${escapeHtml(state.user.name)}</div>
        <div><strong>Email:</strong> ${escapeHtml(state.user.email || "Not signed in")}</div>
        <div><strong>Balance:</strong> $${Number(state.user.balance).toFixed(2)}</div>
        <div><strong>Remaining Snatch Quota:</strong> ${state.user.quota}</div>
        <div><strong>Total Orders:</strong> ${state.orders.length}</div>
      </div>
    `
  );
}

function openAuthModal() {
  if (state.user.loggedIn) {
    signOut(auth)
      .then(() => {
        state.user.loggedIn = false;
        state.user.email = "";
        state.user.uid = "guest";
        saveLocalState();
        renderHeroStats();
        showToast("Signed out successfully.");
      })
      .catch(() => {
        state.user.loggedIn = false;
        saveLocalState();
        renderHeroStats();
      });
    return;
  }

  openModal(
    "Login or Register",
    `
      <form id="authForm">
        <div class="form-group">
          <label for="authEmail">Email Address</label>
          <input type="email" id="authEmail" class="input" required placeholder="member@example.com" />
        </div>
        <div class="form-group">
          <label for="authPassword">Password</label>
          <input type="password" id="authPassword" class="input" required minlength="6" placeholder="At least 6 characters" />
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-navy" style="flex:1; justify-content:center;">Sign In</button>
          <button type="button" id="registerBtn" class="btn btn-gold" style="flex:1; justify-content:center;">Register</button>
        </div>
      </form>
    `
  );

  const form = document.getElementById("authForm");
  const regBtn = document.getElementById("registerBtn");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      state.user.loggedIn = true;
      state.user.email = cred.user.email || email;
      state.user.uid = cred.user.uid;
      state.user.name = (cred.user.email || email).split("@")[0];
      saveLocalState();
      renderHeroStats();
      closeModal();
      showToast("Signed in to Royal Sunstone Jewels.");
    } catch (err) {
      showToast(err.message || "Sign in failed.");
    }
  });

  regBtn?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value;
    if (!email || pass.length < 6) {
      showToast("Enter a valid email and 6+ character password.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      state.user.loggedIn = true;
      state.user.email = cred.user.email || email;
      state.user.uid = cred.user.uid;
      state.user.name = (cred.user.email || email).split("@")[0];
      await set(ref(db, `users/${cred.user.uid}`), {
        email: state.user.email,
        balance: state.user.balance,
        quota: state.user.quota
      }).catch(() => {});
      saveLocalState();
      renderHeroStats();
      closeModal();
      showToast("Account created and signed in.");
    } catch (err) {
      showToast(err.message || "Registration failed.");
    }
  });
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
      const target = document.getElementById(el.dataset.scroll);
      target?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll("#categoryFilters .filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#categoryFilters .filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.selectedCategory = pill.dataset.cat || "All";
      renderProducts();
    });
  });

  document.getElementById("headerSnatchBtn")?.addEventListener("click", () => handleSnatchOrder());
  document.getElementById("heroSnatchBtn")?.addEventListener("click", () => handleSnatchOrder());
  document.getElementById("panelSnatchBtn")?.addEventListener("click", () => handleSnatchOrder());
  document.getElementById("accountDetailsBtn")?.addEventListener("click", openAccountModal);
  document.getElementById("authActionBtn")?.addEventListener("click", openAuthModal);
  document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
  document.getElementById("authModal")?.addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeModal();
  });

  document.getElementById("chatForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input?.value.trim();
    if (!text) return;

    const msg = {
      id: "msg-" + Date.now(),
      sender: state.user.email || "member",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    state.messages.push(msg);
    input.value = "";
    saveLocalState();
    renderMessages();

    push(ref(db, "messages"), msg).catch(() => {});
  });
}

export function renderAllViews() {
  bindUIEvents();
  renderHeroStats();
  renderProducts();
  renderOrders();
  renderMessages();
}

export function initChatListener() {
  try {
    onValue(
      ref(db, "messages"),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const val = snapshot.val();
        const list = Object.values(val);
        if (list.length > 0) {
          state.messages = list;
          saveLocalState();
          renderMessages();
        }
      },
      () => {}
    );
  } catch (_) {}
}

export function initFirebaseSync() {
  const statusEl = document.getElementById("syncStatusText");

  try {
    onValue(
      ref(db, "products"),
      (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.val();
          const list = Array.isArray(raw)
            ? raw.filter(Boolean)
            : Object.entries(raw).map(([key, item]) => ({ id: key, ...item }));
          if (list.length > 0) {
            state.products = list;
            saveLocalState();
            renderProducts();
          }
        }
        if (statusEl) statusEl.textContent = "Live catalog synced";
      },
      () => {
        if (statusEl) statusEl.textContent = "Local catalog active";
      }
    );

    onValue(
      ref(db, "orders"),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const raw = snapshot.val();
        const list = Object.values(raw).reverse();
        if (list.length > 0) {
          state.orders = list;
          saveLocalState();
          renderOrders();
          renderHeroStats();
        }
      },
      () => {}
    );

    onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        state.user.loggedIn = true;
        state.user.email = fbUser.email || "";
        state.user.uid = fbUser.uid;
        state.user.name = (fbUser.email || "Member").split("@")[0];
      } else {
        state.user.loggedIn = false;
        state.user.uid = "guest";
      }
      saveLocalState();
      renderHeroStats();
    });
  } catch (_) {
    if (statusEl) statusEl.textContent = "Local catalog active";
  }
}