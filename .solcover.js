module.exports = {
  skipFiles: [
    './mocks',
    './examples',
    './interfaces',
    './externals/furucombo/interface',
    './externals/trevi/interfaces',
    './externals/trevi/libraries/boringcrypto/interfaces',
    './externals/furucombo/interface',
  ],

  mocha: {
    grep: '@skip-on-coverage', // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
};
