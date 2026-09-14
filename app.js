const PLANS = {
  accelerator: { name: "Accelerator", price: 99 },
  growth: { name: "Growth", price: 399 },
  enterprise: { name: "Enterprise", price: 599 }
};
const BILLING_CYCLES = {
  quarterly: { label: "Quarterly", months: 3, multiplier: 1 },
  "bi-annual": { label: "Bi-annual", months: 6, multiplier: 2 },
  yearly: { label: "Yearly", months: 12, multiplier: 4 }
};
const FLUTTERWAVE_CHECKOUT_LINKS = {
  "accelerator-quarterly": "https://flutterwave.com/pay/4oaxpyylovgj?_gl=1%2a107hr0c%2a_gcl_au%2aNzQ4NDY5Njk5LjE3ODkwMzI4MzE.%2a_ga%2aMTU4NzI3ODEzNS4xNzg5MDMyNjI5%2a_ga_KQ9NSEMFCF%2aczE3ODkwMzI2NDMkbzEkZzEkdDE3ODkwMzM0MDckajU5JGwwJGgw",
  "accelerator-bi-annual": "https://flutterwave.com/pay/nitwcovbb7we"
};

const state = { authMode: "login", selectedPlan: null, billingCycle: "quarterly" };
const authModal = document.querySelector("#auth-modal");
const dashboardModal = document.querySelector("#dashboard-modal");
const planModal = document.querySelector("#plan-modal");
const authForm = document.querySelector("#auth-form");
const paymentFunction = "/.netlify/functions/payments";
const customerApi = "/.netlify/functions/customers";

function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal-backdrop.is-open")) document.body.classList.remove("modal-open");
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === "signup";
  document.querySelector("#auth-eyebrow").textContent = signup ? "START SOMETHING GOOD" : "WELCOME BACK";
  document.querySelector("#auth-title").textContent = signup ? "Come build with us." : "Come on in.";
  document.querySelector("#auth-description").textContent = signup ? "Create your workspace instantly — no email verification required." : "Log in to manage your Engati Host workspace.";
  document.querySelector("#name-field").classList.toggle("hidden", !signup);
  document.querySelector("#auth-name").required = signup;
  document.querySelector("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  document.querySelector("#auth-submit").innerHTML = `${signup ? "Create account" : "Log in"} <span>↗</span>`;
  document.querySelector("#auth-switch").innerHTML = signup ? 'Already have an account? <button type="button" data-switch-auth="login">Log in</button>' : 'New to Engati Host? <button type="button" data-switch-auth="signup">Create an account</button>';
  document.querySelector("#form-error").textContent = "";
}

function openAuth(mode, plan) {
  state.selectedPlan = plan || null;
  setAuthMode(mode);
  openModal(authModal);
  window.setTimeout(() => document.querySelector(signupField(mode) ? "#auth-name" : "#auth-email").focus(), 100);
}

function signupField(mode) { return mode === "signup"; }

function updateProfile(account = JSON.parse(localStorage.getItem("engatiHostSession") || "null")) {
  const loggedIn = Boolean(account);
  document.querySelector("#login-nav").classList.toggle("hidden", loggedIn);
  document.querySelector("#signup-nav").classList.toggle("hidden", loggedIn);
  document.querySelector("#profile-nav").classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    const name = account.name || account.email.split("@")[0];
    document.querySelector("#profile-name").textContent = name;
    document.querySelector("#profile-avatar").textContent = name.slice(0, 1).toUpperCase();
  }
}

function openPlanChooser(plan) {
  state.selectedPlan = plan;
  document.querySelector("#plan-modal-eyebrow").textContent = `${PLANS[plan].name.toUpperCase()} PACKAGE`;
  openModal(planModal);
}

function getAccounts() {
  const accounts = JSON.parse(localStorage.getItem("engatiHostAccounts") || "[]");
  const deleted = JSON.parse(localStorage.getItem("engatiHostDeletedCustomers") || "[]");
  if (!deleted.includes("accounts@pennywisebank.example") && !accounts.some((account) => account.email === "accounts@pennywisebank.example")) {
    accounts.push({ name: "Microfinance Pennywise Bank", email: "accounts@pennywisebank.example", plan: "accelerator", billingCycle: "quarterly", price: 99, status: "active", joined: new Date().toISOString(), renewal: new Date(Date.now() + 90 * 86400000).toISOString(), seeded: true });
    localStorage.setItem("engatiHostAccounts", JSON.stringify(accounts));
  }

  async function getRemoteAccount(email) {
    try {
      const response = await fetch(`${customerApi}?email=${encodeURIComponent(email)}`);
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.warn("Shared customer store unavailable; using local account data.", error);
      return null;
    }
  }

  async function saveRemoteAccount(account) {
    try {
      const response = await fetch(customerApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account)
      });
      if (!response.ok) throw new Error("Your account could not be saved to the shared store.");
      return response.json();
    } catch (error) {
      console.warn("Account saved locally; shared store unavailable.", error);
      return null;
    }
  }
  let changed = false;
  const normalized = accounts.map((account) => {
    if (Array.isArray(account.subscriptions)) return account;
    changed = true;
    return {
      ...account,
      subscriptions: account.plan ? [{
        id: `subscription-${account.email}-${Date.now()}`,
        plan: account.plan,
        billingCycle: account.billingCycle || "quarterly",
        price: account.price || PLANS[account.plan]?.price || 0,
        status: account.status || "active",
        startDate: account.startDate || account.joined,
        endDate: account.endDate || account.renewal,
        createdAt: account.joined || new Date().toISOString()
      }] : []
    };
  });
  if (changed) localStorage.setItem("engatiHostAccounts", JSON.stringify(normalized));
  return normalized;
}

function subscriptionHistory(account) {
  return Array.isArray(account.subscriptions)
    ? [...account.subscriptions].sort((a, b) => new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt))
    : [];
}

function activeSubscription(account) {
  return subscriptionHistory(account)
    .filter((subscription) => subscription.status === "active" && new Date(subscription.endDate) >= new Date())
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0] || null;
}

function renderSubscriptionHistory(account) {
  const history = subscriptionHistory(account);
  document.querySelector("#dashboard-history").innerHTML = history.length
    ? history.map((subscription) => `<div class="history-item"><div><strong>${PLANS[subscription.plan]?.name || "Package"} · ${BILLING_CYCLES[subscription.billingCycle]?.label || "Billing cycle"}</strong><small>${subscription.status || "active"} · ${new Date(subscription.startDate).toLocaleDateString()} – ${new Date(subscription.endDate).toLocaleDateString()}</small></div><b>$${subscription.price || 0}</b></div>`).join("")
    : '<p class="history-empty">Your subscription history will appear here.</p>';
}

function showDashboard(account) {
  const storedAccount = getAccounts().find((item) => item.email === account.email) || account;
  const currentSubscription = activeSubscription(storedAccount);
  const latestSubscription = subscriptionHistory(storedAccount)[0];
  localStorage.setItem("engatiHostSession", JSON.stringify(storedAccount));
  const expiry = currentSubscription?.endDate || latestSubscription?.endDate || storedAccount.endDate || storedAccount.renewal;
  const hasExpiredPackage = Boolean(latestSubscription && new Date(latestSubscription.endDate) < new Date());
  if (!currentSubscription) {
    document.querySelector("#dashboard-greeting").textContent = `Good to see you, ${account.name || "friend"}.`;
    document.querySelector("#dashboard-status").textContent = hasExpiredPackage ? "● Package expired" : "● No subscription";
    document.querySelector("#dashboard-plan-name").textContent = hasExpiredPackage ? `${PLANS[latestSubscription.plan]?.name || "Your"} package expired` : "No subscription";
    document.querySelector("#dashboard-plan-price").textContent = hasExpiredPackage ? "Renew package" : "Choose a plan";
    document.querySelector("#dashboard-plan-renewal").textContent = hasExpiredPackage ? `Ended ${new Date(expiry).toLocaleDateString()}` : "Select a plan below to subscribe";
    document.querySelector("#dashboard-access-title").textContent = hasExpiredPackage ? "Your profile is still active" : "Account created";
    document.querySelector("#dashboard-access-copy").textContent = hasExpiredPackage ? "Your package has ended. Choose a package below to renew access." : "Your account is ready. Pick a plan below when you are ready to subscribe.";
    document.querySelector("#dashboard-renew").textContent = hasExpiredPackage ? "Renew package ↗" : "Choose a plan ↗";
    document.querySelector("#dashboard-renew").onclick = () => openPlanChooser(latestSubscription?.plan || storedAccount.plan || "accelerator");
    renderSubscriptionHistory(storedAccount);
    closeModal(authModal);
    openModal(dashboardModal);
    return;
  }

  const plan = PLANS[currentSubscription.plan] || PLANS.growth;
  const cycle = BILLING_CYCLES[currentSubscription.billingCycle] || BILLING_CYCLES.yearly;
  document.querySelector("#dashboard-status").textContent = "● Active";
  document.querySelector("#dashboard-greeting").textContent = `Good to see you, ${storedAccount.name || "friend"}.`;
  document.querySelector("#dashboard-plan-name").textContent = plan.name;
  document.querySelector("#dashboard-plan-price").innerHTML = `$${currentSubscription.price || plan.price * cycle.multiplier}<span>/${cycle.label.toLowerCase()}</span>`;
  document.querySelector("#dashboard-plan-renewal").textContent = `Active until ${new Date(currentSubscription.endDate).toLocaleDateString()}`;
  document.querySelector("#dashboard-access-title").textContent = "Subscription active";
  document.querySelector("#dashboard-access-copy").textContent = `Your ${plan.name} package (${cycle.label}) is active until ${new Date(currentSubscription.endDate).toLocaleDateString()}.`;
  document.querySelector("#dashboard-renew").textContent = "Change or renew package ↗";
  document.querySelector("#dashboard-renew").onclick = () => openPlanChooser(currentSubscription.plan);
  renderSubscriptionHistory(storedAccount);
  closeModal(authModal);
  openModal(dashboardModal);
}

async function startCheckout(plan) {
  const account = JSON.parse(localStorage.getItem("engatiHostSession") || "null");
  if (!account) {
    openAuth("login", plan);
    return;
  }
  const hostedCheckoutUrl = FLUTTERWAVE_CHECKOUT_LINKS[`${plan}-${state.billingCycle}`];
  if (hostedCheckoutUrl) {
    window.location.href = hostedCheckoutUrl;
    return;
  }
  try {
    const response = await fetch(paymentFunction, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, billingCycle: state.billingCycle, email: account.email, name: account.name, redirectUrl: `${window.location.origin}${window.location.pathname}?payment=flutterwave` })
    });
    const result = await response.json();
    if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Unable to start checkout");
    localStorage.setItem("engatiHostPendingPayment", JSON.stringify({ txRef: result.txRef, plan, billingCycle: state.billingCycle }));
    window.location.href = result.checkoutUrl;
  } catch (error) {
    window.alert(error.message);
  }
}

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.plan && localStorage.getItem("engatiHostSession")) startCheckout(button.dataset.plan);
    else openAuth(button.dataset.openAuth, button.dataset.plan);
  });

});

document.querySelectorAll("[data-select-plan]").forEach((button) => {
  button.addEventListener("click", () => {
    const plan = button.dataset.selectPlan;
    if (localStorage.getItem("engatiHostSession")) openPlanChooser(plan);
    else openAuth("login", plan);
  });
});

document.querySelectorAll("[data-cycle-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    state.billingCycle = button.dataset.cycleChoice;
    closeModal(planModal);
    startCheckout(state.selectedPlan);
  });
});

document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop"))));
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(backdrop); }));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.querySelectorAll(".modal-backdrop.is-open").forEach(closeModal); });

document.addEventListener("click", (event) => {
  const switchButton = event.target.closest("[data-switch-auth]");
  if (switchButton) setAuthMode(switchButton.dataset.switchAuth);
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#auth-email").value.trim().toLowerCase();
  const password = document.querySelector("#auth-password").value;
  const name = document.querySelector("#auth-name").value.trim();
  const error = document.querySelector("#form-error");
  const accounts = getAccounts();
  if (state.authMode === "signup") {
    if (accounts.some((account) => account.email === email)) {
      error.textContent = "An account with this email already exists. Try logging in.";
      return;
    }
    const account = { email, password, name: name || "friend", plan: null, billingCycle: null, status: "inactive", joined: new Date().toISOString() };
    localStorage.setItem("engatiHostAccounts", JSON.stringify([...accounts, account]));
    await saveRemoteAccount(account);
    localStorage.setItem("engatiHostSession", JSON.stringify(account));
    updateProfile(account);
    if (state.selectedPlan) {
      closeModal(authModal);
      openPlanChooser(state.selectedPlan);
      return;
    }
    showDashboard(account);
  } else {
    const remoteAccount = await getRemoteAccount(email);
    const account = (remoteAccount || accounts.find((item) => item.email === email)) || null;
    if (!account || account.password !== password) {
      error.textContent = "We couldn't match that email and password. Create an account or try again.";
      return;
    }
    localStorage.setItem("engatiHostAccounts", JSON.stringify([...accounts.filter((item) => item.email !== email), account]));
    localStorage.setItem("engatiHostSession", JSON.stringify(account));
    updateProfile(account);
    if (state.selectedPlan) {
      closeModal(authModal);
      openPlanChooser(state.selectedPlan);
      return;
    }
    showDashboard(account);
  }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  localStorage.removeItem("engatiHostSession");
  updateProfile(null);
  closeModal(dashboardModal);
});

document.querySelector("#profile-nav").addEventListener("click", () => {
  const account = JSON.parse(localStorage.getItem("engatiHostSession") || "null");
  if (account) showDashboard(account);
});

document.querySelector("#dashboard-renew").addEventListener("click", () => {
  const account = JSON.parse(localStorage.getItem("engatiHostSession") || "null");
  if (account) openPlanChooser(account.plan || "accelerator");
});

document.querySelectorAll("[data-billing]").forEach((button) => button.addEventListener("click", () => {
  state.billingCycle = button.dataset.billing;
  document.querySelectorAll("[data-billing]").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll("[data-price]").forEach((price) => { price.textContent = `$${PLANS[price.dataset.plan].price * BILLING_CYCLES[state.billingCycle].multiplier}`; });
  document.querySelectorAll("[data-period]").forEach((period) => { period.textContent = `/ ${BILLING_CYCLES[state.billingCycle].label.toLowerCase()}`; });
  document.querySelectorAll("[data-plan]").forEach((button) => { button.dataset.billing = state.billingCycle; });
}));

async function verifyPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const transactionId = params.get("transaction_id");
  if (!transactionId) return;
  const response = await fetch(`${paymentFunction}?transaction_id=${encodeURIComponent(transactionId)}`);
  const result = await response.json();
  const account = JSON.parse(localStorage.getItem("engatiHostSession") || "null");
  if (!response.ok || !result.verified || !account) {
    window.alert("Payment could not be verified. Your subscription is still inactive.");
    return;
  }
  const accounts = getAccounts();
  const endDate = new Date(Date.now() + BILLING_CYCLES[result.billingCycle].months * 30 * 86400000).toISOString();
  const subscription = { id: `subscription-${Date.now()}`, plan: result.plan, billingCycle: result.billingCycle, status: "active", price: result.amount, startDate: new Date().toISOString(), endDate, createdAt: new Date().toISOString() };
  const updated = { ...account, plan: result.plan, billingCycle: result.billingCycle, status: "active", price: result.amount, renewal: endDate, endDate, subscriptions: [...subscriptionHistory(account), subscription] };
  localStorage.setItem("engatiHostAccounts", JSON.stringify(accounts.map((item) => item.email === account.email ? updated : item)));
  await saveRemoteAccount(updated);
  localStorage.setItem("engatiHostSession", JSON.stringify(updated));
  localStorage.removeItem("engatiHostPendingPayment");
  window.history.replaceState({}, document.title, window.location.pathname);
  showDashboard(updated);
}
verifyPaymentReturn();
updateProfile();

const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", () => document.body.classList.remove("nav-open")));
