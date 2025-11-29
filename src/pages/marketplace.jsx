import React, {useEffect, useState} from 'react'
import { Link } from 'react-router-dom'

export default function Marketplace(){
  const [listings, setListings] = useState([])
  useEffect(()=> {
    fetch('/api/listing').then(r=>r.json()).then(j=> setListings(j.listings || []))
  },[])
  return (
    <div className="container">
      <h2>Marketplace</h2>
      <div className="card">
        {listings.length===0 ? <p>No listings</p> : listings.map(l => (
          <div key={l.id} style={{borderBottom:'1px solid #222', padding:8}}>
            <a href={`/listing/${l.id}`} style={{color:'#f6b93b'}}>{l.title}</a>
            <div>Price: {(l.price_cents/100).toFixed(2)} {l.currency} • Qty: {l.quantity}</div>
          </div>
        ))}
      </div>
    </div>
  )
}