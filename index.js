/**
* - host 修改 Host 混淆. 默认为空 不修改. 例 a.189.cn
* - hostPrefix 为修改了 Host 的节点名添加前缀. 默认为空
* - hostSuffix 为修改了 Host 的节点名添加后缀. 默认为空. 例 [微博混淆]
* - path 修改 Path 路径. 默认为空 不修改. 例 /TS/recharge/tzUrl.html
* - pathPrefix 为修改了 Path 的节点名添加前缀. 默认为空
* - pathSuffix 为修改了 Path 的节点名添加后缀. 默认为空. 例 [广停路径]
* - port 修改 Port 端口 默认为空 不修改. 例 80
* - portPrefix 为修改了 Port 的节点名添加前缀. 默认为空
* - portSuffix 为修改了 Port 的节点名添加前缀. 默认为空. 例 [80]
* - method method 默认为空 不修改. 例 GET. 网络为 http 时, 可能需要设置此项
* - array 是否把 host, path 设为数组. 默认不是数组. 如果要用于 Clash 系的客户端输出, 应设为 true. 不需要的时候, 请不要传这个字段
* - defaultNetwork 默认的 network. 节点无 network 时, 将设置为此值. 最新版已默认为 http
* - 当 network 为 http 时:
defaultPath 默认的 path. 节点无 network 时, 将设置为此值. 最新版已默认为 /
* - defaultMethod 默认的 method. 节点无 method 时, 将设置为此值. 最新版已默认为 GET
**/

function operator(proxies = []) {
  return proxies.map((p = {}) => {
    const _ = lodash

    const host = _.get($arguments, 'host')
    const hostPrefix = _.get($arguments, 'hostPrefix')
    const hostSuffix = _.get($arguments, 'hostSuffix')
    const port = _.get($arguments, 'port')
    const portPrefix = _.get($arguments, 'portPrefix')
    const portSuffix = _.get($arguments, 'portSuffix')
    const defaultPath = _.get($arguments, 'defaultPath') || '/'
    let path = _.get($arguments, 'path')
    const pathPrefix = _.get($arguments, 'pathPrefix')
    const pathSuffix = _.get($arguments, 'pathSuffix')
    const defaultMethod = _.get($arguments, 'defaultMethod') || 'GET'
    let method = _.get($arguments, 'method')
    const array = _.get($arguments, 'array')
    const defaultNetwork = _.get($arguments, 'defaultNetwork') || 'http'
    
    let network = _.get(p, 'network')
    const type = _.get(p, 'type')
    const isReality = _.get(p, 'reality-opts')

    /* 只修改 vmess 和 vless */
    if (_.includes(['vmess', 'vless'], type)) {
      if (!network && !isReality) {
        network = defaultNetwork
        _.set(p, 'network', defaultNetwork)
      }
      if (host) {
        if (hostPrefix) {
          _.set(p, 'name', `${hostPrefix}${p.name}`)
        }
        if (hostSuffix) {
          _.set(p, 'name', `${p.name}${hostSuffix}`)
        }
        /* 把 非 server 的部分都设置为 host */
        _.set(p, 'servername', host)
        if (_.get(p, 'tls')) {
          /* skip-cert-verify 在这里设为 true 有需求就再加一个节点操作吧 */
          _.set(p, 'skip-cert-verify', true)
          // 这个应该没用了
          // _.set(p, 'tls-hostname', host)
          _.set(p, 'sni', host)
        }

        if (!isReality) {
          if (network === 'ws') {
            _.set(p, 'ws-opts.headers.Host', host)
          } else if (network === 'h2') {
            _.set(p, 'h2-opts.host', array ? [host] : host)
          } else if (network === 'http') {
            _.set(p, 'http-opts.headers.Host', array ? [host] : host)
          } else {
            // 其他? 谁知道是数组还是字符串...先按字符串吧
            _.set(p, `${network}-opts.headers.Host`, host)
          }
        }
      }

      if (network === 'http') {
        if (!_.get(p, 'http-opts.method') && !method) {
          method = defaultMethod
        }
        _.set(p, 'http-opts.method', method)
      }
    
      if (port) {
        _.set(p, 'port', port)
        if (portPrefix) {
          _.set(p, 'name', `${portPrefix}${p.name}`)
        }
        if (portSuffix) {
          _.set(p, 'name', `${p.name}${portSuffix}`)
        }
      }
      if (!isReality) {
        if (network === 'http') {
          let currentPath = _.get(p, 'http-opts.path')
          if (_.isArray(currentPath)) {
            currentPath = _.find(currentPath, i => _.startsWith(i, '/'))
          } else {
            path = currentPath
          }
          if (!_.startsWith(currentPath, '/') && !path) {
            path = defaultPath
          }
        }
        if (path) {
          if (pathPrefix) {
            _.set(p, 'name', `${pathPrefix}${p.name}`)
          }
          if (pathSuffix) {
            _.set(p, 'name', `${p.name}${pathSuffix}`)
          }
          if (network === 'ws') {
            _.set(p, 'ws-opts.path', path)
          } else if (network === 'h2') {
            _.set(p, 'h2-opts.path', path)
          } else if (network === 'http') {
            _.set(p, 'http-opts.path', array ? [path] : path)
          } else {
            // 其他? 谁知道是数组还是字符串...先按字符串吧
            _.set(p, `${network}-opts.path`, path)
          }
        } 
      }
    }
    return p
  })
}