import TestCache from './test-cache'

describe('eager-cache', () => {
  test('synchronous load', async () => {
    const cache = new TestCache()
    cache.loadTimeMs = 0
    const value = await cache.get()
    expect(value).toEqual(true)
  })

  test('asynchronous load', async () => {
    const cache = new TestCache()
    cache.loadTimeMs = 1
    const value = await cache.get()
    expect(value).toEqual(true)
  })

  test('invalidate', async () => {
    const cache = new TestCache()
    cache.loadTimeMs = 0
    let value = await cache.get()
    expect(value).toEqual(true)
    cache.nextValue = false
    cache.invalidate()
    value = await cache.get()
    expect(value).toEqual(false)
  })

  test('invalidate during load', () => {
    return new Promise((done) => {
      const cache = new TestCache()
      cache.loadTimeMs = 100
      cache.nextValue = 1
      cache.load()
      cache.loadTimeMs = 0
      cache.nextValue = 2
      cache.invalidate()
      setTimeout(() => {
        cache.get().then((value) => {
          expect(value).toEqual(2)
          done()
        })
      }, 200)
    })
  })

  test('invalidate during get', () => {
    return new Promise((done) => {
      let cbs = 0
      function cb(): void {
        if (++cbs === 2) done()
      }
      const cache = new TestCache()
      cache.loadTimeMs = 100
      cache.nextValue = 1
      cache.get().then((value) => {
        expect(value).toEqual(2)
        cb()
      })
      cache.loadTimeMs = 10
      cache.nextValue = 2
      cache.invalidate()
      cache.get().then((value) => {
        expect(value).toEqual(2)
        setTimeout(() => cb(), 200)
      })
    })
  })

  test('fail to load', async () => {
    const cache = new TestCache()
    cache.loadWillFail = true
    try {
      await cache.get()
    } catch (err) {
      expect(err).toEqual(
        Error('Cache failed to load, or invalid cache state. State: FAILED')
      )
    }
  })

  test('cache can load after failure', async () => {
    const cache = new TestCache()
    cache.loadWillFail = true
    try {
      await cache.get()
    } catch (err) {
      expect(err).toEqual(
        Error('Cache failed to load, or invalid cache state. State: FAILED')
      )
    }
    cache.loadWillFail = false
    cache.nextValue = 3
    const value = await cache.get()
    expect(value).toEqual(3)
  })
})
