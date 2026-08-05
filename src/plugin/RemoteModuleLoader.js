const scriptPromises = new Map();
const modulePromises = new Map();

function loadScript(url, remoteName) {
  const key = `${remoteName}:${url}`;
  if (scriptPromises.has(key)) {
    return scriptPromises.get(key);
  }
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dv-plugin-remote="${remoteName}"]`);
    if (existing && window[remoteName]) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.dvPluginRemote = remoteName;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load plugin frontend: ${url}`));
    document.head.appendChild(script);
  });
  scriptPromises.set(key, promise);
  promise.catch(() => {
    scriptPromises.delete(key);
    const failed = document.querySelector(`script[data-dv-plugin-remote="${remoteName}"]`);
    if (failed && !window[remoteName]) {
      failed.remove();
    }
  });
  return promise;
}

export async function loadRemoteModule(frontend, exposedModule) {
  const cacheKey = `${frontend.remoteName}:${frontend.remoteEntry}:${exposedModule}`;
  if (modulePromises.has(cacheKey)) {
    return modulePromises.get(cacheKey);
  }
  const promise = (async () => {
    await loadScript(frontend.remoteEntry, frontend.remoteName);
    const container = window[frontend.remoteName];
    if (!container) {
      throw new Error(`Plugin container was not registered: ${frontend.remoteName}`);
    }
    await __webpack_init_sharing__('default');
    try {
      await container.init(__webpack_share_scopes__.default);
    } catch (error) {
      if (!/already been initialized/i.test(String(error && error.message))) {
        throw error;
      }
    }
    const factory = await container.get(exposedModule);
    return factory();
  })();
  modulePromises.set(cacheKey, promise);
  promise.catch(() => modulePromises.delete(cacheKey));
  return promise;
}
