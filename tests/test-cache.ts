import { EagerCache } from '../src/eager-cache'

export default class TestCache extends EagerCache {
  loadTimeMs = 100
  invalidateTimeMs = 0
  loadWillFail = false
  invalidateWillFail = false
  nextValue: unknown

  constructor() {
    super({ moniker: 'TestCache' })
    this.invalidateTimeMs = 0
    this.nextValue = true
  }

  _load(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const loadTimeMs = this.loadTimeMs
      if (loadTimeMs === 0) {
        this.debug('loading', loadTimeMs)
        if (this.loadWillFail) {
          reject(Error('Failed to load.'))
        } else {
          resolve(this.nextValue)
        }
      } else {
        this.debug('loading', loadTimeMs)
        setTimeout(() => {
          this.debug('loaded', loadTimeMs)
          if (this.loadWillFail) {
            reject(Error('Failed to load.'))
          } else {
            resolve(this.nextValue)
          }
        }, this.loadTimeMs)
      }
    })
  }

  _invalidate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const invalidateTimeMs = this.invalidateTimeMs
      if (invalidateTimeMs === 0) {
        this.debug('invalidating', invalidateTimeMs)
        if (this.invalidateWillFail) {
          reject(Error('Failed to invalidate.'))
        } else {
          resolve()
        }
      } else {
        setTimeout(() => {
          this.debug('invalidating', invalidateTimeMs)
          if (this.invalidateWillFail) {
            reject(Error('Failed to invalidate.'))
          } else {
            resolve()
          }
        }, invalidateTimeMs)
      }
    })
  }
}
