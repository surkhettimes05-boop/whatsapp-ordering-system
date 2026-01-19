module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        },
        modules: false  // Keep CommonJS, don't transform to ESM or vice versa
      }
    ]
  ]
};
