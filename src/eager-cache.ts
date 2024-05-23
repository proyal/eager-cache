import { EventEmitter } from 'events'
import debug, { Debugger } from 'debug'

enum CacheState {
  Invalid = 'INVALID',
  Invalidating = 'INVALIDATING',
  Loading = 'LOADING',
  Ready = 'READY',
  Failed = 'FAILED'
}

export abstract class EagerCache extends EventEmitter {
  readonly moniker: string
  readonly debug: Debugger
  protected cacheState = CacheState.Invalid
  readonly ON_STATE_CHANGE = 'ON_STATE_CHANGE'
  protected loadCount = 0
  protected cache: unknown

  protected constructor({ moniker = 'EagerCache' } = {}) {
    super()
    this.moniker = moniker
    this.debug = debug('eager-cache:' + moniker)
    this.debug.enabled = true
  }

  setState(cacheState): void {
    if (this.cacheState === cacheState) return
    this.debug('Setting state:', cacheState)
    this.cacheState = cacheState
    this.emit(this.ON_STATE_CHANGE, cacheState)
  }

  canLoad(): boolean {
    return this.cacheState === CacheState.Invalid
      || this.cacheState === CacheState.Failed
  }

  load(): void {
    if (!this.canLoad()) return
    this.setState(CacheState.Loading)
    const loadCount = ++this.loadCount
    this.cache = null

    this.loadOnStateChange()
    this._load()
      .then((newCache) => {
        // In the unlikely event the cache was invalidated and began
        // another load during the course of this previous load, ignore this response.
        if (
          loadCount === this.loadCount &&
          this.cacheState === CacheState.Loading
        ) {
          this.cache = newCache
          this.setState(CacheState.Ready)
        } else {
          // Above ON_STATE_CHANGE handler should handle things in this situation.
          this.debug('_load() preempted by invalidation.')
        }
      })
      .catch((err) => {
        err.message = `Failed to fetch and save states. ${err.message}`
        this.debug(err)
        this.setState(CacheState.Failed)
      })
  }

  loadOnStateChange(): void {
    this.once(this.ON_STATE_CHANGE, () => {
      switch (this.cacheState) {
        case CacheState.Ready:
        case CacheState.Loading:
          return
        case CacheState.Invalidating:
          this.debug('Invalidating state while loading. Continuing to wait.')
          setImmediate(() => this.loadOnStateChange())
          return
        case CacheState.Invalid:
          this.debug('Invalid state while loading. Reloading.')
          setImmediate(() => this.load())
          return
        case CacheState.Failed:
          this.debug('Failed state while loading.')
          return
        default:
          this.debug(Error(`Unexpected state during load: ${this.cacheState}`))
      }
    })
  }

  abstract async _load(): Promise<unknown>

  async get(): Promise<unknown> {
    return await this._get()
  }

  _get(): Promise<unknown> {
    return new Promise((resolve, reject) =>
      this._getPromiseExecutor(resolve, reject)
    )
  }

  _getPromiseExecutor(resolve, reject): void {
    switch (this.cacheState) {
      case CacheState.Ready:
        resolve(this.cache)
        return
      case CacheState.Invalid:
      case CacheState.Failed:
        this.debug(
          `${this.cacheState} state while getting. Loading and waiting for state change.`
        )
        this.load()
        this._getOnStateChange(resolve, reject)
        return
      case CacheState.Loading:
      case CacheState.Invalidating:
        this.debug(
          `${this.cacheState} state while getting. Waiting for state change.`
        )
        this._getOnStateChange(resolve, reject)
        return
      default:
        reject(
          new Error(
            `Cache failed, or invalid cache state. State: ${this.cacheState}`
          )
        )
    }
  }

  _getOnStateChange(resolve, reject): void {
    this.once(this.ON_STATE_CHANGE, () => {
      switch (this.cacheState) {
        case CacheState.Ready:
          return resolve(this.cache)
        case CacheState.Loading:
        case CacheState.Invalid:
        case CacheState.Invalidating:
          this.debug(
            `Waited and reached ${this.cacheState} state while getting. Re-getting.`
          )
          setImmediate(() => this._getPromiseExecutor(resolve, reject))
          return
        default:
          return reject(
            Error(
              `Cache failed to load, or invalid cache state. State: ${this.cacheState}`
            )
          )
      }
    })
  }

  invalidate(): void {
    if (
      this.cacheState === CacheState.Invalid ||
      this.cacheState === CacheState.Invalidating
    )
      return

    this.setState(CacheState.Invalidating)
    this._invalidate()
      .then(() => {
        this.cache = null
        this.setState(CacheState.Invalid)
      })
      .catch((err) => {
        err.message = `Failed to invalidate cache. ${err.message}`
        this.setState(CacheState.Failed)
        this.emit('error', err)
      })
  }

  async _invalidate(): Promise<void> {
    return
  }
}
