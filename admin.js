const seedKey = "engatiHostAccounts";
const activityKey = "engatiHostActivity";
const deletedKey = "engatiHostDeletedCustomers";
const PLAN_NAMES = { accelerator: "Accelerator", growth: "Growth", enterprise: "Enterprise" };
const PLAN_PRICES = { accelerator: 99, growth: 399, enterprise: 599 };
const BILLING = { quarterly: { label: "Quarterly", days: 90, months: 3, multiplier: 1 }, "bi-annual": { label: "Bi-annual", days: 180, months: 6, multiplier: 2 }, yearly: { label: "Yearly", days: 365, months: 12, multiplier: 4 } };
let customers = [];
let selectedCustomer = null;

const formatDate = (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
const initials = (name) => (name || "Customer").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const planName = (customer) => PLAN_NAMES[customer.plan] || "No subscription";
const billingCycle = (customer) => BILLING[customer.billingCycle] || BILLING.yearly;
const planPrice = (customer) => (PLAN_PRICES[customer.plan] || 0) * (billingCycle(customer).multiplier || 1);
const getCustomers = () => {
  const stored = JSON.parse(localStorage.getItem(seedKey) || "[]");
  const deleted = JSON.parse(localStorage.getItem(deletedKey) || "[]");
  if (!deleted.includes("accounts@pennywisebank.example") && !stored.some((customer) => customer.email === "accounts@pennywisebank.example")) {
    stored.push({ name: "Microfinance Pennywise Bank", email: "accounts@pennywisebank.example", plan: "accelerator", billingCycle: "quarterly", price: 99, status: "active", joined: new Date().toISOString(), renewal: new Date(Date.now() + 90 * 86400000).toISOString(), seeded: true });
    localStorage.setItem(seedKey, JSON.stringify(stored));
  }
  return stored.map((customer, index) => ({
  ...customer,
  id: customer.id || `local-${index}`,
  status: customer.status || "active",
  plan: customer.plan === "quarterly" ? "accelerator" : customer.plan === "yearly" ? "growth" : customer.plan || null,
  billingCycle: customer.billingCycle || (customer.plan === "quarterly" ? "quarterly" : "yearly"),
  joined: customer.joined || new Date().toISOString(),
  renewal: customer.renewal || new Date(Date.now() + 30 * 86400000).toISOString()
  }));
};
const saveCustomers = () => localStorage.setItem(seedKey, JSON.stringify(customers));
const getActivities = () => JSON.parse(localStorage.getItem(activityKey) || "[]");
const addActivity = (message, customer) => localStorage.setItem(activityKey, JSON.stringify([{ message, name: customer.name || "Customer", date: new Date().toISOString() }, ...getActivities()].slice(0, 8)));

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
  document.querySelector("#customer-rows").innerHTML = filtered.map((customer) => `<tr><td><div class="customer-cell"><span class="table-avatar">${initials(customer.name)}</span><span><strong>${customer.name || "Customer"}</strong><small>${customer.email}</small></span></div></td><td><span class="plan-label">${planName(customer)} <small>${billingCycle(customer).label}</small></span></td><td><span class="status status-${customer.status}"><i></i>${customer.status === "past_due" ? "Past due" : customer.status[0].toUpperCase() + customer.status.slice(1)}</span></td><td>${formatDate(customer.renewal)}</td><td>${formatDate(customer.joined)}</td><td><button class="row-action" data-customer="${customer.id}">View →</button></td></tr>`).join("");
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
  document.querySelector("#detail-renewal").textContent = formatDate(selectedCustomer.renewal);
  document.querySelector("#detail-joined").textContent = formatDate(selectedCustomer.joined);
  document.querySelector("#detail-modal").classList.add("is-open");
  document.querySelector("#detail-modal").setAttribute("aria-hidden", "false");
}
function closeDetails() { document.querySelector("#detail-modal").classList.remove("is-open"); document.querySelector("#detail-modal").setAttribute("aria-hidden", "true"); }
function updateSubscription(action) {
  if (!selectedCustomer) return;
  if (action === "renew") { selectedCustomer.status = "active"; selectedCustomer.renewal = new Date(Date.now() + billingCycle(selectedCustomer).days * 86400000).toISOString(); addActivity("Subscription renewed", selectedCustomer); }
  if (action === "cancel") { selectedCustomer.status = "cancelled"; addActivity("Subscription cancelled", selectedCustomer); }
  saveCustomers(); renderStats(); renderTable(); renderActivity(); openDetails(selectedCustomer.id);
}
function deleteCustomer() {
  if (!selectedCustomer || !window.confirm(`Delete ${selectedCustomer.name || "this customer"} permanently? They will be able to register again with the same email.`)) return;
  customers = customers.filter((customer) => customer.id !== selectedCustomer.id);
  const deleted = JSON.parse(localStorage.getItem(deletedKey) || "[]");
  if (!deleted.includes(selectedCustomer.email)) deleted.push(selectedCustomer.email);
  localStorage.setItem(deletedKey, JSON.stringify(deleted));
  saveCustomers();
  addActivity("Customer deleted", selectedCustomer);
  selectedCustomer = null;
  closeDetails();
  renderStats(); renderTable(); renderActivity();
}

customers = getCustomers();
renderStats(); renderTable(); renderActivity();
document.querySelector("#customer-search").addEventListener("input", renderTable);
document.querySelector("#status-filter").addEventListener("change", renderTable);
document.querySelector("#detail-close").addEventListener("click", closeDetails);
document.querySelector("#detail-modal").addEventListener("click", (event) => { if (event.target.id === "detail-modal") closeDetails(); });
document.querySelector("#detail-renew").addEventListener("click", () => updateSubscription("renew"));
document.querySelector("#detail-cancel").addEventListener("click", () => updateSubscription("cancel"));
document.querySelector("#detail-delete").addEventListener("click", deleteCustomer);
document.querySelector("#admin-logout").addEventListener("click", () => { window.location.href = "index.html"; });
document.querySelector("#export-customers").addEventListener("click", () => {
  const header = "Name,Email,Plan,Billing cycle,Status,Next renewal,Joined\n";
  const rows = customers.map((customer) => [customer.name, customer.email, planName(customer), billingCycle(customer).label, customer.status, formatDate(customer.renewal), formatDate(customer.joined)].map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([header + rows], { type: "text/csv" })); link.download = "engati-host-customers.csv"; link.click(); URL.revokeObjectURL(link.href);
});
