import React from 'react'

export default function Header({currency, setCurrency, language, setLanguage}) {
  const currencies = ['USDT','EUR','NGN','CYN','VND','SDA','DAN']
  const languages = ['English','Arabic','Chinese','French','Vietnamese','Hausa','Igbo','Yoruba']
  return (
    <header className="card" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
      <div><h1 style={{margin:0}}>Wiredan</h1></div>
      <div style={{display:'flex', gap:12, alignItems:'center'}}>
        <select value={currency} onChange={e=>setCurrency(e.target.value)} aria-label="currency">
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={language} onChange={e=>setLanguage(e.target.value)} aria-label="language">
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
    </header>
  )
}