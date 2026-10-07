export function formatBytes(size: number | bigint): string {
  if (typeof size === 'number' && !Number.isSafeInteger(size)) {
    throw new RangeError('Byte size must be a nonnegative safe integer or bigint.')
  }

  const bytes = BigInt(size)
  if (bytes < 0n) {
    throw new RangeError('Byte size must be nonnegative.')
  }
  if (bytes < 1024n) return `${bytes} B`

  const divisor = bytes < 1048576n ? 1024n : 1048576n
  const unit = bytes < 1048576n ? 'KB' : 'MB'
  const hundredths = (bytes * 100n + divisor / 2n) / divisor
  const fraction = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/, '')

  return `${hundredths / 100n}${fraction ? `.${fraction}` : ''} ${unit}`
}
