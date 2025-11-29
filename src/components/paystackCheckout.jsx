import React from 'react'

export default function PaystackCheckout({orderId, amountCents, onInit}) {
  async function start() {
    const res = await fetch('/api/paystack/escrow/init', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({order_id: orderId, amount_cents: amountCents})
    })
    const j = await res.json()
    if (j.authorization_url) window.location.href = j.authorization_url
    else alert('Failed to init payment')
    if(onInit) onInit(j)
  }
  return <button onClick={start}>Pay { (amountCents/100).toFixed(2) } via Paystack</button>
}