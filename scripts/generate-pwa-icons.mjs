import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const felt = [27, 94, 59]
const ivory = [255, 253, 248]
const ink = [36, 28, 24]
const red = [176, 32, 24]

function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (~crc) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([length, typeBytes, data, crc])
}

function insideRoundRect(x, y, left, top, right, bottom, radius) {
  if (x < left || y < top || x >= right || y >= bottom) {
    return false
  }
  const nearestX = Math.max(left + radius, Math.min(x, right - radius - 1))
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius - 1))
  const distanceX = x - nearestX
  const distanceY = y - nearestY
  return distanceX * distanceX + distanceY * distanceY <= radius * radius
}

function png(size) {
  const stride = size * 3 + 1
  const raw = Buffer.alloc(stride * size)
  const margin = Math.round(size * 0.08)
  const border = Math.max(2, Math.round(size * 0.018))
  const radius = Math.round(size * 0.08)
  const outer = {
    left: margin,
    top: margin,
    right: size - margin,
    bottom: size - margin,
  }
  const inner = {
    left: outer.left + border,
    top: outer.top + border,
    right: outer.right - border,
    bottom: outer.bottom - border,
  }

  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x += 1) {
      let color = felt
      if (insideRoundRect(x, y, outer.left, outer.top, outer.right, outer.bottom, radius)) {
        color = ink
      }
      if (insideRoundRect(x, y, inner.left, inner.top, inner.right, inner.bottom, Math.max(1, radius - border))) {
        color = ivory
      }
      if (isZhong(x, y, size)) {
        color = red
      }
      const offset = y * stride + 1 + x * 3
      raw[offset] = color[0]
      raw[offset + 1] = color[1]
      raw[offset + 2] = color[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function isZhong(x, y, size) {
  const left = size * 0.3
  const right = size * 0.7
  const top = size * 0.28
  const bottom = size * 0.72
  const stroke = size * 0.055
  const centerX = (left + right) / 2
  const onVertical = Math.abs(x - centerX) <= stroke / 2 && y >= top && y < bottom
  const onTop = Math.abs(y - top) <= stroke / 2 && x >= left && x < right
  const onBottom = Math.abs(y - bottom) <= stroke / 2 && x >= left && x < right
  const onLeft = Math.abs(x - left) <= stroke / 2 && y >= top && y < bottom
  const onRight = Math.abs(x - right) <= stroke / 2 && y >= top && y < bottom
  return onVertical || onTop || onBottom || onLeft || onRight
}

writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), png(180))
writeFileSync(new URL('../public/pwa-192.png', import.meta.url), png(192))
writeFileSync(new URL('../public/pwa-512.png', import.meta.url), png(512))
