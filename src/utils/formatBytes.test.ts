import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1025, '1 KB'],
    [1029, '1 KB'],
    [1030, '1.01 KB'],
    [1280, '1.25 KB'],
    [1536, '1.5 KB'],
    [2043, '2 KB'],
    [1048575, '1024 KB'],
    [1048576, '1 MB'],
    [1572864, '1.5 MB'],
    [1293943, '1.23 MB'],
    [1299186, '1.24 MB'],
    [1073741824, '1024 MB'],
    [Number.MAX_SAFE_INTEGER, '8589934592 MB'],
  ])('formats %s bytes as %s for both number and bigint inputs', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
    expect(formatBytes(BigInt(bytes))).toBe(expected)
  })

  it('rounds exact halves up', () => {
    expect(formatBytes(1152)).toBe('1.13 KB')
    expect(formatBytes(1179648)).toBe('1.13 MB')
  })

  it('preserves significant digits in aggregates beyond the safe-integer range', () => {
    const bytes = 9007199254740993n * 1048576n + 524288n
    expect(formatBytes(bytes)).toBe('9007199254740993.5 MB')
  })

  it.each([-1, -1n, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid byte size %s instead of displaying a fallback',
    (size) => {
      expect(() => formatBytes(size)).toThrow(RangeError)
    },
  )
})
