// Paystack Escrow Integration for Wiredan Marketplace
// Handles: payment init → escrow hold → release → refund

const PAYSTACK_BASE = "https://api.paystack.co";

export async function startEscrowPayment({ email, amount_cents, order_id }) {
  const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

  const amount_with_fee = Math.round(amount_cents * 1.02); // Buyer fee 2%

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amount_with_fee, // kobo
      metadata: {
        order_id,
        escrow: true,
        fee_percent: 2,
      },
    }),
  });

  const res = await response.json();

  if (!res.status) {
    return { ok: false, error: res.message };
  }

  return {
    ok: true,
    payment_url: res.data.authorization_url,
    reference: res.data.reference,
  };
}

// Verify Paystack payment
export async function verifyPayment(reference) {
  const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${PAYSTACK_KEY}` },
    }
  );

  const res = await response.json();

  if (!res.status) return null;

  return res.data;
}

// Release escrow funds to seller
export async function releaseEscrow(order_id) {
  const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

  // You may store payout details in DB, here we assume seller receives payment.
  const payout = await fetch(`${PAYSTACK_BASE}/transaction/charge_authorization`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 0, // Amount handled by Paystack Split
      email: "seller@domain.com", // Replace with seller email from DB
      metadata: { order_id },
    }),
  });

  const res = await payout.json();

  if (!res.status) {
    return { ok: false, error: res.message };
  }

  return { ok: true, message: "Escrow released successfully" };
}

// Refund buyer in dispute cases
export async function refundBuyer(reference) {
  const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

  const response = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction: reference,
    }),
  });

  const res = await response.json();

  if (!res.status) {
    return { ok: false, error: res.message };
  }

  return { ok: true };
}