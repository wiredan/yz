import React, {useEffect, useState} from 'react'

export default function OrderTracking({orderId}) {
  const [timeline, setTimeline] = useState([])
  useEffect(()=> {
    fetch(`/api/order?order_id=${orderId}`).then(r=>r.json()).then(j => setTimeline(j.timeline || []))
  }, [orderId])
  return (
    <div className="container">
      <h2>Order Tracking</h2>
      <div className="card">
        {timeline.length===0 ? <p>No events yet</p> : (
          <ol>
            {timeline.map((t,i)=> <li key={i}><strong>{t.status}</strong> — {t.note} <small>({t.at})</small></li>)}
          </ol>
        )}
      </div>
    </div>
  )
}