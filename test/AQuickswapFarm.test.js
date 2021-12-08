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
  expectEqWithinBps,
} = require('./utils/utils');

const AQuickswapFarm = artifacts.require('AQuickswapFarm');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const TaskExecutor = artifacts.require('TaskExecutorMock');
const IToken = artifacts.require('IERC20');

const IStakingRewards = artifacts.require('IStakingRewards');
const IStakingRewardsFactory = artifacts.require('IStakingRewardsFactory');

async function getErc20TokenBalance(token, owner) {
  const erc20Token = await IToken.at(token);
  const balance = await erc20Token.balanceOf.call(owner);

  return balance;
}

contract('AQuickswapFarm', function([_, owner, collector, user, dummy]) {
  const lpTokenAddress = QUICKSWAP_WETH_QUICK;
  const lpTokenProvider = QUICKSWAP_WETH_QUICK_PROVIDER;
  const dummyAmount = ether('0.01');

  before(async function() {
    this.lpToken = await IToken.at(lpTokenAddress);
    // this.dQuick = await IToken.at(QUICKSWAP_DQUICK);

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
        getCallData(AQuickswapFarm, 'stake', [lpTokenAddress, lpAmount]),
      ]);

      // stake
      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      // After stake, LP token should be 0
      const lpAmountAfter = await getErc20TokenBalance(
        this.lpToken.address,
        this.userProxy.address
      );
      expect(lpAmountAfter).to.be.bignumber.zero;
    });

    it('stake without any LP token', async function() {
      const lpSendAmount = ether('1');
      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [lpTokenAddress, lpSendAmount]),
      ]);

      // LP token should be 0
      const lpAmount = await getErc20TokenBalance(
        this.lpToken.address,
        this.userProxy.address
      );
      expect(lpAmount).to.be.bignumber.zero;

      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'stake: SafeERC20: low-level call failed'
      );
    });

    it('stake wrong LP token', async function() {
      const lpAmount = ether('1');
      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [dummy, lpAmount]),
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
      let data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [this.lpToken.address, lpAmount]),
      ]);

      // stake
      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      // After stake, LP token should be 0
      const lpAmountAfter = await getErc20TokenBalance(
        this.lpToken.address,
        this.userProxy.address
      );
      expect(lpAmountAfter).to.be.bignumber.zero;

      // increase time 30 days in order to get reward
      await time.increase(time.duration.days(30));

      // stake again to force update expected reward
      await this.lpToken.transfer(this.userProxy.address, ether('0.1'), {
        from: lpTokenProvider,
      });

      data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [
          this.lpToken.address,
          ether('0.1'),
        ]),
      ]);

      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      // stakingRewards contract info, for fetching expect reward
      const stakingRewardsInfo = await this.stakingRewardsFactory.stakingRewardsInfoByStakingToken.call(
        this.lpToken.address
      );
      this.stakingRewardsContract = await IStakingRewards.at(
        stakingRewardsInfo.stakingRewards
      );
    });

    it('get reward', async function() {
      // expect reward
      const expectReward = await this.stakingRewardsContract.rewards.call(
        this.userProxy.address
      );

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

      const userReward = getActionReturn(receipt, ['uint256'])[0];

      // reward should > expectRewards
      expect(userReward).to.be.bignumber.gte(expectReward);
    });

    it('get reward and charge', async function() {
      // total reward
      const totalReward = await this.stakingRewardsContract.rewards.call(
        this.userProxy.address
      );

      const expectUserReward = totalReward * 0.8;
      const expectCollectorReward = totalReward - expectUserReward;

      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'getRewardAndCharge', [lpTokenAddress]),
      ]);

      // getRewardAndCharge
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      // user reward should close to expectUserReward
      const userReward = getActionReturn(receipt, ['uint256'])[0];
      expectEqWithinBps(userReward, expectUserReward.toString(), 5);

      // collector reward should close to expectCollectorReward
      const collectorReward = await getErc20TokenBalance(
        QUICKSWAP_DQUICK,
        collector
      );
      expectEqWithinBps(collectorReward, expectCollectorReward.toString(), 5);
    });
  });
});
