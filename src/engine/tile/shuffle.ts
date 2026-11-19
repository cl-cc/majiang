/** 返回 [0, 1) 的随机数。测试可以传入固定序列，对局必须使用默认随机源。 */
export type RandomSource = () => number

/**
 * Fisher-Yates 洗牌，每种排列的机会相同。
 * 不会改动原数组。默认使用系统安全随机数，不按玩家或座位调整结果。
 * `random` 只留给测试注入；对局代码不要传入自己的随机源。
 */
export function shuffle<T>(items: readonly T[], random: RandomSource = defaultRandom): T[] {
  const result = items.slice()

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(random, index + 1)
    const current = result[index]
    const other = result[swapIndex]
    if (current === undefined || other === undefined) {
      throw new Error('洗牌失败')
    }
    result[index] = other
    result[swapIndex] = current
  }

  return result
}

function randomIndex(random: RandomSource, exclusiveMax: number): number {
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('随机源必须返回 [0, 1) 内的有限数字')
  }
  return Math.floor(sample * exclusiveMax)
}

function defaultRandom(): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi === undefined) {
    throw new Error('当前环境缺少安全随机数')
  }

  const buffer = new Uint32Array(1)
  cryptoApi.getRandomValues(buffer)
  const value = buffer[0]
  if (value === undefined) {
    throw new Error('当前环境缺少安全随机数')
  }

  // 除以 2^32，得到 [0, 1)。
  return value / 4294967296
}
