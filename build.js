const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['src/injected.js'],
  bundle: true,
  outfile: 'injected.js',
  format: 'iife',
  target: ['chrome100'],
  minify: true,
});

console.log('✅ injected.js bundled');
