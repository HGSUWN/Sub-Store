const { type, name, outbound, includeUnsupportedProxy } = $arguments;

// 标准化 type 变量
const isCollection = /^1$|col|组合/i.test(type);

let config;
try {
  config = JSON.parse($content ?? $files[0]);
} catch (e) {
  throw new Error('配置文件不是合法的 JSON');
}

// 提取出bounds信息
const outbounds = outbound
  .split('🕳')
  .filter(Boolean)
  .map(entry => {
    const [outboundPattern, tagPattern = '.*'] = entry.split('🏷');
    const outboundRegex = createRegExp(outboundPattern);
    const tagRegex = createRegExp(tagPattern);
    return { outboundRegex, tagRegex };
  });

// 更新 outbounds
config.outbounds.forEach(configOutbound => {
  outbounds.forEach(({ outboundRegex, tagRegex }) => {
    if (outboundRegex.test(configOutbound.tag)) {
      configOutbound.outbounds = configOutbound.outbounds || [];
      configOutbound.outbounds.push(...getTags(tagRegex));
    }
  });
});

// 添加兼容的outbounds
const hasCompatibleOutbound = outbounds.some(({ outboundRegex }) =>
  config.outbounds.every(configOutbound => !outboundRegex.test(configOutbound.tag))
);

if (hasCompatibleOutbound) {
  config.outbounds.push({ tag: 'COMPATIBLE', type: 'direct' });
  config.outbounds.forEach(configOutbound => {
    configOutbound.outbounds = configOutbound.outbounds || [];
    configOutbound.outbounds.push('COMPATIBLE');
  });
}

// 添加代理
config.outbounds.push(...proxies);

$content = JSON.stringify(config, null, 2);

function getTags(regex) {
  return (regex ? proxies.filter(proxy => regex.test(proxy.tag)) : proxies).map(proxy => proxy.tag);
}

function createRegExp(pattern) {
  return new RegExp(pattern.replace('ℹ️', ''), pattern.includes('ℹ️') ? 'i' : undefined);
}
