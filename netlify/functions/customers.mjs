import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "engati-host-customers", consistency: "strong" });
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  }
});

export default async (request) => {
  if (request.method === "OPTIONS") return json({}, 204);
  try {
    const blob = store();
    const customers = (await blob.get("customers", { type: "json" })) || [];
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const email = url.searchParams.get("email")?.toLowerCase();

    if (request.method === "GET") {
      if (id) return json(customers.find((customer) => customer.id === id) || null);
      if (email) return json(customers.find((customer) => customer.email === email) || null);
      return json(customers);
    }

    if (request.method === "POST") {
      const input = await request.json();
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

    if ((request.method === "PATCH" || request.method === "DELETE") && id) {
      const index = customers.findIndex((customer) => customer.id === id);
      if (index < 0) return json({ error: "Customer not found" }, 404);
      if (request.method === "DELETE") {
        await blob.setJSON("customers", customers.filter((customer) => customer.id !== id));
        return json({ deleted: true });
      }
      const updated = { ...customers[index], ...(await request.json()), updatedAt: new Date().toISOString() };
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
