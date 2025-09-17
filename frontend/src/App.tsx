import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

const API_BASE = '/api'

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [assets, setAssets] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/assets`).then(r => r.json()).then(setAssets).catch(() => {})
  }, [])

  async function startScan() {
    const codeReader = new BrowserMultiFormatReader()
    const video = videoRef.current!
    await codeReader.decodeFromVideoDevice(undefined, video, (result, err) => {
      if (result) {
        setText(result.getText())
      }
    })
  }

  async function createAsset() {
    if (!text || !name) return
    const res = await fetch(`${API_BASE}/assets/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: text, name, asset_class_id: 1 }) })
    if (res.ok) {
      const a = await res.json()
      setAssets([a, ...assets])
      setName('')
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>On-Prem Asset Management</h1>
      <p>Scan a barcode and create an asset quickly.</p>
      <video ref={videoRef} style={{ width: '100%', maxWidth: 480, background: '#000' }}></video>
      <button onClick={startScan}>Start Camera</button>
      <div style={{ marginTop: 12 }}>
        <div>Scanned Tag: <b>{text}</b></div>
        <input placeholder="Asset name" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={createAsset}>Create</button>
      </div>
      <h2>Assets</h2>
      <ul>
        {assets.map(a => (
          <li key={a.id}>{a.tag} — {a.name} — {a.status}</li>
        ))}
      </ul>
    </div>
  )
}

