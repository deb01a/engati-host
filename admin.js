const seedKey = "engatiHostAccounts";
const activityKey = "engatiHostActivity";
const deletedKey = "engatiHostDeletedCustomers";
const PLAN_NAMES = { accelerator: "Accelerator", growth: "Growth", enterprise: "Enterprise" };
const PLAN_PRICES = { accelerator: 99, growth: 399, enterprise: 599 };
const BILLING = { quarterly: { label: "Quarterly", days: 90, months: 3, multiplier: 1 }, "bi-annual": { label: "Bi-annual", days: 180, months: 6, multiplier: 2 }, yearly: { label: "Yearly", days: 365, months: 12, multiplier: 4 } };
const customerApi = "/.netlify/functions/customers";
let customers = [];
let selectedCustomer = null;

const formatDate = (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
const initials = (name) => (name || "Customer").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const planName = (customer) => PLAN_NAMES[customer.plan] || "No subscription";
const billingCycle = (customer) => BILLING[customer.billingCycle] || BILLING.yearly;
const planPrice = (customer) => (PLAN_PRICES[customer.plan] || 0) * (billingCycle(customer).multiplier || 1);
const historyFor = (customer) => Array.isArray(customer.subscriptions) ? customer.subscriptions : (customer.plan ? [{
  id: `subscription-${customer.email}`,
  plan: customer.plan,
  billingCycle: customer.billingCycle || "quarterly",
  price: customer.price || planPrice(customer),
  status: customer.status || "active",
  startDate: customer.startDate || customer.joined,
  endDate: customer.endDate || customer.renewal,
  createdAt: customer.joined || new Date().toISOString()
}] : []);
const activeSubscription = (customer) => historyFor(customer)
  .filter((subscription) => subscription.status === "active" && new Date(subscription.endDate) >= new Date())
  .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0] || null;
const latestSubscription = (customer) => [...historyFor(customer)].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0] || null;
const getCustomers = () => {
  const stored = JSON.parse(localStorage.getItem(seedKey) || "[]");
  const deleted = JSON.parse(localStorage.getItem(deletedKey) || "[]");
  if (!deleted.includes("accounts@pennywisebank.example") && !stored.some((customer) => customer.email === "accounts@pennywisebank.example")) {
    stored.push({ name: "Microfinance Pennywise Bank", email: "accounts@pennywisebank.example", plan: "accelerator", billingCycle: "quarterly", price: 99, status: "active", joined: new Date().toISOString(), renewal: new Date(Date.now() + 90 * 86400000).toISOString(), seeded: true });
    localStorage.setItem(seedKey, JSON.stringify(stored));
  }
  return stored.map((customer, index) => {
  const subscriptions = historyFor(customer);
  const active = activeSubscription({ ...customer, subscriptions });
  const latest = latestSubscription({ ...customer, subscriptions });
  return {
  ...customer,
  subscriptions,
  id: customer.id || `local-${index}`,
  status: active ? "active" : (latest?.status === "active" ? "expired" : (latest?.status || customer.status || "inactive")),
  plan: active?.plan || latest?.plan || (customer.plan === "quarterly" ? "accelerator" : customer.plan === "yearly" ? "growth" : customer.plan || null),
  billingCycle: active?.billingCycle || latest?.billingCycle || customer.billingCycle || (customer.plan === "quarterly" ? "quarterly" : "yearly"),
  joined: customer.joined || new Date().toISOString(),
  startDate: active?.startDate || latest?.startDate || customer.startDate,
  endDate: active?.endDate || latest?.endDate || customer.endDate,
  renewal: active?.endDate || latest?.endDate || customer.renewal || new Date(Date.now() + 30 * 86400000).toISOString()
  };
  });
};
const saveCustomers = () => {
  localStorage.setItem(seedKey, JSON.stringify(customers));
  void syncCustomers();
};
async function syncCustomers() {
  try {
    const response = await fetch(customerApi);
    if (!response.ok) throw new Error("Unable to save customers to the shared store.");
    for (const customer of customers) {
      const saved = await fetch(customerApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customer) });
      if (!saved.ok) throw new Error("Unable to save customer.");
    }
  } catch (error) {
    console.warn("Customer changes remain in local storage until the shared store is available.", error);
  }
}
async function loadSharedCustomers() {
  try {
    const response = await fetch(customerApi);
    if (!response.ok) return;
    const remote = await response.json();
    if (remote.length) {
      customers = getCustomersFromList(remote);
      localStorage.setItem(seedKey, JSON.stringify(customers));
    } else {
      await syncCustomers();
    }
  } catch (error) {
    console.warn("Shared customer store unavailable; using local demo data.", error);
  }
}
function getCustomersFromList(stored) {
  return stored.map((customer, index) => {
    const subscriptions = historyFor(customer);
    const active = activeSubscription({ ...customer, subscriptions });
    const latest = latestSubscription({ ...customer, subscriptions });
    return {
      ...customer, subscriptions, id: customer.id || `local-${index}`,
      status: active ? "active" : (latest?.status === "active" ? "expired" : (latest?.status || customer.status || "inactive")),
      plan: active?.plan || latest?.plan || customer.plan || null,
      billingCycle: active?.billingCycle || latest?.billingCycle || customer.billingCycle || "yearly",
      joined: customer.joined || customer.createdAt || new Date().toISOString(),
      startDate: active?.startDate || latest?.startDate || customer.startDate,
      endDate: active?.endDate || latest?.endDate || customer.endDate,
      renewal: active?.endDate || latest?.endDate || customer.renewal
    };
  });
}
const getActivities = () => JSON.parse(localStorage.getItem(activityKey) || "[]");
const addActivity = (message, customer) => localStorage.setItem(activityKey, JSON.stringify([{ message, name: customer.name || "Customer", date: new Date().toISOString() }, ...getActivities()].slice(0, 8)));

function renderSubscriptionHistory() {
  const history = [...historyFor(selectedCustomer)].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  document.querySelector("#subscription-history").innerHTML = history.length ? history.map((subscription) => `<div class="subscription-history-item"><div><strong>${planName(subscription)} · ${BILLING[subscription.billingCycle]?.label || subscription.billingCycle}</strong><small>${subscription.status} · ${formatDate(subscription.startDate)} – ${formatDate(subscription.endDate)}</small></div><span><button class="row-action" data-edit-subscription="${subscription.id}">Edit</button><button class="row-action danger-link" data-delete-subscription="${subscription.id}">Delete</button></span></div>`).join("") : '<p class="history-empty">No subscription records yet.</p>';
  document.querySelectorAll("[data-edit-subscription]").forEach((button) => button.addEventListener("click", () => editSubscription(button.dataset.editSubscription)));
  document.querySelectorAll("[data-delete-subscription]").forEach((button) => button.addEventListener("click", () => deleteSubscription(button.dataset.deleteSubscription)));
}
function openSubscriptionForm(subscription = null) {
  document.querySelector("#subscription-form").classList.remove("hidden");
  document.querySelector("#subscription-id").value = subscription?.id || "";
  document.querySelector("#subscription-plan").value = subscription?.plan || "accelerator";
  document.querySelector("#subscription-cycle").value = subscription?.billingCycle || "quarterly";
  document.querySelector("#subscription-status").value = subscription?.status || "active";
  document.querySelector("#subscription-start").value = (subscription?.startDate || new Date().toISOString()).slice(0, 10);
  document.querySelector("#subscription-end").value = (subscription?.endDate || new Date(Date.now() + 90 * 86400000).toISOString()).slice(0, 10);
  document.querySelector("#subscription-error").textContent = "";
}
function editSubscription(id) { openSubscriptionForm(historyFor(selectedCustomer).find((subscription) => subscription.id === id)); }
function deleteSubscription(id) {
  if (!selectedCustomer || !window.confirm("Delete this subscription history record?")) return;
  selectedCustomer.subscriptions = historyFor(selectedCustomer).filter((subscription) => subscription.id !== id);
  saveCustomers(); addActivity("Subscription history deleted", selectedCustomer); renderSubscriptionHistory(); renderStats(); renderTable(); renderActivity(); showToast("Subscription record deleted.");
}

function renderStats() {
  const active = customers.filter((customer) => customer.status === "active");
  const revenue = active.reduce((total, customer) => total + planPrice(customer) / billingCycle(customer).months, 0);
  document.querySelector("#total-customers").textContent = customers.length;
  document.querySelector("#active-subscriptions").textContent = active.length;
  document.querySelector("#revenue").textContent = `$${Math.round(revenue).toLocaleString()}`;
  document.querySelector("#renewals").textContent = customers.filter((customer) => new Date(customer.renewal).getMonth() === new Date().getMonth()).length;
}

function renderTable() {
  const search = document.querySelector("#customer-search").value.toLowerCase();
  const status = document.querySelector("#status-filter").value;
  const filtered = customers.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(search) && (status === "all" || customer.status === status));
  document.querySelector("#customer-rows").innerHTML = filtered.map((customer) => `<tr><td><div class="customer-cell"><span class="table-avatar">${initials(customer.name)}</span><span><strong>${customer.name || "Customer"}</strong><small>${customer.email}</small></span></div></td><td><span class="plan-label">${planName(customer)} <small>${billingCycle(customer).label}</small></span></td><td><span class="status status-${customer.status}"><i></i>${customer.status === "past_due" ? "Past due" : customer.status[0].toUpperCase() + customer.status.slice(1)}</span></td><td>${formatDate(customer.endDate || customer.renewal)}</td><td>${formatDate(customer.joined)}</td><td><button class="row-action" data-customer="${customer.id}">View →</button></td></tr>`).join("");
  document.querySelector("#empty-state").classList.toggle("hidden", filtered.length > 0);
  document.querySelectorAll("[data-customer]").forEach((button) => button.addEventListener("click", () => openDetails(button.dataset.customer)));
}

function renderActivity() {
  const activities = getActivities();
  document.querySelector("#activity-list").innerHTML = (activities.length ? activities : [{ message: "Customer operations will appear here.", name: "Engati Host", date: new Date().toISOString() }]).map((activity) => `<div class="activity-item"><span class="activity-icon">✦</span><p><strong>${activity.message}</strong><small>${activity.name} · ${formatDate(activity.date)}</small></p></div>`).join("");
}

function openDetails(id) {
  selectedCustomer = customers.find((customer) => customer.id === id);
  if (!selectedCustomer) return;
  document.querySelector("#detail-avatar").textContent = initials(selectedCustomer.name);
  document.querySelector("#detail-name").textContent = selectedCustomer.name || "Customer";
  document.querySelector("#detail-email").textContent = selectedCustomer.email;
  document.querySelector("#detail-plan").textContent = `${planName(selectedCustomer)} · ${billingCycle(selectedCustomer).label}`;
  document.querySelector("#detail-status").textContent = selectedCustomer.status === "past_due" ? "Past due" : selectedCustomer.status[0].toUpperCase() + selectedCustomer.status.slice(1);
  document.querySelector("#detail-start").textContent = formatDate(selectedCustomer.startDate || selectedCustomer.joined);
  document.querySelector("#detail-end").textContent = formatDate(selectedCustomer.endDate || selectedCustomer.renewal);
  renderSubscriptionHistory();
  document.querySelector("#detail-modal").classList.add("is-open");
  document.querySelector("#detail-modal").setAttribute("aria-hidden", "false");
}
function closeDetails() { document.querySelector("#detail-modal").classList.remove("is-open"); document.querySelector("#detail-modal").setAttribute("aria-hidden", "true"); }
function updateSubscription(action) {
  if (!selectedCustomer) return;
  if (action === "renew") {
    selectedCustomer.status = "active";
    selectedCustomer.startDate = new Date().toISOString();
    selectedCustomer.endDate = new Date(Date.now() + billingCycle(selectedCustomer).days * 86400000).toISOString();
    selectedCustomer.renewal = selectedCustomer.endDate;
    selectedCustomer.subscriptions = [...historyFor(selectedCustomer), { id: `subscription-${Date.now()}`, plan: selectedCustomer.plan, billingCycle: selectedCustomer.billingCycle, price: planPrice(selectedCustomer), status: "active", startDate: selectedCustomer.startDate, endDate: selectedCustomer.endDate, createdAt: new Date().toISOString() }];
    addActivity("Subscription renewed", selectedCustomer);
  }
  if (action === "cancel") { selectedCustomer.status = "cancelled"; addActivity("Subscription cancelled", selectedCustomer); }
  saveCustomers(); renderStats(); renderTable(); renderActivity(); openDetails(selectedCustomer.id);
}
function closeAddModal() { document.querySelector("#add-modal").classList.remove("is-open"); document.querySelector("#add-modal").setAttribute("aria-hidden", "true"); }
function showToast(message) {
  const toast = document.querySelector("#admin-toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 5000);
}
function openAddModal() {
  const today = new Date();
  const end = new Date(today.getTime() + 90 * 86400000);
  document.querySelector("#new-start").value = today.toISOString().slice(0, 10);
  document.querySelector("#new-end").value = end.toISOString().slice(0, 10);
  document.querySelector("#add-modal").classList.add("is-open");
  document.querySelector("#add-modal").setAttribute("aria-hidden", "false");
}
async function deleteCustomer() {
  if (!selectedCustomer || !window.confirm(`Delete ${selectedCustomer.name || "this customer"} permanently? They will be able to register again with the same email.`)) return;
  customers = customers.filter((customer) => customer.id !== selectedCustomer.id);
  const deleted = JSON.parse(localStorage.getItem(deletedKey) || "[]");
  if (!deleted.includes(selectedCustomer.email)) deleted.push(selectedCustomer.email);
  localStorage.setItem(deletedKey, JSON.stringify(deleted));
  saveCustomers();
  if (!selectedCustomer.id.startsWith("local-")) {
    const response = await fetch(`${customerApi}?id=${encodeURIComponent(selectedCustomer.id)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete this customer from the shared store.");
  }
  addActivity("Customer deleted", selectedCustomer);
  selectedCustomer = null;
  closeDetails();
  renderStats(); renderTable(); renderActivity();
}

customers = getCustomers();
void loadSharedCustomers().finally(() => { renderStats(); renderTable(); renderActivity(); });
document.querySelector("#customer-search").addEventListener("input", renderTable);
document.querySelector("#status-filter").addEventListener("change", renderTable);
document.querySelector("#detail-close").addEventListener("click", closeDetails);
document.querySelector("#detail-modal").addEventListener("click", (event) => { if (event.target.id === "detail-modal") closeDetails(); });
document.querySelector("#detail-renew").addEventListener("click", () => updateSubscription("renew"));
document.querySelector("#detail-cancel").addEventListener("click", () => updateSubscription("cancel"));
document.querySelector("#detail-delete").addEventListener("click", deleteCustomer);
document.querySelector("#add-subscription").addEventListener("click", () => openSubscriptionForm());
document.querySelector("#cancel-subscription-edit").addEventListener("click", () => document.querySelector("#subscription-form").classList.add("hidden"));
document.querySelector("#subscription-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedCustomer) return;
  const start = document.querySelector("#subscription-start").value;
  const end = document.querySelector("#subscription-end").value;
  const error = document.querySelector("#subscription-error");
  if (new Date(end) <= new Date(start)) { error.textContent = "End date must be after the start date."; return; }
  const id = document.querySelector("#subscription-id").value || `subscription-${Date.now()}`;
  const record = { id, plan: document.querySelector("#subscription-plan").value, billingCycle: document.querySelector("#subscription-cycle").value, status: document.querySelector("#subscription-status").value, price: PLAN_PRICES[document.querySelector("#subscription-plan").value] * BILLING[document.querySelector("#subscription-cycle").value].multiplier, startDate: new Date(`${start}T00:00:00`).toISOString(), endDate: new Date(`${end}T23:59:59`).toISOString(), createdAt: new Date().toISOString() };
  selectedCustomer.subscriptions = [...historyFor(selectedCustomer).filter((subscription) => subscription.id !== id), record];
  const current = activeSubscription(selectedCustomer) || latestSubscription(selectedCustomer);
  Object.assign(selectedCustomer, { plan: current.plan, billingCycle: current.billingCycle, status: current.status, price: current.price, startDate: current.startDate, endDate: current.endDate, renewal: current.endDate });
  saveCustomers(); addActivity(document.querySelector("#subscription-id").value ? "Subscription history updated" : "Subscription history added", selectedCustomer); document.querySelector("#subscription-form").classList.add("hidden"); renderStats(); renderTable(); renderActivity(); openDetails(selectedCustomer.id); showToast("Subscription record saved.");
});
document.querySelector("#add-customer").addEventListener("click", openAddModal);
document.querySelector("#add-close").addEventListener("click", closeAddModal);
document.querySelector("#add-modal").addEventListener("click", (event) => { if (event.target.id === "add-modal") closeAddModal(); });
document.querySelector("#add-customer-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const start = document.querySelector("#new-start").value;
  const end = document.querySelector("#new-end").value;
  const email = document.querySelector("#new-email").value.trim().toLowerCase();
  const error = document.querySelector("#add-error");
  if (new Date(end) <= new Date(start)) { error.textContent = "End date must be after the start date."; return; }
  if (customers.some((customer) => customer.email === email)) { error.textContent = "A customer with this email already exists."; return; }
  const password = document.querySelector("#new-password").value;
  const customer = {
    id: `manual-${Date.now()}`,
    name: document.querySelector("#new-name").value.trim(),
    email,
    password,
    phone: document.querySelector("#new-phone").value.trim(),
    plan: document.querySelector("#new-plan").value,
    billingCycle: document.querySelector("#new-cycle").value,
    status: "active",
    startDate: new Date(`${start}T00:00:00`).toISOString(),
    joined: new Date(`${start}T00:00:00`).toISOString(),
    endDate: new Date(`${end}T23:59:59`).toISOString(),
    renewal: new Date(`${end}T23:59:59`).toISOString(),
    subscriptions: [{ id: `subscription-${Date.now()}`, plan: document.querySelector("#new-plan").value, billingCycle: document.querySelector("#new-cycle").value, status: "active", price: PLAN_PRICES[document.querySelector("#new-plan").value] * BILLING[document.querySelector("#new-cycle").value].multiplier, startDate: new Date(`${start}T00:00:00`).toISOString(), endDate: new Date(`${end}T23:59:59`).toISOString(), createdAt: new Date().toISOString() }],
    manuallyAdded: true
  };
  customers = [...customers, customer];
  saveCustomers();
  addActivity("Member added manually", customer);
  closeAddModal();
  event.target.reset();
  showToast(`${customer.name} was added. They can log in with ${customer.email} and the password you entered.`);
  renderStats(); renderTable(); renderActivity();
});
document.querySelector("#admin-logout").addEventListener("click", () => { window.location.href = "index.html"; });
document.querySelector("#export-customers").addEventListener("click", () => {
  const header = "Name,Email,Plan,Billing cycle,Status,Next renewal,Joined\n";
  const rows = customers.map((customer) => [customer.name, customer.email, planName(customer), billingCycle(customer).label, customer.status, formatDate(customer.renewal), formatDate(customer.joined)].map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([header + rows], { type: "text/csv" })); link.download = "engati-host-customers.csv"; link.click(); URL.revokeObjectURL(link.href);
});
