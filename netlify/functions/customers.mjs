import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "engati-host-customers", consistency: "strong" });
const json = (body, statusCode = 200) => ({ statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
const authorized = (event) => Boolean(process.env.ADMIN_API_KEY && event.headers.authorization === `Bearer ${process.env.ADMIN_API_KEY}`);

export default async (event) => {
  if (event.httpMethod === "OPTIONS") return json({}, 204);
  if (!authorized(event)) return json({ error: "Unauthorized" }, 401);
  try {
    const id = event.queryStringParameters?.id;
    if (event.httpMethod === "GET") {
      const customers = (await store().get("customers", { type: "json" })) || [];
      return json(id ? customers.find((customer) => customer.id === id) || null : customers);
    }
    if (event.httpMethod === "POST") {
      const customers = (await store().get("customers", { type: "json" })) || [];
      const customer = { ...JSON.parse(event.body || "{}"), id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "active" };
      await store().setJSON("customers", [...customers, customer]);
      return json(customer, 201);
    }
    if (event.httpMethod === "PATCH" && id) {
      const customers = (await store().get("customers", { type: "json" })) || [];
      const index = customers.findIndex((customer) => customer.id === id);
      if (index < 0) return json({ error: "Customer not found" }, 404);
      customers[index] = { ...customers[index], ...JSON.parse(event.body || "{}"), updatedAt: new Date().toISOString() };
      await store().setJSON("customers", customers);
      return json(customers[index]);
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("Customer API error", error);
    return json({ error: "Unable to process customer request" }, 500);
  }
};
