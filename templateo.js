async function main() {
  // 解构参数
  const { type, name, outbound, includeUnsupportedProxy } = $arguments;

  // 确定类型
  const isCollection = /^1$|col|组合/i.test(type);
  const dataType = isCollection ? 'collection' : 'subscription';

  // 解析配置文件
  const config = JSON.parse($content ?? $files[0]);

  // 并行获取订阅代理和解析bounds参数
  const [proxies, outbounds] = await Promise.all([
    fetchProxies({ name, dataType, includeUnsupportedProxy }),
    parseOutbounds(outbound),
  ]);

  // 并行处理outbounds并插入代理
  await Promise.all(
    config.outbounds.map(outbound =>
      insertOutboundNodes(outbound, outbounds, proxies)
    )
  );

  // 检查并添加兼容性outbound
  checkAndInsertCompatibleOutbound(config, outbounds);

  // 添加代理到config中
  config.outbounds.push(...proxies);

  // 存储修改后的config到$content中
  $content = JSON.stringify(config, null, 2);
}

// 异步获取订阅代理
async function fetchProxies({ name, dataType, includeUnsupportedProxy }) {
  return await produceArtifact({
    name,
    type: dataType,
    platform: 'sing-box',
    produceType: 'internal',
    produceOpts: {
      'include-unsupported-proxy': includeUnsupportedProxy,
    },
  });
}

// 异步解析bounds参数
async function parseOutbounds(outbound) {
  return await Promise.all(
    outbound.split('🕳').map(async i => {
      const [outboundPattern, tagPattern = '.*'] = i.split('🏷');
      const tagRegex = createRegExp(tagPattern);
      return [outboundPattern, tagRegex];
    })
  );
}

// 异步插入代理到outbound节点
async function insertOutboundNodes(outbound, outbounds, proxies) {
  await Promise.all(
    outbounds.map(async ([outboundPattern, tagRegex]) => {
      const outboundRegex = createRegExp(outboundPattern);
      if (outboundRegex.test(outbound.tag)) {
        outbound.outbounds ||= [];
        const tags = getTags(proxies, tagRegex);
        outbound.outbounds.push(...tags);
      }
    })
  );
}

// 检查并添加兼容性outbound
function checkAndInsertCompatibleOutbound(config, outbounds) {
  config.outbounds.forEach(outbound => {
    outbounds.forEach(([outboundPattern, tagRegex]) => {
      const outboundRegex = createRegExp(outboundPattern);
      if (outboundRegex.test(outbound.tag)) {
        outbound.outbounds ||= [];
        if (outbound.outbounds.length === 0) {
          config.outbounds.push({ tag: 'COMPATIBLE', type: 'direct' });
          outbound.outbounds.push('COMPATIBLE');
        }
      }
    });
  });
}

// 获取标签
function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag);
}

// 创建正则表达式
function createRegExp(pattern) {
  return new RegExp(pattern.replace('ℹ️', ''), pattern.includes('ℹ️') ? 'i' : undefined);
}

main(); // 执行主函数
