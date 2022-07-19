require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');
require('solidity-coverage');
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  //for hardhat-deploy
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    hardhat: {
      // forking: {
      //   url:
      //     'https://polygon-mainnet.g.alchemy.com/v2/3xc5Eh1ui8o_MrySO2Bcn2GRQk04Ky_q',
      // },
      // chainId: 137,
      initialBaseFeePerGas: 0,
      accounts: {
        mnemonic:
          'dice shove sheriff police boss indoor hospital vivid tenant method game matter',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
      },
    },
    localhost: {
      gasPrice: 0,
      gas: 30000000,
      timeout: 900000,
    },
    coverage: {
      url: 'http://127.0.0.1:8555/',
      chainId: 1337,
      forking: {
        url:
          'https://polygon-mainnet.g.alchemy.com/v2/3xc5Eh1ui8o_MrySO2Bcn2GRQk04Ky_q',
        // blockNumber: 30397489,
        // enabled: true,
      },
    },
  },
  mocha: {
    timeout: 900000,
  },
};
