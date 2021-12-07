const { BN, ether, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const {
  DS_PROXY_REGISTRY,
  QUICKSWAP_WETH_QUICK,
  QUICKSWAP_WETH_QUICK_PROVIDER,
  QUICKSWAP_DQUICK,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getCallData,
  getActionReturn,
} = require('./utils/utils');

const AQuickswapFarm = artifacts.require('AQuickswapFarm');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const TaskExecutor = artifacts.require('TaskExecutorMock');
const IToken = artifacts.require('IERC20');

const IStakingRewards = artifacts.require('IStakingRewards');
const IStakingRewardsFactory = artifacts.require('IStakingRewardsFactory');

contract('AQuickswapFarm', function([_, owner, collector, user, dummy]) {
  const lpTokenAddress = QUICKSWAP_WETH_QUICK;
  const lpTokenProvider = QUICKSWAP_WETH_QUICK_PROVIDER;
  const dummyAmount = ether('0.01');

  let stakingRewardsContract;

  before(async function() {
    this.lpToken = await IToken.at(lpTokenAddress);
    // this.dQuick = await IToken.at(QUICKSWAP_DQUICK);

    // this.stakingRewards = await IStakingRewards.at(
    //   '0x4b678cA360c5f53a2B0590e53079140F302A9DcD'
    // );

    this.stakingRewardsFactory = await IStakingRewardsFactory.at(
      '0x8aAA5e259F74c8114e0a471d9f2ADFc66Bfe09ed'
    );

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

  describe('stake', function() {
    it('stake LP token to mining pool', async function() {
      const lpAmount = ether('1');

      // Send LP token to user dsproxy
      await this.lpToken.transfer(this.userProxy.address, lpAmount, {
        from: lpTokenProvider,
      });

      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [lpTokenAddress]),
      ]);

      // stake
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      // After stake, LP token should be 0
      const lpAmountAfter = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );
      expect(lpAmountAfter).to.be.bignumber.zero;
    });

    it('stake without any LP token', async function() {
      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [lpTokenAddress]),
      ]);

      // LP token should be 0
      const lpAmount = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );
      expect(lpAmount).to.be.bignumber.zero;

      // stake
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );
    });

    it('stake wrong LP token', async function() {
      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [dummy]),
      ]);

      // stake
      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getStakingRewardsContract: StakingRewards contract not found'
      );
    });
  });

  describe('get reward', function() {
    beforeEach(async function() {
      // stake token before each test.
      const lpAmount = ether('10');
      await this.lpToken.transfer(this.userProxy.address, lpAmount, {
        from: lpTokenProvider,
      });
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [this.lpToken.address]),
      ]);

      // stake
      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      // After stake, LP token should be 0
      const lpAmountAfter = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );
      expect(lpAmountAfter).to.be.bignumber.zero;

      await time.increase(time.duration.days(30));

      const stakingRewardsInfo = await this.stakingRewardsFactory.stakingRewardsInfoByStakingToken.call(
        this.lpToken.address
      );
      console.log(stakingRewardsInfo.stakingRewards);

      this.stakingRewardsContract = await IStakingRewards.at(
        stakingRewardsInfo.stakingRewards
      );

      // stake
      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });
    });

    it.only('get reward', async function() {
      const expectRewards = await this.stakingRewardsContract.rewards.call(
        this.userProxy.address
      );
      console.log('expectRewards:' + JSON.stringify(expectRewards));

      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'getReward', [lpTokenAddress]),
      ]);

      // getReward
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );
      const actionReturn = getActionReturn(receipt, ['uint256'])[0];
      console.log('reward:' + JSON.stringify(actionReturn));

      expect(actionReturn).to.be.bignumber.gt(ether('0'));
    });
  });
});
