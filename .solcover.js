module.exports = {
  client: require('ganache-cli'),
  providerOptions: {
    fork:
      'https://polygon-mainnet.g.alchemy.com/v2/3xc5Eh1ui8o_MrySO2Bcn2GRQk04Ky_q',
    port: 8555,
    network_id: 1337,
  },

  skipFiles: ['mocks'],
};
