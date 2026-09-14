# Engati Host

A Netlify-ready static website for Engati Host. It includes:

- Responsive marketing page
- Product feature and use-case sections
- Accelerator, Growth, and Enterprise plans with quarterly, bi-annual, and yearly billing
- Login and sign-up flow backed by Netlify Blobs, with browser `localStorage` fallback for offline demos
- Customer dashboard with plan status and subscription history
- Admin portal at `/admin.html` for customer search, subscription status, renewal/cancellation actions, subscription-history add/edit/delete controls, detail views, and CSV export
- Netlify Function API at `/.netlify/functions/customers` backed by Netlify Blobs
- Flutterwave checkout integration with hosted Accelerator quarterly and bi-annual links

## Run locally

Open `index.html` directly, or run:

```bash
npm start
```

Open `admin.html` to try the customer operations dashboard. Customer profiles and
subscription history are synchronized through Netlify Blobs, so the same records
can be used from the public site, admin site, and different browsers. Administrators
can permanently delete a customer or add, edit, and delete
individual subscription history records from the profile dialog; after a
customer deletion, that email can register again.

## Configure Flutterwave

Quarterly prices are the base prices: $99, $399, and $599. Bi-annual billing is twice the quarterly price, and yearly billing is four times the quarterly price. The Accelerator quarterly checkout uses the existing hosted Flutterwave link, and the Accelerator bi-annual checkout uses `https://flutterwave.com/pay/nitwcovbb7we`. The account is created without a subscription; a plan is selected and paid for separately. Add the Flutterwave server-side verification credentials through Netlify environment variables before enabling dynamic checkout.

## Production backend

The customer management function uses Netlify Blobs for persistence. The frontend
uses `/.netlify/functions/customers` for shared reads and writes.

```text
Authorization: Bearer YOUR_ADMIN_API_KEY
```

Supported operations are `GET /customers`, `GET /customers?id=...`,
`GET /customers?email=...`, `POST /customers`, `PATCH /customers?id=...`, and
`DELETE /customers?id=...`. Add admin authentication before exposing write
operations publicly.

The sign-up page does not require email verification. For production
authentication, replace the demo password flow with a secure provider or backend,
protect admin writes with authentication, and verify Flutterwave transactions
server-side. Never store Flutterwave secret keys in frontend code.
