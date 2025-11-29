// Utility helpers for Worker
export function json(responseObj, status=200){
  return new Response(JSON.stringify(responseObj), { status, headers: {'content-type':'application/json'} })
}

export function nowISO(){ return new Date().toISOString() }

// Parse Paystack webhook signature check (Paystack sends X-Paystack-Signature header)
// For Cloudflare Workers, compute HMAC sha512 of body with PAYSTACK_SECRET_KEY and compare (example uses Web Crypto API)
export async function verifyPaystackSignature(request, secretKey) {
  const signature = request.headers.get('x-paystack-signature')
  if (!signature) return false
  const body = await request.clone().arrayBuffer()
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify'])
  const ok = await crypto.subtle.verify('HMAC', key, signatureToBuffer(signature), body) // signatureToBuffer: placeholder
  return ok
}

// NOTE: In some runtimes you implement signature verification differently.
// Placeholder helper: signatureToBuffer where Paystack sends hex string — implement as needed.
function signatureToBuffer(hex) {
  // convert hex to Uint8Array
  const len = hex.length / 2
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = parseInt(hex.substr(i*2,2),16)
  return arr.buffer
}