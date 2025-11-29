import React, {useEffect, useState} from 'react'

export default function Education(){
  const [items, setItems] = useState([])
  useEffect(()=>{
    fetch('/education').then(r=>r.json()).then(j=> setItems(j.items || []))
  },[])
  return (
    <div className="container">
      <h2>Education Hub</h2>
      <div className="card">
        <p>Resources refreshed every 30 minutes.</p>
        <ul>
          {items.length === 0 ? <li>No items cached</li> : items.map((it,i)=> <li key={i}><a href={it.link} target="_blank" rel="noreferrer">{it.title}</a></li>)}
        </ul>
      </div>
    </div>
  )
}