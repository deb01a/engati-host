import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "engati-host-customers", consistency: "strong" });
const json = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  },
  body: JSON.stringify(body)
});

export default async (event) => {
  if (event.httpMethod === "OPTIONS") return json({}, 204);
  try {
    const blob = store();
    const customers = (await blob.get("customers", { type: "json" })) || [];
    const id = event.queryStringParameters?.id;
    const email = event.queryStringParameters?.email?.toLowerCase();

    if (event.httpMethod === "GET") {
      if (id) return json(customers.find((customer) => customer.id === id) || null);
      if (email) return json(customers.find((customer) => customer.email === email) || null);
      return json(customers);
    }

    if (event.httpMethod === "POST") {
      const input = JSON.parse(event.body || "{}");
      const customer = {
        ...input,
        id: input.id || crypto.randomUUID(),
        email: String(input.email || "").toLowerCase(),
        createdAt: input.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const withoutDuplicate = customers.filter((item) => item.email !== customer.email && item.id !== customer.id);
      await blob.setJSON("customers", [...withoutDuplicate, customer]);
      return json(customer, 201);
    }

    if ((event.httpMethod === "PATCH" || event.httpMethod === "DELETE") && id) {
      const index = customers.findIndex((customer) => customer.id === id);
      if (index < 0) return json({ error: "Customer not found" }, 404);
      if (event.httpMethod === "DELETE") {
        await blob.setJSON("customers", customers.filter((customer) => customer.id !== id));
        return json({ deleted: true });
      }
      const updated = { ...customers[index], ...JSON.parse(event.body || "{}"), updatedAt: new Date().toISOString() };
      customers[index] = updated;
      await blob.setJSON("customers", customers);
      return json(updated);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("Customer API error", error);
    return json({ error: "Unable to process customer request" }, 500);
  }
};
