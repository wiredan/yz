import { json, nowISO } from './utils.js'

// Bindings (these are provided by wrangler environment)
const D1 = globalThis.D1_BINDING
const KV = globalThis.KV_BINDING
const PAYSTACK_SECRET_KEY = globalThis.PAYSTACK_SECRET_KEY
const PAYSTACK_PUBLIC_KEY = globalThis.PAYSTACK_PUBLIC_KEY
const ESCROW_FEE_BUYER = parseFloat(globalThis.ESCROW_FEE_BUYER || 0.02)
const ESCROW_FEE_SELLER = parseFloat(globalThis.ESCROW_FEE_SELLER || 0.02)
const GEMINI_API_KEY = globalThis.GEMINI_API_KEY
const JWT_SECRET = globalThis.JWT_SECRET
const SITE_ORIGIN = globalThis.SITE_ORIGIN || 'https://wiredan.com'
const ADMIN_USER_IDS = (globalThis.ADMIN_USER_IDS || '').split(',')

addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request){
  const url = new URL(request.url)
  try {
    // frontend routes
    if (url.pathname === '/education') return handleEducation(request)
    // API routes
    if (url.pathname.startsWith('/api/signup')) return signup(request)
    if (url.pathname.startsWith('/api/oauth/start')) return oauthStart(request)
    if (url.pathname.startsWith('/api/oauth/callback')) return oauthCallback(request)
    if (url.pathname.startsWith('/api/kyc/start')) return kycStart(request)
    if (url.pathname.startsWith('/api/listing')) return listingHandler(request)
    if (url.pathname.startsWith('/api/order')) return orderHandler(request)
    if (url.pathname === '/api/paystack/escrow/init') return paystackEscrowInit(request)
    if (url.pathname === '/api/paystack/webhook') return paystackWebhook(request)
    if (url.pathname === '/api/paystack/verify') return paystackVerify(request)
    return new Response('Not Found', { status: 404 })
  } catch (err) {
    return json({ ok:false, error: err.message }, 500)
  }
}

/* ---------------------------
   EDUCATION HUB (cached via KV, refreshed every 30m)
   - For demo: returns static items or KV cache if exists
----------------------------*/
async function handleEducation(req){
  const cacheKey = 'education:cache'
  const cached = await KV.get(cacheKey)
  if (cached) return new Response(cached, { headers:{'content-type':'application/json'} })
  // Example sources (replace with real sources)
  const items = [
    { title: 'Maize Best Practices', link: 'https://example.com/maize' },
    { title: 'Rice Storage & Shipping', link: 'https://example.com/rice' }
  ]
  const payload = JSON.stringify({ items, updated_at: nowISO() })
  await KV.put(cacheKey, payload, { expirationTtl: 1800 }) // 30 minutes
  return new Response(payload, { headers:{'content-type':'application/json'} })
}

/* ---------------------------
   SIGNUP (email/password) - very minimal, hash in production
----------------------------*/
async function signup(req){
  const body = await req.json()
  const { email, password } = body
  if (!email || !password) return json({ ok:false, error: 'email & password required' }, 400)
  const id = crypto.randomUUID()
  // WARNING: store hashed password in production (bcrypt)
  await D1.prepare('INSERT INTO users (id, email, password, kyc_verified, created_at) VALUES (?, ?, ?, 0, ?)').bind(id, email, password, nowISO()).run()
  return json({ ok:true, id })
}

/* ---------------------------
   OAUTH placeholders (start/callback)
   Implement provider token exchange & user creation
----------------------------*/
async function oauthStart(req){
  const u = new URL(req.url)
  const provider = u.searchParams.get('provider') || 'google'
  // Build provider auth URL (server side). Keep client secrets in env.
  let redirectUrl = `${SITE_ORIGIN}/api/oauth/callback?provider=${provider}`
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', globalThis.OAUTH_GOOGLE_CLIENT_ID)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email')
    url.searchParams.set('redirect_uri', redirectUrl)
    return Response.redirect(url.toString(), 302)
  }
  // other providers similar
  return json({ ok:false, message:'provider not implemented' }, 400)
}

async function oauthCallback(req){
  // Exchange code in server, create or link user
  return json({ ok:true, message:'oauth callback — implement token exchange' })
}

/* ---------------------------
   KYC placeholder (Gemini)
   - Frontend should POST images/ids to /api/kyc/start
   - Worker forwards to KYC provider and stores result in users.kyc_verified
----------------------------*/
async function kycStart(req){
  // This is a placeholder. Implement provider API per their spec
  return json({ ok:true, message: 'KYC started (placeholder). Implement Gemini API calls.' })
}

/* ---------------------------
   LISTINGS (marketplace)
   - GET /api/listing -> list all
   - GET /api/listing?id=ID -> single listing
   - POST /api/listing -> create (KYC verified users only)
----------------------------*/
async function listingHandler(req){
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (id) {
      const row = await D1.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first()
      return json({ ok:true, listing: row || null })
    } else {
      const rows = await D1.prepare('SELECT * FROM listings ORDER BY created_at DESC').all()
      return json({ ok:true, listings: rows.results || [] })
    }
  }
  if (req.method === 'POST') {
    const body = await req.json()
    const { user_id, title, description, quantity, price_cents, currency } = body
    // verify KYC
    const user = await D1.prepare('SELECT kyc_verified FROM users WHERE id = ?').bind(user_id).first()
    if (!user || user.kyc_verified !== 1) return json({ ok:false, error:'only KYC-verified users can create listings' }, 403)
    const id = crypto.randomUUID()
    await D1.prepare('INSERT INTO listings (id, user_id, title, description, quantity, price_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user_id, title, description, quantity, price_cents, currency, nowISO()).run()
    // auto-create subaccount (accounts table)
    const accId = crypto.randomUUID()
    await D1.prepare('INSERT INTO accounts (id, user_id, balance_cents, currency) VALUES (?, ?, 0, ?)').bind(accId, user_id, currency).run()
    return json({ ok:true, id })
  }
  return json({ ok:false, error:'method not allowed' }, 405)
}

/* ---------------------------
   ORDER HANDLER + TRACKING
   - GET /api/order?order_id= -> returns timeline and status
   - POST /api/order -> create an order (buyer)
   - POST /api/order/confirm_received -> buyer confirm received => release escrow
   - POST /api/order/mark_shipped -> seller marks shipped
----------------------------*/
async function orderHandler(req){
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const orderId = url.searchParams.get('order_id')
    if (!orderId) return json({ ok:false, error:'order_id required' }, 400)
    const o = await D1.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first()
    if (!o) return json({ ok:false, error:'order not found' }, 404)
    // timeline from order events table? for simplicity, reconstruct events
    const timeline = []
    timeline.push({ status: o.status, note: 'Current order status', at: o.created_at })
    const escrow = await D1.prepare('SELECT * FROM escrow WHERE order_id = ?').bind(orderId).first()
    if (escrow) timeline.push({ status: 'escrow', note: `Escrow ${escrow.status}`, at: escrow.created_at })
    return json({ ok:true, order: o, timeline })
  }

  if (req.method === 'POST') {
    const url = new URL(req.url)
    // create basic order
    const body = await req.json()
    const { listing_id, buyer_id, quantity } = body
    // fetch listing
    const listing = await D1.prepare('SELECT * FROM listings WHERE id = ?').bind(listing_id).first()
    if (!listing) return json({ ok:false, error: 'listing not found' }, 404)
    const seller_id = listing.user_id
    const total_cents = listing.price_cents * (quantity || 1)
    const orderId = crypto.randomUUID()
    await D1.prepare('INSERT INTO orders (id, listing_id, buyer_id, seller_id, quantity, total_cents, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(orderId, listing_id, buyer_id, seller_id, quantity, total_cents, listing.currency, 'created', nowISO()).run()
    return json({ ok:true, order_id: orderId, total_cents })
  }

  return json({ ok:false, error:'method not allowed' }, 405)
}

/* ---------------------------
   PAYSTACK ESCROW: INIT
   POST /api/paystack/escrow/init { order_id, amount_cents }
   - calculates buyer fee, creates Paystack initialize call with metadata
----------------------------*/
async function paystackEscrowInit(req){
  if (req.method !== 'POST') return json({ ok:false, error:'method not allowed' }, 405)
  const body = await req.json()
  const { order_id, amount_cents } = body
  // fetch order and compute metadata
  const order = await D1.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first()
  if (!order) return json({ ok:false, error:'order not found' }, 404)
  const buyerFee = Math.round(amount_cents * ESCROW_FEE_BUYER)
  const total = Number(amount_cents) + Number(buyerFee)
  // Paystack initialize
  const init = await fetch('https://api.paystack.co/transaction/initialize', {
    method:'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
    },
    body: JSON.stringify({
      email: 'buyer@example.com', // frontend should pass buyer email
      amount: total,
      metadata: { order_id, buyer_id: order.buyer_id, seller_id: order.seller_id, type: 'escrow', buyer_fee: buyerFee }
    })
  })
  const j = await init.json()
  // return authorization url to frontend so user can complete payment
  return json(j)
}

/* ---------------------------
   PAYSTACK WEBHOOK
   - Paystack will POST to /api/paystack/webhook
   - Validate signature, then on success create escrow record and update orders
----------------------------*/
async function paystackWebhook(req){
  // signature verification placeholder: consider verifying X-Paystack-Signature header
  const body = await req.json()
  const event = body.event || body.event
  const data = body.data || body
  // For a successful charge
  if (data && data.status === 'success' && data.metadata && data.metadata.type === 'escrow') {
    // create escrow
    const order_id = data.metadata.order_id
    const buyer_id = data.metadata.buyer_id
    const seller_id = data.metadata.seller_id
    const amount = data.amount
    const escrowId = crypto.randomUUID()
    await D1.prepare('INSERT INTO escrow (id, order_id, buyer_id, seller_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(escrowId, order_id, buyer_id, seller_id, amount, 'held', nowISO()).run()
    await D1.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('paid_escrow', order_id).run()
    return new Response('ok', { status: 200 })
  }
  return new Response('ignored', { status: 200 })
}

/* ---------------------------
   PAYSTACK VERIFY (manual)
----------------------------*/
async function paystackVerify(req){
  const url = new URL(req.url)
  const reference = url.searchParams.get('reference')
  if (!reference) return json({ ok:false, error:'reference required' }, 400)
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
  })
  const data = await verifyRes.json()
  return json(data)
}

/* ---------------------------
   ESCROW RELEASE and REFUND functions (exposed endpoints might be built later)
----------------------------*/
export async function releaseEscrow(orderId, byUserId){
  // admin or buyer confirm logic must call this
  const row = await D1.prepare('SELECT * FROM escrow WHERE order_id = ?').bind(orderId).first()
  if (!row || row.status !== 'held') return { ok:false, error:'no held escrow' }
  // deduct seller fee
  const sellerFee = Math.round(row.amount_cents * ESCROW_FEE_SELLER)
  const payout = row.amount_cents - sellerFee
  // credit seller account
  await D1.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE user_id = ?').bind(payout, row.seller_id).run()
  await D1.prepare('UPDATE escrow SET status = ? WHERE order_id = ?').bind('released', orderId).run()
  await D1.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('released', orderId).run()
  // Optionally log fee: insert into fees table (not implemented)
  return { ok:true, payout, sellerFee }
}

export async function refundEscrow(orderId, byUserId){
  const row = await D1.prepare('SELECT * FROM escrow WHERE order_id = ?').bind(orderId).first()
  if (!row || row.status !== 'held') return { ok:false, error:'no held escrow' }
  // credit buyer account or initiate Paystack refund depending on business rules
  await D1.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE user_id = ?').bind(row.amount_cents, row.buyer_id).run()
  await D1.prepare('UPDATE escrow SET status = ? WHERE order_id = ?').bind('refunded', orderId).run()
  await D1.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('refunded', orderId).run()
  return { ok:true }
}