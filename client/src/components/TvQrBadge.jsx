import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'

export default function TvQrBadge() {
  const { id } = useParams()
  const [src, setSrc] = useState('')
  useEffect(()=>{
    if (!id) return
    let alive = true
    QRCode.toDataURL(`${window.location.origin}/reuniao/${id}`, { width: 512, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => { if (alive) setSrc(url) })
      .catch(()=>{})
    return ()=>{ alive = false }
  }, [id])
  return (
    <div className="flex flex-col items-center gap-1">
      {src && <img src={src} alt="QR code para acompanhar a reunião" className="h-[10vh] w-[10vh] bg-white p-1 rounded" />}
      <div className="text-[clamp(1.2vh,1.4vw,2.2vh)] font-semibold text-white/90">Aponte a câmera e acompanhe no celular</div>
    </div>
  )
}
