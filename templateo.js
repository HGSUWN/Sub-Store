/ 缓存对象
const cache = {};

// 主函数
const main = async () => {
  try {
    log(`🚀 开始`);
    const { type, name, outbound, includeUnsupportedProxy } = $arguments;
    log(`传入参数 type: ${type}, name: ${name}, outbound: ${outbound}`);

    const config = JSON.parse($content ?? $files[0]);

    // 获取订阅并解析出站规则
    const [proxies, outbounds] = await Promise.allSettled([
      fetchSubscriptions({ name, type, includeUnsupportedProxy }),
      parseOutbounds(outbound)
    ]);

    // 一次性匹配出站规则和节点标签
    config.outbounds.forEach(configOutbound => {
      const matchedOutbounds = outbounds.value.filter(({ outboundRegex }) => outboundRegex.test(configOutbound.tag));
      const matchedTags = matchedOutbounds.flatMap(({ tagRegex }) => getTagsFromCache(tagRegex) || filterTags(proxies.value, tagRegex));

      // 如果没有匹配的节点标签，则添加兼容节点
      if (matchedTags.length === 0) {
        const compatibleOutbound = { tag: 'COMPATIBLE', type: 'direct' };
        configOutbound.outbounds = ['COMPATIBLE'];
        log(`🕳 ${configOutbound.tag} 的 outbounds 为空, 自动插入 COMPATIBLE(direct)`);
        config.outbounds.push(compatibleOutbound);
      } else {
        configOutbound.outbounds = matchedTags;
      }
    });

    // 将所有订阅节点添加到配置中
    config.outbounds.push(...proxies.value);

    $content = JSON.stringify(config, null, 2);

    log(`🔚 结束`);
  } catch (error) {
    console.error(error);
    throw new Error('执行出错');
  }
};

// 解析出站规则
const parseOutbounds = outbound => outbound.split('🕳').filter(Boolean).map(parseOutbound);

// 从缓存中获取节点标签
const getTagsFromCache = regex => cache[regex.source];

// 根据规则筛选节点标签
const filterTags = (proxies, regex) => {
  const tags = proxies.filter(({ tag }) => regex.test(tag)).map(({ tag }) => tag);
  cache[regex.source] = tags; // 将解析结果缓存起来
  return tags;
};

// 执行主函数
main().catch(error => console.error(error));
