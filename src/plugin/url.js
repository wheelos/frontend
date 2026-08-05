export function pluginHttpUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}

export function pluginWebSocketUrl(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${window.location.host}${normalized}`;
}

