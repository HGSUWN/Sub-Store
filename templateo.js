const cache = {}

const main = async () => {
  try {
    log(`🚀 开始`)
    const { type, name, outbound, includeUnsupportedProxy } = $arguments
    log(`传入参数 type: ${type}, name: ${name}, outbound: ${outbound}`)

    const config = JSON.parse($content ?? $files[0])
    const [proxiesResult, outboundsResult] = await Promise.allSettled([
      fetchSubscriptions({ name, type, includeUnsupportedProxy }),
      parseOutbounds(outbound)
    ])

    const proxies = proxiesResult.value
    const outbounds = outboundsResult.value
    const configOutbounds = config.outbounds

    for (const configOutbound of configOutbounds) {
      const matchedTags = getMatchedTags(configOutbound.tag, outbounds, proxies)

      if (matchedTags.length === 0) {
        const compatibleOutbound = { tag: 'COMPATIBLE', type: 'direct' }
        configOutbound.outbounds = ['COMPATIBLE', compatibleOutbound]
        log(`🕳 ${configOutbound.tag} 的 outbounds 为空, 自动插入 COMPATIBLE(direct)`)
      } else {
        configOutbound.outbounds = matchedTags
      }
    }

    config.outbounds.push(...proxies)
    $content = JSON.stringify(config, null, 2)

    log(`🔚 结束`)
  } catch (error) {
    console.error(error)
    throw new Error('执行出错')
  }
}

const parseOutbounds = outbound => outbound.split('🕳').filter(Boolean).map(parseOutbound)

const getMatchedTags = (tag, outbounds, proxies) => {
  if (!cache[tag]) {
    const matchedOutbounds = outbounds.filter(({ outboundRegex }) => outboundRegex.test(tag))
    cache[tag] = matchedOutbounds.flatMap(({ tagRegex }) =>
      proxies.filter(({ tag }) => tagRegex.test(tag)).map(({ tag }) => tag)
    )
  }
  return cache[tag]
}

main().catch(error => console.error(error))
