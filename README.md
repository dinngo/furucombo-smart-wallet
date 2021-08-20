# Furucombo-Smart-Wallet

## Overview

Furucombo-Smart-Wallet includes Task Executor and Actions.

### Installation

```console
$ npm install
```

### Test

The testing is performed through the fork function of [ganache-cli](https://github.com/trufflesuite/ganache-cli). The location of the data source is defined under `$POLYGON_MAINNET_NODE`. You may perform the testing by your own polygon mainnet node instance or service provider like [Infura](https://infura.io/).

```console
$ export POLYGON_MAINNET_NODE=https://polygon-mainnet.infura.io/v3/{Your_project_ID}
$ npm run test
```

or

```console
$ POLYGON_MAINNET_NODE=https://polygon-mainnet.infura.io/v3/{Your_project_ID} npm run test
```

### Usage

Furucombo-Smart-Wallet contracts contain two different parts, **Task Executor** and **Action**.

#### Task Executor

Task Executor is a multi-call architecture. It can execute multi-operations in a single transaction. Task Executor includes two call types of operation, `CallWithValue` and `DelegateCall.` Also, operation parameters may apply the execution result. For the details, please refer to the [Chained Input guideline](CHAINEDINPUT.md).

#### Action

Action is the contract delegate call by Task Executor for the specific contracts or specific operations.

## License

Furu-DSProxy is released under the [MIT License](LICENSE).
