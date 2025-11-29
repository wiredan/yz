import React, {useEffect, useState} from 'react'
import PaystackCheckout from '../components/PaystackCheckout'

export default function ListingPage({id}) {
  const [listing, setListing] = useState(null)
  useEffect(()=> {
    fetch(`/api/listing?id=${id}`).then(r=>r.json()).then(j=> setListing(j.listing))
  }, [id])
  if(!listing) return <div className="container card"><p>Loading...</p></div>
  const amountCents = listing.price_cents * listing.quantity
  return (
    <div className="container">
      <div className="card">
        <h2>{listing.title}</h2>
        <p>{listing.description}</p>
        <div>Qty: {listing.quantity}</div>
        <div>Price: {(listing.price_cents/100).toFixed(2)} {listing.currency}</div>
        <PaystackCheckout orderId={listing.id} amountCents={amountCents}/>
      </div>
    </div>
  )
}