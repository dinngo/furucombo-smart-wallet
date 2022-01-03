require("@nomiclabs/hardhat-waffle");
// hardhat-deploy plugin is mainly for evm_snapshot functionality.
require('hardhat-deploy');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: "dice shove sheriff police boss indoor hospital vivid tenant method game matter",
        path: "m/44'/60'/0'/0",
        initialIndex: 0
      },
    },
    localhost: {/*
      accounts: {
        mnemonic: "dice shove sheriff police boss indoor hospital vivid tenant method game matter",
        path: "m/44'/60'/0'/0",
        initialIndex: 0
      },*/
      gasPrice: 1000000000,
      gas: 30000000,
      timeout: 900000,
    },
  },
  mocha: {
    timeout: 900000
  }
};