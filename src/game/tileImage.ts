import type { TileFace, TileSuit } from './types'

const RANK_CODE: Record<string, string> = {
  一: '1',
  二: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
}

const HONOR_CODE: Record<string, string> = {
  东: 'z1',
  南: 'z2',
  西: 'z3',
  北: 'z4',
  中: 'z5',
  发: 'z6',
  白: 'z7',
}

const SUIT_CODE: Record<Extract<TileSuit, 'wan' | 'tiao' | 'tong'>, string> = {
  wan: 'm',
  tiao: 's',
  tong: 'p',
}

export const TILE_BACK_FILE = 'back.png'

/** 牌面到本地图片文件名。对不上时返回 null，界面改回文字。 */
export function tileImageFile(face: Pick<TileFace, 'suit' | 'primary'>): string | null {
  if (face.suit === 'wan' || face.suit === 'tiao' || face.suit === 'tong') {
    const rank = RANK_CODE[face.primary]
    if (rank === undefined) {
      return null
    }
    return `${rank}${SUIT_CODE[face.suit]}.png`
  }
  const honor = HONOR_CODE[face.primary]
  return honor === undefined ? null : `${honor}.png`
}

function publicFile(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}

export function tileImageUrl(face: Pick<TileFace, 'suit' | 'primary'>): string | null {
  const file = tileImageFile(face)
  return file === null ? null : publicFile(`images/mahjong/${file}`)
}

export const TILE_BACK_URL = publicFile(`images/mahjong/${TILE_BACK_FILE}`)
