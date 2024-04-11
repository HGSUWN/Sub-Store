// 解析输入类型
const type = /^1$|col|组合/i.test(type) ? 'collection' : 'subscription';

// 解析配置文件
let config;
try {
  config = JSON.parse($content ?? $files[0]);
} catch (e) {
  throw new Error('配置文件不是合法的 JSON');
}

// 解析输出规则
const outbounds = parseOutbounds(outbound);

// 并行生成代理并更新配置文件
await Promise.all([produceProxies(), updateConfig()]);

// 将配置文件转换为字符串
$content = JSON.stringify(config, null, 2);

// 解析输出规则
function parseOutbounds(outbound) {
  return outbound.split('🕳').filter(Boolean).map(parseOutbound);
}

// 解析单个输出规则
function parseOutbound(outboundString) {
  const [outboundPattern, tagPattern = '.*'] = outboundString.split('🏷');
  return {
    outboundRegex: createRegExp(outboundPattern),
    tagRegex: createRegExp(tagPattern),
  };
}

// 创建正则表达式
function createRegExp(pattern) {
  return new RegExp(pattern.replace('ℹ️', ''), pattern.includes('ℹ️') ? 'i' : undefined);
}

// 生成代理
async function produceProxies() {
  return await produceArtifact({
    name,
    type,
    platform: 'sing-box',
    produceType: 'internal',
    produceOpts: {
      'include-unsupported-proxy': includeUnsupportedProxy,
    },
  });
}

// 更新配置文件
async function updateConfig() {
  const tagMap = new Map();
  const compatibleTags = [];
  
  // 构建标签映射
  proxies.forEach(proxy => {
    if (!tagMap.has(proxy.tag)) {
      tagMap.set(proxy.tag, []);
    }
    tagMap.get(proxy.tag).push(proxy);
  });

  // 更新配置文件
  for (const configOutbound of config.outbounds) {
    for (const { outboundRegex, tagRegex } of outbounds) {
      if (outboundRegex.test(configOutbound.tag)) {
        const tags = getTags(tagMap, tagRegex);
        configOutbound.outbounds = (configOutbound.outbounds || []).concat(tags, compatibleTags);
        if (tags.length === 0 && compatibleTags.length === 0) {
          compatibleTags.push('COMPATIBLE');
        }
      }
    }
  }

  config.outbounds.push(...proxies);
}

// 获取匹配标签
function getTags(tagMap, regex) {
  const matchedTags = [];
  for (const [tag, proxies] of tagMap.entries()) {
    if (regex.test(tag)) {
      matchedTags.push(...proxies.map(proxy => proxy.tag));
    }
  }
  return matchedTags;
}