# Zero-Cost WhatsApp COD Test Environment

This repository keeps the paid production Blueprint in `render.yaml` and provides a separate no-card test Blueprint in `render.free.yaml`.

## What the free environment tests

WhatsApp customer → catalog → categories → search → cart → coupon → address → serviceability → COD checkout → order → tracking → delivery → dashboard → SKU reconciliation.

Online Khalti/eSewa payments stay disabled in this environment.

## Deploy on Render for $0

1. Sign in to Render and connect this GitHub repository.
2. Choose **New → Blueprint**.
3. Select this repository and set **Blueprint Path** to:
   `render.free.yaml`
4. Use the `main` branch.
5. When Render asks for environment values, set:
   - `TEST_ADMIN_PHONE`: a phone number you will use to sign in to the test admin dashboard.
   - `TEST_ADMIN_PASSWORD`: at least 10 characters.
   - Leave Meta values blank until you create the free Meta Cloud API test setup.
   - `PUBLIC_BASE_URL`, `PUBLIC_SHOP_URL`, and `CORS_ORIGIN` can initially be set to the expected Render URL. After the first deploy, copy the exact `https://...onrender.com` URL from Render and update all three to that exact HTTPS origin if needed.
6. Deploy the Blueprint.

The free web service starts by applying all Prisma migrations and then running the idempotent demo seed. It creates:
- Test Groceries and Test Beverages categories
- TEST-RICE-5KG, TEST-MASALA-100G and TEST-JUICE-1L
- Birendranagar test service area
- coupon `TEST10` for 10% off
- the admin account only when both test admin variables are supplied

## Dashboard

Open:

`https://YOUR-RENDER-URL/commerce-admin`

Use `TEST_ADMIN_PHONE` and `TEST_ADMIN_PASSWORD`.

## Automated full-flow proof

On any database where the migrations have been applied:

```bash
npm run seed:free-test
npm run smoke:cod-flow
```

The smoke test uses the same WhatsApp commerce controller with Meta transport in mock-send mode. It proves the complete COD commerce lifecycle and fails if any stage breaks.

## Real WhatsApp test without paying

Create a Meta developer app with the WhatsApp product and use the temporary test credentials from Meta's WhatsApp Getting Started panel. Add these Render environment variables:

- `META_GRAPH_VERSION`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_VERIFY_TOKEN`
- `META_WHATSAPP_APP_SECRET`
- `META_CATALOG_ID`

Configure the webhook callback as:

`https://YOUR-RENDER-URL/api/v1/whatsapp/webhook`

Then send `menu` to the test WhatsApp number and test:

1. catalog
2. categories
3. `search rice`
4. add an item
5. `coupon TEST10`
6. checkout
7. enter `Birendranagar`
8. enter a delivery address
9. choose **Cash on delivery**
10. `track ORDER_NUMBER`
11. move the order through the admin dashboard to Delivered
12. verify Sales and SKU Reconciliation in the dashboard

## Free-tier limitations

This setup is for testing only. The free web filesystem is ephemeral, so uploaded media can disappear after restarts. The demo product records are in PostgreSQL and survive web-service sleep/restarts until the free database expires. Do not use this Blueprint for a real production launch.
