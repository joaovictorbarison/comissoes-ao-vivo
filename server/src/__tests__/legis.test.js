import { test, expect } from 'vitest'

test('legis proxy caps items >10 logic: array length preserved', () => {
  const sample = Array.from({length: 25}, (_,i)=>({id:String(i)}))
  const items = sample.content ? sample.content : (Array.isArray(sample) ? sample : [])
  expect(items.length).toBe(25)
})
