export const applyProxies = <T extends {}>(initialValue: T, proxyHandlers: ProxyHandler<T>[]): T =>
  proxyHandlers.reduce((target, handler) => new Proxy(target, handler), initialValue);
