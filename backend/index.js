import { Router } from "itty-router";
import { verifyWithGemini } from "./kyc/gemini.js";
import { startEscrowPayment, releaseEscrow } from "./escrow/paystack.js";
import { db } from "./db/client.js";

const router = Router();

// Helper for JSON responses
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// -------------------- USERS --------------------

// Register
router.post("/api/register", async (req) => {
  const { email, password } = await req.json();

  const id = crypto.randomUUID();

  await db
    .prepare("INSERT INTO users (id, email, password) VALUES (?, ?, ?)")
    .bind(id, email, password)
    .run();

  return json({ ok: true, user_id: id });
});

// Login
router.post("/api/login", async (req) => {
  const { email, password } = await req.json();

  const user = await db
    .prepare("SELECT * FROM users WHERE email = ? AND password = ?")
    .bind(email, password)
    .first();

  if (!user) return json({ error: "Invalid credentials" }, 401);

  return json({ ok: true, user });
});

// -------------------- KYC (GEMINI AI) --------------------

router.post("/api/kyc/start", async (req) => {
  const { user_id, id_document, selfie } = await req.json();

  const result = await verifyWithGemini(id_document, selfie);

  if (!result.verified) {
    return json({ ok: false, message: result.message });
  }

  await db
    .prepare(
      "UPDATE users SET kyc_verified = 1, kyc_status = 'verified', can_change_name = 0, legal_name = ? WHERE id = ?"
    )
    .bind(result.legal_name, user_id)
    .run();

  return json({ ok: true, legal_name: result.legal_name });
});

// -------------------- LISTINGS --------------------

router.post("/api/listings/create", async (req) => {
  const { user_id, title, description, price_cents, quantity, currency } =
    await req.json();

  const id = crypto.randomUUID();

  // only KYC users
  const kyc = await db
    .prepare("SELECT kyc_verified FROM users WHERE id = ?")
    .bind(user_id)
    .first();

  if (!kyc?.kyc_verified) {
    return json({ error: "KYC required" }, 403);
  }

  await db
    .prepare(
      "INSERT INTO listings (id, user_id, title, description, price_cents, quantity, currency) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, user_id, title, description, price_cents, quantity, currency)
    .run();

  return json({ ok: true, listing_id: id });
});

// -------------------- ORDERS --------------------

router.post("/api/orders/create", async (req) => {
  const { buyer_id, listing_id, quantity } = await req.json();

  const listing = await db
    .prepare("SELECT * FROM listings WHERE id = ?")
    .bind(listing_id)
    .first();

  if (!listing) return json({ error: "Listing not found" });

  if (quantity > listing.quantity)
    return json({ error: "Insufficient quantity" });

  const total_cents = listing.price_cents * quantity;
  const order_id = crypto.randomUUID();

  await db
    .prepare(
      "INSERT INTO orders (id, listing_id, buyer_id, seller_id, quantity, total_cents, currency) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      order_id,
      listing_id,
      buyer_id,
      listing.user_id,
      quantity,
      total_cents,
      listing.currency
    )
    .run();

  return json({ ok: true, order_id, total_cents });
});

// -------------------- ESCROW START --------------------

router.post("/api/escrow/pay", async (req) => {
  const { order_id, email } = await req.json();

  const order = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(order_id)
    .first();

  if (!order) return json({ error: "Order not found" });

  const paystackSession = await startEscrowPayment({
    email,
    amount_cents: order.total_cents,
    order_id,
  });

  return json(paystackSession);
});

// -------------------- RELEASE ESCROW --------------------

router.post("/api/escrow/release", async (req) => {
  const { order_id } = await req.json();

  const release = await releaseEscrow(order_id);

  return json(release);
});

// -------------------- DISPUTES --------------------

router.post("/api/dispute/open", async (req) => {
  const { order_id, reason } = await req.json();

  await db
    .prepare("UPDATE orders SET status = 'dispute' WHERE id = ?")
    .bind(order_id)
    .run();

  const id = crypto.randomUUID();

  await db
    .prepare(
      "INSERT INTO events (id, entity_type, entity_id, action, payload) VALUES (?, 'order', ?, 'dispute_open', ?)"
    )
    .bind(id, order_id, reason)
    .run();

  return json({ ok: true });
});

// Admin resolve dispute
router.post("/api/admin/dispute/resolve", async (req) => {
  const { order_id, action } = await req.json();

  // action = "release" or "refund"

  if (action === "release") {
    await releaseEscrow(order_id);
  }

  await db
    .prepare("UPDATE orders SET status = ? WHERE id = ?")
    .bind(action === "refund" ? "refunded" : "released", order_id)
    .run();

  return json({ ok: true });
});

// --------------------------------------------------------

router.all("*", () => json({ error: "Not found" }, 404));

export default {
  fetch: router.handle,
};