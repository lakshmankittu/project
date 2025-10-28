
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'https://lakshmankittu.github.io/project/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/project"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 530, hash: 'e1046cec0a569612bfe1effeccafd891a69aed0102a0c4fde6b58ef40d496406', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1043, hash: '4a0cd05def07f8976d694e2c0d5e95e5ca691c2d12e6b057634f14b69eb979ed', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 5621, hash: '1be1e01c0273c6269a3010cc1092759720d2ad2e0ecf7b64cd3e1447b8221a8a', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-5INURTSO.css': {size: 0, hash: 'menYUTfbRu8', text: () => import('./assets-chunks/styles-5INURTSO_css.mjs').then(m => m.default)}
  },
};
