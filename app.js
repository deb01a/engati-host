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
  "accelerator-bi-annual": "https://flutterwave.com/pay/4oaxpyylovgj?_gl=1%2a107hr0c%2a_gcl_au%2aNzQ4NDY5Njk5LjE3ODkwMzI4MzE.%2a_ga%2aMTU4NzI3ODEzNS4xNzg5MDMyNjI5%2a_ga_KQ9NSEMFCF%2aczE3ODkwMzI2NDMkbzEkZzEkdDE3ODkwMzM0MDckajU5JGwwJGgw"
};

const state = { authMode: "login", selectedPlan: null, billingCycle: "quarterly" };
const authModal = document.querySelector("#auth-modal");
const dashboardModal = document.querySelector("#dashboard-modal");
const planModal = document.querySelector("#plan-modal");
const authForm = document.querySelector("#auth-form");
const paymentFunction = "/.netlify/functions/payments";

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

function openPlanChooser(plan) {
  state.selectedPlan = plan;
  document.querySelector("#plan-modal-eyebrow").textContent = `${PLAN_NAMES[plan].toUpperCase()} PACKAGE`;
  openModal(planModal);
}

function getAccounts() {
  const accounts = JSON.parse(localStorage.getItem("engatiHostAccounts") || "[]");
  const deleted = JSON.parse(localStorage.getItem("engatiHostDeletedCustomers") || "[]");
  if (!deleted.includes("accounts@pennywisebank.example") && !accounts.some((account) => account.email === "accounts@pennywisebank.example")) {
    accounts.push({ name: "Microfinance Pennywise Bank", email: "accounts@pennywisebank.example", plan: "accelerator", billingCycle: "quarterly", price: 99, status: "active", joined: new Date().toISOString(), renewal: new Date(Date.now() + 90 * 86400000).toISOString(), seeded: true });
    localStorage.setItem("engatiHostAccounts", JSON.stringify(accounts));
  }
  return accounts;
}

function showDashboard(account) {
  if (!account.plan || account.status !== "active") {
    document.querySelector("#dashboard-status").textContent = "● No subscription";
    document.querySelector("#dashboard-plan-name").textContent = "No subscription";
    document.querySelector("#dashboard-plan-price").textContent = "Choose a plan";
    document.querySelector("#dashboard-plan-renewal").textContent = "Select a plan below to subscribe";
    closeModal(authModal);
    openModal(dashboardModal);
    return;
  }

  const plan = PLANS[account.plan] || PLANS.growth;
  const cycle = BILLING_CYCLES[account.billingCycle] || BILLING_CYCLES.yearly;
  document.querySelector("#dashboard-status").textContent = "● Active";
  document.querySelector("#dashboard-greeting").textContent = `Good to see you, ${account.name || "friend"}.`;
  document.querySelector("#dashboard-plan-name").textContent = plan.name;
  document.querySelector("#dashboard-plan-price").innerHTML = `$${plan.price * cycle.multiplier}<span>/${cycle.label.toLowerCase()}</span>`;
  document.querySelector("#dashboard-plan-renewal").textContent = `Renews ${cycle.label.toLowerCase()}`;
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

authForm.addEventListener("submit", (event) => {
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
    localStorage.setItem("engatiHostSession", JSON.stringify(account));
    if (state.selectedPlan) {
      closeModal(authModal);
      openPlanChooser(state.selectedPlan);
      return;
    }
    showDashboard(account);
  } else {
    const account = accounts.find((item) => item.email === email && item.password === password);
    if (!account) {
      error.textContent = "We couldn't match that email and password. Create an account or try again.";
      return;
    }
    localStorage.setItem("engatiHostSession", JSON.stringify(account));
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
  closeModal(dashboardModal);
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
  const updated = { ...account, plan: result.plan, billingCycle: result.billingCycle, status: "active", price: result.amount, renewal: new Date(Date.now() + BILLING_CYCLES[result.billingCycle].months * 30 * 86400000).toISOString() };
  localStorage.setItem("engatiHostAccounts", JSON.stringify(accounts.map((item) => item.email === account.email ? updated : item)));
  localStorage.setItem("engatiHostSession", JSON.stringify(updated));
  localStorage.removeItem("engatiHostPendingPayment");
  window.history.replaceState({}, document.title, window.location.pathname);
  showDashboard(updated);
}
verifyPaymentReturn();

const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", () => document.body.classList.remove("nav-open")));
