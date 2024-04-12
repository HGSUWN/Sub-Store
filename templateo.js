// 解析传入的参数
const { type, name, outbound, includeUnsupportedProxy } = $arguments
const isCollection = /^1$|col|组合/i.test(type)
const targetType = isCollection ? 'collection' : 'subscription'

// 解析配置文件
let config
try {
  config = JSON.parse($content ?? $files[0])
} catch (e) {
  throw new Error('配置文件不是合法的 JSON')
}

// 获取订阅信息
const proxies = await produceArtifact({
  name,
  type: targetType,
  platform: 'sing-box',
  produceType: 'internal',
  produceOpts: {
    'include-unsupported-proxy': includeUnsupportedProxy,
  },
})

// 解析传入的 outbound 规则
const outbounds = outbound
  .split('🕳')
  .filter(i => i)
  .map(i => {
    let [outboundPattern, tagPattern = '.*'] = i.split('🏷')
    const tagRegex = createRegExp(tagPattern)
    return [createRegExp(outboundPattern), tagRegex]
  })

// 根据 outbound 规则插入节点
config.outbounds.forEach(outbound => {
  outbounds.forEach(([outboundRegex, tagRegex]) => {
    if (outboundRegex.test(outbound.tag)) {
      if (!Array.isArray(outbound.outbounds)) {
        outbound.outbounds = []
      }
      const tags = getMatchingTags(proxies, tagRegex)
      outbound.outbounds.push(...tags)
    }
  })
})

// 检查空的 outbounds，自动插入 COMPATIBLE(direct)
let compatibleAdded = false
config.outbounds.forEach(outbound => {
  outbounds.forEach(([outboundRegex]) => {
    if (outboundRegex.test(outbound.tag)) {
      if (!Array.isArray(outbound.outbounds)) {
        outbound.outbounds = []
      }
      if (outbound.outbounds.length === 0 && !compatibleAdded) {
        config.outbounds.push({ tag: 'COMPATIBLE', type: 'direct' })
        compatibleAdded = true
      }
    }
  })
})

// 将处理后的 proxies 加入配置文件
config.outbounds.push(...proxies)

// 将处理后的配置文件转换成 JSON 字符串
$content = JSON.stringify(config, null, 2)

// 辅助函数：根据正则表达式获取匹配的标签
function getMatchingTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}

// 辅助函数：创建正则表达式
function createRegExp(pattern) {
  return new RegExp(pattern.replace('ℹ️', ''), pattern.includes('ℹ️') ? 'i' : undefined)
}log(`🚀 开始`)

let { type, name, outbound, includeUnsupportedProxy } = $arguments

log(`传入参数 type: ${type}, name: ${name}, outbound: ${outbound}`)

type = /^1$|col|组合/i.test(type) ? 'collection' : 'subscription'

log(`① 解析配置文件`)
let config
try {
  config = JSON.parse($content ?? $files[0])
} catch (e) {
  log(`${e.message ?? e}`)
  throw new Error('配置文件不是合法的 JSON')
}

log(`② 获取订阅`)
log(`将读取名称为 ${name} 的 ${type === 'collection' ? '组合' : ''}订阅`)
let proxies = await produceArtifact({
  name,
  type,
  platform: 'sing-box',
  produceType: 'internal',
  produceOpts: {
    'include-unsupported-proxy': includeUnsupportedProxy,
  },
})

log(`③ outbound 规则解析`)
const outbounds = outbound
  .split('🕳')
  .filter(i => i)
  .map(i => {
    let [outboundPattern, tagPattern = '.*'] = i.split('🏷')
    const tagRegex = createRegExp(tagPattern)
    log(`匹配 🏷 ${tagRegex} 的节点将插入匹配 🕳 ${createRegExp(outboundPattern)} 的 outbound 中`)
    return [outboundPattern, tagRegex]
  })

log(`④ outbound 插入节点`)
config.outbounds.forEach(outbound => {
  outbounds.forEach(([outboundPattern, tagRegex]) => {
    const outboundRegex = createRegExp(outboundPattern)
    if (outboundRegex.test(outbound.tag)) {
      outbound.outbounds ||= []
      const tags = getTags(proxies, tagRegex)
      log(`🕳 ${outbound.tag} 匹配 ${outboundRegex}, 插入 ${tags.length} 个 🏷 匹配 ${tagRegex} 的节点`)
      outbound.outbounds.push(...tags)
    }
  })
})

const compatibleOutbound = { tag: 'COMPATIBLE', type: 'direct' }

log(`⑤ 空 outbounds 检查`)
config.outbounds.forEach(outbound => {
  outbounds.forEach(([outboundPattern, tagRegex]) => {
    const outboundRegex = createRegExp(outboundPattern)
    if (outboundRegex.test(outbound.tag)) {
      outbound.outbounds ||= []
      if (outbound.outbounds.length === 0) {
        config.outbounds.push(compatibleOutbound.tag)
        log(`🕳 ${outbound.tag} 的 outbounds 为空, 自动插入 COMPATIBLE(direct)`)
        outbound.outbounds.push(compatibleOutbound.tag)
      }
    }
  })
})

config.outbounds.push(...proxies)

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}

function log(v) {
  console.log(`[📦 sing-box 模板脚本] ${v}`)
}

function createRegExp(pattern) {
  return new RegExp(pattern.replace('ℹ️', ''), pattern.includes('ℹ️') ? 'i' : undefined)
}

log(`🔚 结束`)
