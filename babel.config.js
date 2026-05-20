module.exports = {
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic' }], // Using automatic runtime for React 17+
    '@babel/preset-typescript',
  ],
};