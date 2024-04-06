/**
 * 注意! 本脚本不进行域名解析 必须在此脚本操作前面先加一个 Sub-Store 的域名解析
 *
 * 使用示范: https://t.me/zhetengsha/1003
 *
 * HTTP META(https://github.com/xream/http-meta) 参数
 * 不测落地可以不用 HTTP META
 * - [http_meta_protocol]     协议 默认: http
 * - [http_meta_host]     服务地址 默认: 127.0.0.1
 * - [http_meta_port]     端口号 默认: 9876
 * - [http_meta_start_delay] 初始启动延时(单位: 毫秒) 默认: 3000
 * - [http_meta_proxy_timeout] 每个节点耗时(单位: 毫秒). 此参数是为了防止脚本异常退出未关闭核心. 设置过小将导致核心过早退出. 目前逻辑: 启动初始的延时 + 每个节点耗时. 默认: 10000
 *
 * 其它参数
 * - [no_entrance]     为 true 时, 将关闭入口检测(不可与落地检测同时关闭)
 * - [no_landing]     为 true 时, 将关闭落地检测(不可与入口检测同时关闭)
 * - [entrance_api]    入口检测服务商 sp-cn,ip-api,ip-sb 英文逗号分隔. 默认 sp-cn
 * - [landing_api]     落地检测服务商 sp-cn,ip-api,ip-sb 英文逗号分隔. 默认 ip-api
 * - [uniq]     根据落地 IP 去重(关闭落地检测时, 将按入口 IP 去重)
 * - [max_retry_count]     最大重试次数 默认: 2
 * - [retry_delay]     重试延时(单位: 毫秒) 默认: 1000
 * - [timeout]     超时(单位: 毫秒) 默认: 3000
 * - [limit]     并发数 默认: 15
 * - [debug]     debug
 */

async function operator(proxies = []) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  }
  const $ = $substore
  const cache = scriptResourceCache
  const { isIP } = ProxyUtils
  const entrances = {}
  const landings = {}
  let entranceAPIs = ($arguments.entrance_api || 'sp-cn')
    .split(/\s*[,，]\s*/g)
    .filter(i => ['sp-cn', 'ip-api', 'ip-sb'].includes(i))
  if (entranceAPIs.length === 0) {
    entranceAPIs = ['sp-cn']
  }
  console.log(`[入口检测服务商]`, entranceAPIs)
  let landingAPIs = ($arguments.landing_api || 'ip-api')
    .split(/\s*[,，]\s*/g)
    .filter(i => ['sp-cn', 'ip-api', 'ip-sb'].includes(i))
  if (landingAPIs.length === 0) {
    landingAPIs = ['ip-api']
  }
  console.log(`[落地检测服务商]`, landingAPIs)
  const no_entrance = $arguments.no_entrance
  const no_landing = $arguments.no_landing
  const debug = $arguments.debug
  const uniq = $arguments.uniq
  const max_retry_count = $arguments.max_retry_count ?? 2
  const retry_delay = $arguments.retry_delay ?? 1000
  const timeout = $arguments.timeout ?? 3000
  const limit = $arguments.limit ?? 15 // more than 20 concurrency may result in surge TCP connection shortage.
  const http_meta_host = $arguments.http_meta_host ?? '127.0.0.1'
  const http_meta_port = $arguments.http_meta_port ?? 9876
  const http_meta_protocol = $arguments.http_meta_protocol ?? 'http'
  const http_meta_api = `${http_meta_protocol}://${http_meta_host}:${http_meta_port}`
  // 若未手动关闭, 将按此超时设置自动关闭
  // 此参数是为了防止脚本异常退出未关闭核心. 设置过小将导致核心过早退出. 目前逻辑: 启动初始的延时 + 每个节点耗时(因为测入口的节点为全部节点, 测落地的节点为核心支持的有效节点 先偷懒按全部节点计算)
  const http_meta_start_delay = parseFloat($arguments.http_meta_start_delay ?? 3000)
  const http_meta_proxy_timeout = parseFloat($arguments.http_meta_proxy_timeout ?? 10000)
  const http_meta_timeout = http_meta_start_delay + proxies.length * http_meta_proxy_timeout
  let http_meta_pid
  let http_meta_ports = []

  if (!no_entrance) {
    const entranceList = [...new Set(proxies.filter(p => isIP(p.server)).map(c => c.server))]
    const entranceBatch = Math.ceil(entranceList.length / limit)
    for (let i = 0; i < entranceBatch; i++) {
      const current = []
      for (let ip of entranceList.splice(0, limit)) {
        current.push(
          Promise.any(entranceAPIs.map(service => entranceResolver(ip, ip, service)))
            .then(result => {
              entrances[ip] = result
              if (debug) {
                $.info(`Successfully resolved ip: ${ip} ➟ ${JSON.stringify(result, null, 2)}`)
              }
            })
            .catch(err => {
              if (debug) {
                $.error(`Failed to resolve ip: ${ip}: ${err}`)
              }
            })
        )
      }
      await Promise.all(current)
    }
  }

  let internalProxies = proxies
  if (!no_landing) {
    // 启动 HTTP META
    internalProxies = ProxyUtils.produce(proxies, 'ClashMeta', 'internal')
    const res = await $.http.post({
      url: `${http_meta_api}/start`,
      timeout,
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        proxies: internalProxies,
        timeout: http_meta_timeout,
      }),
    })
    let body = res.body
    try {
      body = JSON.parse(body)
    } catch (e) {}
    const { ports, pid } = body
    if (!pid || !ports) {
      throw new Error(`======== HTTP META 启动失败 ====\n${body}`)
    }
    http_meta_pid = pid
    http_meta_ports = ports
    console.log(
      `\n======== HTTP META 启动 ====\n[端口] ${ports}\n[PID] ${pid}\n[超时] 若未手动关闭 ${
        http_meta_timeout / 60 / 1000
      } 分钟后自动关闭\n[核心支持节点数] ${internalProxies.length}\n`
    )

    if (debug) {
      console.log(`[核心支持节点数据]\n${JSON.stringify(internalProxies, null, 2)}\n`)
    }

    $.info(`等待 ${http_meta_start_delay / 1000} 秒后开始检测`)
    await $.wait(http_meta_start_delay)

    const landingList = [...internalProxies]
    const landingBatch = Math.ceil(landingList.length / limit)
    for (let i = 0; i < landingBatch; i++) {
      const current = []
      for (let proxy of landingList.splice(0, limit)) {
        const index = internalProxies.indexOf(proxy)
        current.push(
          Promise.any(
            landingAPIs.map(service =>
              landingResolver(`http://${http_meta_host}:${http_meta_ports[index]}`, JSON.stringify(
                Object.fromEntries(
                  Object.entries(proxy).filter(([key]) => !/^(name|collectionName|subName|id|_.*)$/i.test(key))
                )
              ), service)
            )
          )
            .then(result => {
              landings[index] = result
              if (debug) {
                $.info(`Successfully resolved proxy: ${proxy.name} ➟ ${JSON.stringify(result, null, 2)}`)
              }
            })
            .catch(err => {
              if (debug) {
                $.error(`Failed to resolve proxy: ${proxy.name}: ${err}`)
              }
            })
        )
      }
      await Promise.all(current)
    }
  }

  let result = []
  const querySet = new Set()
  for (const [i, p] of internalProxies.entries()) {
    let entrance
    if (!no_entrance) {
      entrance = entrances[p.server]
      if (entrance) {
        entrance = parseInfo(entrance)
      }
    }
    let landing
    if (!no_landing) {
      landing = landings[i]
      if (landing) {
        landing = parseInfo(landing)
      }
    } else if (entrance) {
      landing = entrance
    }

    if (no_entrance && landing) {
      entrance = landing
    }

    if (debug) {
      if (!no_entrance) {
        console.log(`入口`, entrance)
      }

      if (!no_landing) {
        console.log(`落地`, landing)
      }
    }

    if (entrance && landing) {
      if (entrance.query === landing.query) {
        p.name = `${entrance.flag} ${entrance.loc} ${entrance.isp} [${p.type}] (${p.name})`
      } else {
        p.name = `${entrance.flag} ${entrance.loc} ${entrance.isp} ➮ ${landing.flag} ${landing.loc} ${landing.isp} [${p.type}] (${p.name})`
      }
      p.name = p.name.replace(/\s+/g, ' ').replace(/,/g, '')
      p._entrance = entrance
      p._landing = landing

      if (!uniq || !querySet.has(p._landing.query)) {
        querySet.add(p._landing.query)
        result.push(p)
      }
      if (no_landing) {
        delete p._landing
      }
      if (no_entrance) {
        delete p._entrance
      }
    }
  }

  if (!no_landing) {
    // stop http meta
    try {
      const res = await $.http.post({
        url: `${http_meta_api}/stop`,
        timeout,
        headers: {
          'Content-type': 'application/json',
        },
        body: JSON.stringify({
          pid: [http_meta_pid],
        }),
      })
      console.log(res.body)
    } catch (e) {
      console.log(e)
    }
  }

  return result

  async function entranceResolver(ip, _id, service = 'ip-api') {
    const id = `xname-entrance-${service}${_id}`
    const cached = cache.get(id)
    if (cached) {
      return cached
    }

    let retryCount = 0
    while (retryCount < max_retry_count) {
      try {
        if (service === 'ip-sb') {
          const res = await $.http.get({
            url: `https://api.ip.sb/geoip/${ip}`,
            timeout,
            headers,
          })
          const body = res.body
          let data = JSON.parse(body)
          if (!data.message) {
            data = {
              ...data,
              query: data.ip || '',
              isp: data.organization || '',
              country: data.country || '',
              city: data.city || '',
              regionName: data.region || '',
              countryCode: data.country_code || '',
            }
            cache.set(id, data)
            return data
          }
          throw new Error(data.message)
        } else if (service === 'sp-cn') {
          const res = await $.http.get({
            url: `https://forge.speedtest.cn/api/location/geo?ip=${ip}`,
            timeout,
            headers,
          })
          const body = res.body
          let data = JSON.parse(body)
          if (!data.message) {
            data = {
              ...data,
              query: data.ip || '',
              isp: data.isp || '',
              country: data.country || '',
              city: data.city || '',
              regionName: data.province || '',
              countryCode: data.country_code || '',
            }
            cache.set(id, data)
            return data
          }
          throw new Error(data.message)
        } else {
          const res = await $.http.get({
            url: `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,message,countryCode,country,city,query,isp,regionName`,
            timeout,
            headers,
          })
          const body = res.body
          const data = JSON.parse(body)
          if (data.status === 'success') {
            cache.set(id, data)
            return data
          }
          throw new Error(data.message)
        }
      } catch (e) {
        retryCount++
        await $.wait(retry_delay)
        if (retryCount === max_retry_count) {
          throw e
        }
      }
    }
  }
  async function landingResolver(proxy, _id, service = 'ip-api') {
    const id = `xname-landing-${service}${_id}`
    const cached = cache.get(id)
    if (cached) {
      return cached
    }

    let retryCount = 0
    while (retryCount < max_retry_count) {
      try {
        if (service === 'ip-sb') {
          const res = await $.http.get({
            url: `https://api.ip.sb/geoip`,
            timeout,
            proxy,
            headers,
          })
          const body = res.body
          let data = JSON.parse(body)
          if (!data.message) {
            data = {
              ...data,
              query: data.ip || '',
              isp: data.organization || '',
              country: data.country || '',
              city: data.city || '',
              regionName: data.region || '',
              countryCode: data.country_code || '',
            }
            cache.set(id, data)
            return data
          }
          throw new Error(data.message)
        } else if (service === 'sp-cn') {
          const res = await $.http.get({
            url: `https://forge.speedtest.cn/api/location/info`,
            timeout,
            proxy,
            headers,
          })
          const body = res.body
          let data = JSON.parse(body)
          if (!data.message) {
            data = {
              ...data,
              query: data.ip || '',
              isp: data.isp || '',
              country: data.country || '',
              city: data.city || '',
              regionName: data.province || '',
              countryCode: data.country_code || '',
            }
            cache.set(id, data)
            return data
          }
          throw new Error(data.message)
        } else {
          const res = await $.http.get({
            url: `http://ip-api.com/json?lang=zh-CN&fields=status,message,countryCode,country,city,query,isp,regionName`,
            timeout,
            proxy,
            headers,
          })
          const body = res.body
          const data = JSON.parse(body)
          if (data.status === 'success') {
            cache.set(id, data)
            return data
          }
          throw new Error(data.message)
        }
      } catch (e) {
        retryCount++
        await $.wait(retry_delay)
        if (retryCount === max_retry_count) {
          throw e
        }
      }
    }
  }
  function getflag(e) {
    const t = e
      .toUpperCase()
      .split('')
      .map(e => 127397 + e.charCodeAt())
    // return String.fromCodePoint(...t).replace(/🇹🇼/g, '🇨🇳');
    return String.fromCodePoint(...t).replace(/🇹🇼/g, '🇼🇸')
  }
  function parseInfo(info) {
    let loc = ''
    let city_regex = /(省|特别市|市|區|区|城)$/
    let city = info.city.replace(city_regex, '')
    let country = info.country.replace(/德意志联邦共和国/, '德国').replace(/(联邦)$/, '')
    let regionName = info.regionName.replace(city_regex, '')
    const isp_regex =
      /\s*(Co\.,?\s*?Ltd\.?|,?\s*?Inc\.?|\s+Ltd|Cloud Services|limited|Networks|Network|\s+LLC|Corporation|Technologies|Technology|Data Centers|Province|\.com|\.org|\.net|Hosting|\s+Host|\s+data center|Co\.,)\s*$/i
    let isp = info.isp
      .replace(/\s*communications/i, '')
      .replace(/\s*Industries Solutions/i, '')
      .replace(/\s*Enterprise Solutions/i, '')
      .replace(/(\s*)Cloud Service/i, '$1Cloud')
      .replace(/Hong Kong/i, 'HK')
      .replace(isp_regex, '')
      .replace(isp_regex, '')
    if (['CN'].includes(info.countryCode)) {
      if (regionName !== city) {
        loc = `${regionName} ${city}`
      } else {
        loc = `${city}`
      }
    } else {
      loc = `${country} ${city}`
    }
    return {
      ...info,
      city,
      country,
      flag: getflag(info.countryCode),
      loc,
      isp,
    }
  }
}