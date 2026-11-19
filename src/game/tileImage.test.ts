import { describe, expect, it } from 'vitest'
import { TILE_BACK_FILE, tileImageFile } from './tileImage'
import type { TileSuit } from './types'

const imagePaths = import.meta.glob('../../public/images/mahjong/*.png')
const files = new Set(
  Object.keys(imagePaths).map((path) => path.slice(path.lastIndexOf('/') + 1)),
)

describe('麻将牌图片', () => {
  it('34 种牌面和牌背都有本地图片', () => {
    expect(files.has(TILE_BACK_FILE)).toBe(true)
    const faces = [
      ...numberFaces('wan'),
      ...numberFaces('tiao'),
      ...numberFaces('tong'),
      { suit: 'wind' as const, primary: '东' },
      { suit: 'wind' as const, primary: '南' },
      { suit: 'wind' as const, primary: '西' },
      { suit: 'wind' as const, primary: '北' },
      { suit: 'zhong' as const, primary: '中' },
      { suit: 'fa' as const, primary: '发' },
      { suit: 'bai' as const, primary: '白' },
    ]
    const used = new Set<string>()
    for (const face of faces) {
      const file = tileImageFile(face)
      expect(file, face.primary).not.toBeNull()
      expect(files.has(file ?? '')).toBe(true)
      used.add(file ?? '')
    }
    expect(used.size).toBe(34)
    expect([...used].every((file) => file.endsWith('.png'))).toBe(true)
  })

  it('不认识的牌面不给出图片地址', () => {
    expect(tileImageFile({ suit: 'wan', primary: '拾' })).toBeNull()
    expect(tileImageFile({ suit: 'wind', primary: '龙' })).toBeNull()
  })
})

function numberFaces(suit: Extract<TileSuit, 'wan' | 'tiao' | 'tong'>) {
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九'].map((primary) => ({ suit, primary }))
}
