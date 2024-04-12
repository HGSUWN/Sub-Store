class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.cache = new Map()
    this.keys = [] // 用于记录键的访问顺序
  }

  get(key) {
    if (!this.cache.has(key)) return null
    this.updateAccessOrder(key)
    return this.cache.get(key)
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.set(key, value)
    } else {
      if (this.cache.size >= this.maxSize) {
        this.evictLeastUsedKey()
      }
      this.cache.set(key, value)
      this.keys.unshift(key)
    }
    this.updateAccessOrder(key)
  }

  // 更新键的访问顺序
  updateAccessOrder(key) {
    this.keys = this.keys.filter(k => k !== key)
    this.keys.unshift(key)
  }

  // 删除最近最少使用的键
  evictLeastUsedKey() {
    const leastUsedKey = this.keys.pop()
    this.cache.delete(leastUsedKey)
  }
}

const cache = new LRUCache(MAX_CACHE_SIZE)

const fetchSubscriptions = async ({ name, type, includeUnsupportedProxy }) => {
  // 假设这里是 fetchSubscriptions 的实现
}

const parseOutbounds = outbound => outbound.split('🕳').filter(Boolean)

const getMatchedTags = (tag, outbounds, proxies) => {
  const matchedTags = new Set()
  for (const { outboundRegex, tagRegex } of outbounds) {
    if (outboundRegex.test(tag)) {
      for (const { tag } of proxies) {
        if (tagRegex.test(tag)) {
          matchedTags.add(tag)
        }
      }
    }
  }
  return [...matchedTags]
}

const main = async () => {
  try {
    const { type, name, outbound, includeUnsupportedProxy } = $arguments

    const config = JSON.parse($content ?? $files[0])
    const { value: proxies } = await fetchSubscriptions({ name, type, includeUnsupportedProxy })
    const outbounds = parseOutbounds(outbound)

    // 并行处理每个配置项的匹配标签
    config.outbounds = await Promise.all(config.outbounds.map(async configOutbound => {
      const matchedTags = getMatchedTags(configOutbound.tag, outbounds, proxies)
      return {
        ...configOutbound,
        outbounds: matchedTags.length === 0
          ? ['COMPATIBLE', { tag: 'COMPATIBLE', type: 'direct' }]
          : matchedTags
      }
    }))

    config.outbounds.push(...proxies)
    $content = JSON.stringify(config, null, 2)
  } catch (error) {
    console.error(error)
    throw new Error('执行出错')
  }
}

main().catch(console.error)
