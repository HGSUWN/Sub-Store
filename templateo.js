const { type, name, outbound, includeUnsupportedProxy } = $arguments;

// 解析输入类型
const parsedType = /^1$|col|组合/i.test(type) ? 'collection' : 'subscription';

// 解析配置文件
let config;
try {
  config = JSON.parse($content ?? $files[0]);
} catch (e) {
  throw new Error('配置文件不是合法的 JSON');
}

// 解析输出规则
const outbounds = parseOutbounds(outbound);

// 生成代理并更新配置文件
await generateProxiesAndUpdateConfig();

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

// 生成代理并更新配置文件
async function generateProxiesAndUpdateConfig() {
  const proxies = await produceProxies();

  const tagMap = new Map();
  const compatibleTags = [];

  // 构建标签映射
  proxies.forEach(({ tag }) => {
    if (!tagMap.has(tag)) {
      tagMap.set(tag, []);
    }
    tagMap.get(tag).push(proxy);
  });

  // 更新配置文件
  config.outbounds.forEach((configOutbound) => {
    outbounds.forEach(({ outboundRegex, tagRegex }) => {
      if (outboundRegex.test(configOutbound.tag)) {
        const tags = getTags(tagMap, tagRegex);
        configOutbound.outbounds = [...(configOutbound.outbounds || []), ...tags, ...compatibleTags];
        if (tags.length === 0 && compatibleTags.length === 0) {
          compatibleTags.push('COMPATIBLE');
        }
      }
    });
  });

  config.outbounds.push(...proxies);
}

// 生成代理
async function produceProxies() {
  const produceOptions = {
    name,
    type: parsedType,
    platform: 'sing-box',
    produceType: 'internal',
    produceOpts: {
      'include-unsupported-proxy': includeUnsupportedProxy,
    },
  };
  return await produceArtifact(produceOptions);
}

// 获取匹配标签
function getTags(tagMap, regex) {
  const matchedTags = [];
  for (const [tag, proxies] of tagMap.entries()) {
    if (regex.test(tag)) {
      matchedTags.push(...proxies.map((proxy) => proxy.tag));
    }
  }
  return matchedTags;
}
