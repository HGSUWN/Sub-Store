const fetchSubscriptions = async ({ name, type, includeUnsupportedProxy }) => {
  // 假设这里是 fetchSubscriptions 的实现
}

const parseOutbounds = outbound => outbound.split('🕳').filter(Boolean)

const getMatchedTags = (tag, outbounds, proxies) => {
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
  return [...matchedTags]
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

main().catch(console.error)
