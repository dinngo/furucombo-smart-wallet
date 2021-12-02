const { BN, ether } = require('@openzeppelin/test-helpers');

const {
  DS_PROXY_REGISTRY,
  QUICKSWAP_WMATIC_WETH,
  QUICKSWAP_WMATIC_WETH_PROVIDER,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getCallData,
} = require('./utils/utils');

const AQuickswapFarm = artifacts.require('AQuickswapFarm');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const TaskExecutor = artifacts.require('TaskExecutorMock');
const IToken = artifacts.require('IERC20');

contract('AQuickswapFarm', function([_, owner, collector, user, dummy]) {
  const stakingTokenAddress = QUICKSWAP_WMATIC_WETH;
  const stakingTokenProvider = QUICKSWAP_WMATIC_WETH_PROVIDER;

  before(async function() {
    this.stakingToken = await IToken.at(stakingTokenAddress);

    // create QuickswapFarm action.
    this.fee = new BN('2000'); // 20% harvest fee
    this.aQuickswapFarm = await AQuickswapFarm.new(owner, collector, this.fee);

    // Create user dsproxy
    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );

    // Create task executor
    this.executor = await TaskExecutor.new(owner);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('collector', function() {
    it('has an collector', async function() {
      expect(await this.aQuickswapFarm.collector()).to.equal(collector);
    });
  });

  describe('get reward', function() {
    it('normal', async function() {
      const stakingAmount = ether('10');

      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'getReward', [this.stakingToken.address]),
      ]);

      // Send token to user dsproxy
      await this.stakingToken.transfer(this.userProxy.address, stakingAmount, {
        from: stakingTokenProvider,
      });

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          //   value: dummyAmount,
        }
      );
    });
  });
});
