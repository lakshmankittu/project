
export default {
  basePath: 'https://lakshmankittu.github.io/project',
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};
