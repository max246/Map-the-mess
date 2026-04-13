module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: [
    // Transform import.meta.env.X → process.env.X for Jest compatibility
    function () {
      return {
        visitor: {
          MetaProperty(path) {
            // import.meta.env.X → process.env.X
            if (
              path.parentPath.isMemberExpression() &&
              path.parentPath.node.property.name === 'env'
            ) {
              path.parentPath.replaceWithSourceString('process')
            }
          },
        },
      }
    },
  ],
}
