export function semPapelUrl(det) {
  return det?.urlSemPapel || null
}
export function proposituraUrl(det) {
  if (!det) return null
  if (det.urlSemPapel) return det.urlSemPapel
  const first = det.linksArquivosIniciais?.[0]
  if (first) {
    if (first.startsWith('http')) return first
    return `https://www.al.sp.gov.br${first}`
  }
  return null
}
export function votoUrl(vote) {
  return vote?.linkArquivo || vote?.linkArquivoPDF || null
}
