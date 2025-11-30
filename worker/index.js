import { json, nowISO } from './utils.js'

export default {
  async fetch(request, env, ctx) {
    return handle(request, env);
  }
}

async function handle(request, env){
  const url = new URL(request.url)

  try {
    // frontend
    if (url.pathname === '/education') return handleEducation(request, env)

    // API routes
    if (url.pathname === '/api/signup') return signup(request, env)
    if (url.pathname.startsWith('/api/oauth/start')) return oauthStart(request, env)
    if (url.pathname.startsWith('/api/oauth/callback')) return oauthCallback(request, env)

    if (url.pathname.startsWith('/api/kyc/start')) return kycStart(request, env)

    if (url.pathname.startsWith('/api/listing')) return listingHandler(request, env)
    if (url.pathname.startsWith('/api/order')) return orderHandler(request, env)

    if (url.pathname === '/api/paystack/escrow/init') return paystackEscrowInit(request, env)
    if (url.pathname === '/api/paystack/webhook') return paystackWebhook(request, env)
    if (url.pathname === '/api/paystack/verify') return paystackVerify(request, env)

    return new Response('Not Found', { status: 404 })
  } catch (err) {
    return json({ ok:false, error: err.message }, 500)
  }
}

/* -----------------------------------
    EDUCATION HUB (KV cache 30min)
------------------------------------*/
async function handleEducation(req, env){
  const cacheKey = 'education:cache'
  const cached = await env.KV.get(cacheKey)
  if (cached) return new Response(cached, { headers:{'content-type':'application/json'} })

  const items = [
    { title: 'Maize Best Practices', link: 'https://example.com/maize' },
    { title: 'Rice Storage & Shipping', link: 'https://example.com/rice' }
  ]

  const payload = JSON.stringify({ items, updated_at: nowISO() })
  await env.KV.put(cacheKey, payload, { expirationTtl: 1800 })

  return new Response(payload, { headers:{'content-type':'application/json'} })
}

/* -----------------------------------
          SIGNUP (email/pass)
------------------------------------*/
async function signup(req, env){
  const body = await req.json()
  const { email, password } = body

  if (!email || !password)
    return json({ ok:false, error:'email & password required' }, 400)

  const id = crypto.randomUUID()

  await env.DB
    .prepare(
      'INSERT INTO users (id, email, password, kyc_verified, created_at) VALUES (?, ?, ?, 0, ?)'
    )
    .bind(id, email, password, nowISO())
    .run()

  return json({ ok:true, id })
}

/* -----------------------------------
        OAUTH (placeholder)
------------------------------------*/
async function oauthStart(req, env){
  const u = new URL(req.url)
  const provider = u.searchParams.get('provider') || 'google'

  let redirectUrl = `${env.SITE_ORIGIN}/api/oauth/callback?provider=${provider}`

  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', env.OAUTH_GOOGLE_CLIENT_ID)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email')
    url.searchParams.set('redirect_uri', redirectUrl)
    return Response.redirect(url.toString(), 302)
  }

  return json({ ok:false, message:'provider not implemented' }, 400)
}

async function oauthCallback(){
  return json({ ok:true, message:'oauth callback placeholder' })
}

/* -----------------------------------
       GEMINI KYC VERIFICATION
------------------------------------*/
async function kycStart(req, env){
  const body = await req.json()
  const { user_id, id_front, id_back, selfie } = body

  if (!user_id || !id_front || !selfie)
    return json({ ok:false, error:'missing KYC data' }, 400)

  // Gemini Vision API Request
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        requests: [
          { image:{content:id_front}, features:[{type:"TEXT_DETECTION"}] },
          { image:{content:id_back}, features:[{type:"TEXT_DETECTION"}] },
          { image:{content:selfie}, features:[{type:"FACE_DETECTION"}] }
        ]
      })
    }
  )

  const data = await geminiRes.json()

  if (data.error) {
    return json({ ok:false, error:'KYC failed', detail:data.error }, 400)
  }

  await env.DB
    .prepare(`UPDATE users SET kyc_verified = 1, kyc_status='verified', can_change_name=0 WHERE id = ?`)
    .bind(user_id)
    .run()

  return json({ ok:true, verified:true })
}

/* -----------------------------------
            LISTINGS
------------------------------------*/
async function listingHandler(req, env){
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (id) {
      const row = await env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(id).first()
      return json({ ok:true, listing: row || null })
    }

    const rows = await env.DB.prepare('SELECT * FROM listings ORDER BY created_at DESC').all()
    return json({ ok:true, listings: rows.results || [] })
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { user_id, title, description, quantity, price_cents, currency } = body

    // require KYC
    const user = await env.DB.prepare('SELECT kyc_verified FROM users WHERE id = ?').bind(user_id).first()
    if (!user || user.kyc_verified !== 1)
      return json({ ok:false, error:'KYC required to create listing' }, 403)

    const id = crypto.randomUUID()

    await env.DB
      .prepare(
        'INSERT INTO listings (id, user_id, title, description, quantity, price_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, user_id, title, description, quantity, price_cents, currency, nowISO())
      .run()

    const accId = crypto.randomUUID()
    await env.DB
      .prepare('INSERT INTO accounts (id, user_id, balance_cents, currency) VALUES (?, ?, 0, ?)')
      .bind(accId, user_id, currency)
      .run()

    return json({ ok:true, id })
  }

  return json({ ok:false, error:'method not allowed' }, 405)
}

/* -----------------------------------
             ORDERS
------------------------------------*/
async function orderHandler(req, env){
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const orderId = url.searchParams.get('order_id')
    if (!orderId) return json({ ok:false, error:'order_id required' }, 400)

    const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first()
    if (!o) return json({ ok:false, error:'order not found' }, 404)

    const escrow = await env.DB.prepare('SELECT * FROM escrow WHERE order_id = ?').bind(orderId).first()

    const timeline = [
      { status:o.status, at:o.created_at },
      escrow ? { status:'escrow '+escrow.status, at:escrow.created_at } : null
    ].filter(Boolean)

    return json({ ok:true, order:o, timeline })
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { listing_id, buyer_id, quantity } = body

    const listing = await env.DB.prepare('SELECT * FROM listings WHERE id = ?').bind(listing_id).first()
    if (!listing) return json({ ok:false, error:'listing not found' }, 404)

    const total_cents = listing.price_cents * (quantity || 1)
    const orderId = crypto.randomUUID()

    await env.DB.prepare(
      'INSERT INTO orders (id, listing_id, buyer_id, seller_id, quantity, total_cents, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      orderId,
      listing_id,
      buyer_id,
      listing.user_id,
      quantity,
      total_cents,
      listing.currency,
      'created',
      nowISO()
    ).run()

    return json({ ok:true, order_id:orderId, total_cents })
  }

  return json({ ok:false, error:'method not allowed' }, 405)
}

/* -----------------------------------
       PAYSTACK ESCROW INITIALIZE
------------------------------------*/
async function paystackEscrowInit(req, env){
  if (req.method !== 'POST')
    return json({ ok:false, error:'method not allowed' }, 405)

  const body = await req.json()
  const { order_id, amount_cents, buyer_email } = body

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first()
  if (!order) return json({ ok:false, error:'order not found' }, 404)

  const buyerFee = Math.round(amount_cents * parseFloat(env.ESCROW_FEE_BUYER || 0.02))
  const total = amount_cents + buyerFee

  const init = await fetch('https://api.paystack.co/transaction/initialize', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${env.PAYSTACK_SECRET_KEY}`
    },
    body:JSON.stringify({
      email: buyer_email,
      amount: total,
      metadata:{
        order_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        type:'escrow',
        buyer_fee: buyerFee
      }
    })
  })

  const j = await init.json()
  return json(j)
}

/* -----------------------------------
         PAYSTACK WEBHOOK
------------------------------------*/
async function paystackWebhook(req, env){
  const body = await req.json()
  const data = body.data

  if (data?.status === 'success' && data?.metadata?.type === 'escrow') {
    const orderId = data.metadata.order_id
    const amount = data.amount

    const escrowId = crypto.randomUUID()

    await env.DB.prepare(
      'INSERT INTO escrow (id, order_id, buyer_id, seller_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      escrowId,
      orderId,
      data.metadata.buyer_id,
      data.metadata.seller_id,
      amount,
      'held',
      nowISO()
    ).run()

    await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('paid_escrow', orderId).run()

    return new Response('ok')
  }

  return new Response('ignored')
}

/* -----------------------------------
         PAYSTACK VERIFY
------------------------------------*/
async function paystackVerify(req, env){
  const url = new URL(req.url)
  const reference = url.searchParams.get('reference')

  if (!reference) return json({ ok:false, error:'reference required' }, 400)

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers:{ Authorization:`Bearer ${env.PAYSTACK_SECRET_KEY}` }
  })

  const data = await verifyRes.json()
  return json(data)
}