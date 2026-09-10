const plans = {
  accelerator: 99,
  growth: 399,
  enterprise: 599
};
const billing = {
  quarterly: { multiplier: 1, months: 3 },
  "bi-annual": { multiplier: 2, months: 6 },
  yearly: { multiplier: 4, months: 12 }
};

const response = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  },
  body: JSON.stringify(body)
});

const getSecret = () => {
  if (!process.env.FLW_SECRET_KEY) throw new Error("FLW_SECRET_KEY is not configured");
  return process.env.FLW_SECRET_KEY;
};

const flutterwave = async (path, options = {}) => {
  const result = await fetch(`https://api.flutterwave.com/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${getSecret()}`, "Content-Type": "application/json" }
  });
  const data = await result.json();
  if (!result.ok || data.status !== "success") throw new Error(data.message || "Flutterwave request failed");
  return data;
};

export default async (event) => {
  if (event.httpMethod === "OPTIONS") return response({}, 204);
  try {
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const cycle = billing[body.billingCycle];
      const quarterlyPrice = plans[body.plan];
      if (!quarterlyPrice || !cycle || !body.email) return response({ error: "A valid plan, billing cycle, and email are required" }, 400);

      const txRef = `engati-${body.plan}-${body.billingCycle}-${crypto.randomUUID()}`;
      const amount = quarterlyPrice * cycle.multiplier;
      const redirectUrl = body.redirectUrl || `${event.headers.origin || ""}/?payment=flutterwave`;
      const checkout = await flutterwave("/payments", {
        method: "POST",
        body: JSON.stringify({
          tx_ref: txRef,
          amount,
          currency: process.env.FLW_CURRENCY || "USD",
          redirect_url: redirectUrl,
          payment_options: "card,banktransfer,ussd",
          customer: { email: body.email, name: body.name || "Engati Host customer" },
          customizations: { title: "Engati Host subscription", description: `${body.plan} ${body.billingCycle} subscription` }
        })
      });
      return response({ checkoutUrl: checkout.data.link, txRef, amount, currency: process.env.FLW_CURRENCY || "USD" });
    }

    if (event.httpMethod === "GET") {
      const transactionId = event.queryStringParameters?.transaction_id;
      if (!transactionId) return response({ error: "transaction_id is required" }, 400);
      const verification = await flutterwave(`/transactions/${encodeURIComponent(transactionId)}/verify`);
      const transaction = verification.data;
      const parts = String(transaction.tx_ref || "").split("-");
      const plan = parts[1];
      const billingCycle = parts[2];
      if (!plans[plan] || !billing[billingCycle]) return response({ verified: false, error: "Invalid payment reference" }, 400);
      const expectedAmount = plans[plan] * billing[billingCycle].multiplier;
      const valid = transaction.status === "successful"
        && transaction.currency === (process.env.FLW_CURRENCY || "USD")
        && Number(transaction.amount) >= expectedAmount;
      return response({ verified: valid, plan, billingCycle, amount: transaction.amount, currency: transaction.currency, txRef: transaction.tx_ref });
    }

    return response({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("Flutterwave payment error", error);
    return response({ error: error.message || "Unable to process payment" }, 500);
  }
};
