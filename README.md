# Engati Host

A Netlify-ready static website for Engati Host. It includes:

- Responsive marketing page
- Product feature and use-case sections
- Accelerator, Growth, and Enterprise plans with quarterly, bi-annual, and yearly billing
- Login and sign-up flow backed by browser `localStorage` for demo purposes
- Customer dashboard with plan status
- Admin portal at `/admin.html` for customer search, subscription status, renewal/cancellation actions, detail views, and CSV export
- Netlify Function API at `/.netlify/functions/customers` backed by Netlify Blobs
- Flutterwave checkout integration placeholder

## Run locally

Open `index.html` directly, or run:

```bash
npm start
```

Open `admin.html` to try the customer operations dashboard. Create a customer from
the homepage first, then refresh the admin page to see it in the browser-backed
demo customer list. Administrators can permanently delete a customer from the
profile dialog; after deletion, that email can register again.

## Configure Flutterwave

Quarterly prices are the base prices: $99, $399, and $599. Bi-annual billing is twice the quarterly price, and yearly billing is four times the quarterly price. Accelerator is currently the only package enabled for Flutterwave checkout; Growth and Enterprise remain visible as coming soon. The account is created without a subscription; a plan is selected and paid for separately. Add the Flutterwave server-side verification credentials through Netlify environment variables before enabling live checkout.

## Production backend

The customer management function uses Netlify Blobs for persistence. Set an
`ADMIN_API_KEY` environment variable in Netlify, then call the endpoint with:

```text
Authorization: Bearer YOUR_ADMIN_API_KEY
```

Supported operations are `GET /customers`, `GET /customers?id=...`,
`POST /customers`, and `PATCH /customers?id=...`. The visible admin page is a
local demo UI; wire its fetch calls to the function after adding your preferred
admin authentication provider.

The sign-up page in this starter stores accounts in the browser only so it can
be previewed without a database and does not require email verification. For
production authentication, replace that demo flow with a secure provider or
backend and verify Flutterwave transactions server-side. Never store Flutterwave
secret keys in frontend code.
