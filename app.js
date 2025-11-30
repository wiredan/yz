// ===============================
//  API Base URL
// ===============================
const API_BASE = "https://wiredan.com"; 
// If backend is at api.wiredan.com, change to: "https://api.wiredan.com"

// ===============================
//  APP CONTROLLER
// ===============================
const app = {
  token: localStorage.getItem("jwt") || null,
  user: null,

  // -------------------------------
  // INIT
  // -------------------------------
  init() {
    console.log("Wiredan App Loaded");

    // Catch OAuth redirect token
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    if (oauthToken) {
      localStorage.setItem("jwt", oauthToken);
      this.token = oauthToken;

      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);

      // Load user profile
      this.fetchUserProfile();
    }

    // Listeners
    document
      .getElementById("lang-selector")
      ?.addEventListener("change", (e) => this.setLanguage(e.target.value));

    document
      .getElementById("currency-selector")
      ?.addEventListener("change", (e) => this.setCurrency(e.target.value));

    document
      .getElementById("login-form")
      ?.addEventListener("submit", (e) => this.handleLogin(e));

    document
      .getElementById("signup-form")
      ?.addEventListener("submit", (e) => this.handleSignup(e));
  },

  // -------------------------------
  // LANGUAGE & CURRENCY
  // -------------------------------
  setLanguage(lang) {
    console.log("Language set to:", lang);
  },

  setCurrency(curr) {
    console.log("Currency set to:", curr);
  },

  // -------------------------------
  // THEME TOGGLE
  // -------------------------------
  toggleTheme() {
    document.body.classList.toggle("theme-dark");
    console.log("Theme toggled");
  },

  // -------------------------------
  // SOCIAL LOGIN (OAUTH POPUP)
  // -------------------------------
  socialLogin(provider) {
    const width = 500,
      height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const url = `${API_BASE}/auth/${provider}`;

    window.open(
      url,
      "SocialLogin",
      `width=${width},height=${height},top=${top},left=${left},resizable=no,scrollbars=yes,status=no`
    );
  },

  // -------------------------------
  // USER PROFILE
  // -------------------------------
  async fetchUserProfile() {
    if (!this.token) return;

    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (res.ok) {
        this.user = await res.json();
        console.log("User profile loaded:", this.user);
      } else {
        console.warn("Invalid or expired token");
      }
    } catch (err) {
      console.error("Profile error", err);
    }
  },

  // -------------------------------
  // SIGNUP
  // -------------------------------
  async handleSignup(e) {
    e.preventDefault();

    const email = e.target.querySelector('input[type="email"]').value;
    const pass1 = e.target.querySelector('input[type="password"]').value;
    const pass2 = e.target.querySelectorAll('input[type="password"]')[1].value;

    if (pass1 !== pass2) {
      alert("Passwords do not match!");
      return;
    }

    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass1 }),
    });

    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("jwt", data.token);
      this.token = data.token;
      await this.fetchUserProfile();
      alert("Signup successful!");
      this.showView("market-view");
    } else {
      alert(data.error || "Signup failed");
    }
  },

  // -------------------------------
  // LOGIN
  // -------------------------------
  async handleLogin(e) {
    e.preventDefault();

    const email = e.target.querySelector('input[type="email"]').value;
    const password = e.target.querySelector('input[type="password"]').value;

    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("jwt", data.token);
      this.token = data.token;
      await this.fetchUserProfile();
      alert("Login successful!");
      this.showView("market-view");
    } else {
      alert(data.error || "Login failed");
    }
  },

  // -------------------------------
  // VIEW SWITCHING
  // -------------------------------
  showView(viewId) {
    document
      .querySelectorAll("main section")
      .forEach((s) => s.classList.add("hidden"));

    document.getElementById(viewId)?.classList.remove("hidden");
  },

  // -------------------------------
  // CREATE LISTING (KYC REQUIRED)
  // -------------------------------
  async createListing(listing) {
    await this.fetchUserProfile();

    if (!this.user?.kyc_verified) {
      alert("Only KYC-verified users can trade crops.");
      return;
    }

    // Block animal/poultry products
    const forbidden = ["animal", "bird", "livestock", "poultry", "goat", "cow"];
    if (forbidden.includes(listing.crop_type.toLowerCase())) {
      alert("Only food crops allowed. No livestock or animal trade.");
      return;
    }

    const res = await fetch(`${API_BASE}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(listing),
    });

    const data = await res.json();
    if (res.ok) alert("Listing created successfully");
    else alert(data.error || "Failed to create listing");
  },

  // -------------------------------
  // PLACE ORDER (KYC REQUIRED)
  // -------------------------------
  async placeOrder(order) {
    await this.fetchUserProfile();

    if (!this.user?.kyc_verified) {
      alert("Complete KYC before placing orders.");
      return;
    }

    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(order),
    });

    const data = await res.json();
    if (res.ok) alert("Order placed successfully");
    else alert(data.error || "Order failed");
  },
};

// Init app on load
window.addEventListener("load", () => app.init());