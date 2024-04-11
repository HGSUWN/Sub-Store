// 主函数
const main = async () => {
  log(`🚀 开始`)

  const { type, name, outbound, includeUnsupportedProxy } = $arguments
  log(`传入参数 type: ${type}, name: ${name}, outbound: ${outbound}`)

  const config = JSON.parse($content ?? $files[0])

  try {
    log(`② 获取订阅`)
    const proxiesPromise = fetchSubscriptions({ name, type, includeUnsupportedProxy })

    log(`③ outbound 规则解析`)
    const outbounds = outbound.split('🕳').filter(Boolean).map(parseOutbounds)

    // 等待所有异步请求完成
    const proxies = await proxiesPromise

    // 使用 Set 存储节点标签，以便快速查找
    const tagsSet = new Set(proxies.map(proxy => proxy.tag))

    // 一次性匹配所有出站节点和规则
    await Promise.all(config.outbounds.map(async outbound => {
      const matchedOutbounds = outbounds.filter(({ outboundRegex }) => outboundRegex.test(outbound.tag))
      const matchedTags = await filterTags(tagsSet, matchedOutbounds.map(({ tagRegex }) => tagRegex))
      const compatibleOutbound = { tag: 'COMPATIBLE', type: 'direct' }

      // 如果没有匹配的节点标签，则添加兼容节点
      if (matchedTags.length === 0) {
        config.outbounds.push(compatibleOutbound)
        log(`🕳 ${outbound.tag} 的 outbounds 为空, 自动插入 COMPATIBLE(direct)`)
        outbound.outbounds = [compatibleOutbound.tag]
      } else {
        outbound.outbounds = matchedTags
      }
    }))

    // 将所有订阅节点添加到配置中
    config.outbounds.push(...proxies)

    $content = JSON.stringify(config, null, 2)

    log(`🔚 结束`)
  } catch (error) {
    console.error(error)
    throw new Error('执行出错')
  }
}

// 根据规则筛选节点标签
const filterTags = async (tagsSet, regexArray) => {
  const tags = Array.from(tagsSet)
  const matchedTags = await Promise.all(regexArray.map(async regex => tags.filter(tag => regex.test(tag))))
  return matchedTags.flat()
}

// 执行主函数
main().catch(error => console.error(error))
