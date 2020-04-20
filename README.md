# eager-cache

eager-cache is a module that implements the lifecycle of a single object cache. It exposes an abstract class that can load and hold a single object or array (or any single value) from any source with support for invalidation of the cached value.

A common use for something like this is to fetch a table of configuration values from a database, and keep it in memory for quick reuse. If a change occurs in the configuration table, the cache can be invalidated, forcing the application to re-fetch the cached object.

Notes about this implementation:
- You must extend this class with a new class that implements the `async _load()` function.
- Optionally, you can override the `async _invalidate()` function to perform any cleanup on the existing cache during invalidation.
- Invalidation is not automatic - it must be called explicitly.
- If `async _load()` fails, the current implementation leaves the cache in a failed state, and will not try to recover. I'd like to make this optional, in the future.
- Multiple attempts to get the contents of the cache while it's invalid, or loading, will not cause multiple load attempts. The calls will wait until the pending load is complete.
- eager-cache uses [debug](https://www.npmjs.com/package/debug). All eager-cache instances will have a logger named `eager-cache:moniker`, where moniker is defined in the eager-cache constructor. eager-cache logging isn't intended to be very verbose, but it will log most state changes, for example, when invalidated.

## Installation

```sh
npm install eager-cache
```

## Usage

Here's an example of how I like to implement an eager-cache.

```js
// configuration-cache.js

const { EagerCache } = require('eager-cache')

class ConfigurationCache extends EagerCache {
  constructor() {
    super({ moniker: 'ConfigurationCache' })
  }

  async _load() {
    // Let's say this returns an object, but it can be whatever.
    return await fetchConfigurations()
  }
}

const cache = new ConfigurationCache()

// You could just export the cache here, but I prefer this method
// because destructuring class functions is a bad idea.
module.exports = {
  getConfiguration: () => cache.get(),
  invalidate: () => cache.invalidate()
}
```

And here's how I'd use it.

```js
const { getConfiguration } = require('configuration-cache')

async function requestHandler(ctx) {
  const configuration = await getConfiguration()
  ctx.body = {
    serviceName: configuration.serviceName
  }
}
```

## Other considerations

- In your `async _load()` implementation, consider manipulating the results of your asynchronous call into a data structure that's more convenient. For example, turn an array into an object, if you'll always be looking things up by a single key.
- Overwrite `async _invalidate()` if you need to clean things up. For example, I have an implementation of this where I fetch several database connection configurations from a single table and instantiate them. If I invalidate the cache, and create all-new connections, I need to destroy the old connections.
