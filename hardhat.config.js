require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');
require('dotenv').config();

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
      forking: {
        url: process.env.POLYGON_MAINNET_NODE,
      },
      accounts: {
        mnemonic:
          'dice shove sheriff police boss indoor hospital vivid tenant method game matter',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
      },
      chainId: 137,
      initialBaseFeePerGas: 0,
      gasPrice: 0,
      gas: 30000000,
    },
    prod: {
      url: process.env.PROD_URL || 'https://rpc.ankr.com/polygon/',
      chainId: process.env.PROD_CHAIN_ID || 137,
      accounts:
        process.env.PROD_SECRET !== undefined ? [process.env.PROD_SECRET] : [],
    },
  },
  mocha: {
    timeout: 900000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY || '',
  },
};
