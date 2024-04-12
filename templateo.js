const cache = new Map()
const MAX_CACHE_SIZE = 100 // 最大缓存项数量
const CACHE_EXPIRY_TIME = 3600 * 1000 // 缓存过期时间，单位：毫秒，这里设置为1小时

const fetchSubscriptions = async ({ name, type, includeUnsupportedProxy }) => {
  // 假设这里是 fetchSubscriptions 的实现
}

const parseOutbounds = outbound => outbound.split('🕳').filter(Boolean)

const getMatchedTags = (tag, outbounds, proxies) => {
  const now = Date.now()
  const cached = cache.get(tag)
  if (cached && now - cached.timestamp < CACHE_EXPIRY_TIME) {
    return cached.data
  }

  const matchedTags = new Set()
  for (const { outboundRegex, tagRegex } of outbounds) {
    if (outboundRegex.test(tag)) {
      proxies.forEach(({ tag }) => {
        if (tagRegex.test(tag)) {
          matchedTags.add(tag)
        }
      })
    }
  }

  const result = [...matchedTags]
  cache.set(tag, { data: result, timestamp: now })

  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    cache.delete(oldestKey)
  }

  return result
}

const main = async () => {
  try {
    const { type, name, outbound, includeUnsupportedProxy } = $arguments

    const config = JSON.parse($content ?? $files[0])
    const { value: proxies } = await fetchSubscriptions({ name, type, includeUnsupportedProxy })
    const outbounds = parseOutbounds(outbound)

    for (const configOutbound of config.outbounds) {
      const matchedTags = getMatchedTags(configOutbound.tag, outbounds, proxies)
      configOutbound.outbounds = matchedTags.length === 0
        ? ['COMPATIBLE', { tag: 'COMPATIBLE', type: 'direct' }]
        : matchedTags
    }

    config.outbounds.push(...proxies)
    $content = JSON.stringify(config, null, 2)
  } catch (error) {
    console.error(error)
    throw new Error('执行出错')
  }
}

main(const MAX_CACHE_SIZE = 100).catch(console.error)
