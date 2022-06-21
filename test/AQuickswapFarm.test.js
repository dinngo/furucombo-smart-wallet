const {
  BN,
  ether,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const {
  DS_PROXY_REGISTRY,
  QUICKSWAP_DAI_WETH,
  QUICKSWAP_DAI_WETH_PROVIDER,
  QUICKSWAP_QUICK,
  QUICKSWAP_DQUICK,
  QUICKSWAP_DQUICK_PROVIDER,
  QUICKSWAP_STAKING_REWARD_FACTORY,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  getCallData,
  getActionReturn,
  impersonate,
} = require('./utils/utils');

const AQuickswapFarm = artifacts.require('AQuickswapFarm');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const TaskExecutor = artifacts.require('TaskExecutorMock');
const IToken = artifacts.require('IERC20');
const IDQuick = artifacts.require('IDQuick');

const IStakingRewards = artifacts.require('IStakingRewards');
const IStakingRewardsFactory = artifacts.require('IStakingRewardsFactory');

contract('AQuickswapFarm', function([_, owner, collector, user, dummy]) {
  const lpTokenAddress = QUICKSWAP_DAI_WETH;
  let lpTokenProvider = QUICKSWAP_DAI_WETH_PROVIDER;
  const fee = new BN('2000'); // 20% harvest fee

  let id;
  let initialEvmId;
  before(async function() {
    initialEvmId = await evmSnapshot();

    this.lpToken = await IToken.at(lpTokenAddress);
    this.dQuick = await IDQuick.at(QUICKSWAP_DQUICK);
    this.quick = await IDQuick.at(QUICKSWAP_QUICK);

    await impersonate(lpTokenProvider);
    await impersonate(QUICKSWAP_DQUICK_PROVIDER);

    this.stakingRewardsFactory = await IStakingRewardsFactory.at(
      QUICKSWAP_STAKING_REWARD_FACTORY
    );

    // staking rewards contract info, for fetching expect reward
    const stakingRewardsInfo = await this.stakingRewardsFactory.stakingRewardsInfoByStakingToken.call(
      this.lpToken.address
    );
    this.stakingRewardsContract = await IStakingRewards.at(
      stakingRewardsInfo.stakingRewards
    );

    // create QuickswapFarm action.
    this.aQuickswapFarm = await AQuickswapFarm.new(owner, collector, fee);

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

  after(async function() {
    await evmRevert(initialEvmId);
  });

  describe('collector', function() {
    it('has an collector', async function() {
      expect(await this.aQuickswapFarm.collector()).to.equal(collector);
    });
  });

  describe('stake', function() {
    it('stake LP token to mining pool', async function() {
      // Send LP token to user dsproxy
      const lpAmount = ether('1');
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

      // After stake all amount, LP token should be 0
      const lpAmountAfter = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );
      expect(lpAmountAfter).to.be.bignumber.zero;
    });

    it('should revert: zero LP token', async function() {
      // prepare data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [lpTokenAddress, ether('1')]),
      ]);

      // LP token should be 0
      const lpAmount = await this.lpToken.balanceOf.call(
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

    it('should revert: insufficient LP token', async function() {
      // prepare data
      const stakeAmount = ether('1');
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [lpTokenAddress, stakeAmount]),
      ]);

      // Send LP token to user dsproxy
      await this.lpToken.transfer(
        this.userProxy.address,
        stakeAmount.sub(new BN('1')),
        { from: lpTokenProvider }
      );

      // LP token should less than stakeAmount
      const lpAmount = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );
      expect(lpAmount).to.be.bignumber.lt(stakeAmount);

      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'stake: SafeERC20: low-level call failed'
      );
    });

    it('should revert: staking wrong LP token', async function() {
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

      // increase time 14 days in order to get reward
      await time.increase(time.duration.days(14));
    });

    it('get reward', async function() {
      // expect reward
      const expectReward = await this.stakingRewardsContract.earned.call(
        this.userProxy.address
      );

      const rewardAmountBefore = await this.dQuick.balanceOf.call(
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

      const rewardAmountAfter = await this.dQuick.balanceOf.call(
        this.userProxy.address
      );

      // reward should >= expectRewards
      expect(userReward).to.be.bignumber.gte(expectReward);

      expect(rewardAmountAfter).to.be.bignumber.gt(rewardAmountBefore);
      expect(rewardAmountAfter.sub(rewardAmountBefore)).to.be.bignumber.eq(
        userReward
      );
    });

    it('get reward and charge', async function() {
      // total reward
      const totalReward = await this.stakingRewardsContract.earned.call(
        this.userProxy.address
      );

      const expectCollectorReward = totalReward
        .mul(await this.aQuickswapFarm.harvestFee.call())
        .div(await this.aQuickswapFarm.FEE_BASE.call());
      const expectUserReward = totalReward.sub(expectCollectorReward);

      const rewardAmountBefore = await this.dQuick.balanceOf.call(
        this.userProxy.address
      );

      const collectorRewardAmountBefore = await this.dQuick.balanceOf.call(
        collector
      );

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

      const userReward = getActionReturn(receipt, ['uint256'])[0];

      const rewardAmountAfter = await this.dQuick.balanceOf.call(
        this.userProxy.address
      );

      const collectorRewardAmountAfter = await this.dQuick.balanceOf.call(
        collector
      );

      // event
      expectEvent(receipt, 'Charged', {
        rewardSource: this.stakingRewardsContract.address,
        rewardToken: this.dQuick.address,
        feeAmount: expectCollectorReward,
      });

      // user reward should greater or equal expectUserReward
      expect(userReward).to.be.bignumber.gte(expectUserReward);

      expect(rewardAmountAfter).to.be.bignumber.gt(rewardAmountBefore);
      expect(rewardAmountAfter.sub(rewardAmountBefore)).to.be.bignumber.eq(
        userReward
      );

      // collector reward should equal expectCollectorReward
      expect(
        collectorRewardAmountAfter.sub(collectorRewardAmountBefore)
      ).to.be.bignumber.eq(expectCollectorReward);
    });
  });

  describe('dQuick leave', async function() {
    it('dQuick leave', async function() {
      // transfer dQuick to user proxy
      const dQuickAmount = ether('5');
      await this.dQuick.transfer(this.userProxy.address, dQuickAmount, {
        from: QUICKSWAP_DQUICK_PROVIDER,
      });

      const quickAmountBefore = await this.quick.balanceOf.call(
        this.userProxy.address
      );

      // leave
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'dQuickLeave', [dQuickAmount]),
      ]);
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      // get estimate Quick amount
      const estimateQuickAmount = await this.dQuick.dQUICKForQUICK.call(
        dQuickAmount,
        receipt.receipt.blockNumber
      );

      const userQuickAmount = getActionReturn(receipt, ['uint256'])[0];

      const quickAmountAfter = await this.quick.balanceOf.call(
        this.userProxy.address
      );

      // check
      expect(userQuickAmount).to.be.bignumber.eq(estimateQuickAmount);
      expect(quickAmountAfter.sub(quickAmountBefore)).to.be.bignumber.eq(
        userQuickAmount
      );
    });

    it('should revert: zero dQuick', async function() {
      // leave
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'dQuickLeave', [0]),
      ]);

      // should fail
      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'dQuickLeave: zero amount'
      );
    });
  });

  describe('exit', async function() {
    it('exit', async function() {
      const userLPAmountBefore = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );

      // transfer lp token
      const lpAmount = ether('5');
      await this.lpToken.transfer(this.userProxy.address, lpAmount, {
        from: lpTokenProvider,
      });

      // staking
      let data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'stake', [this.lpToken.address, lpAmount]),
      ]);

      const userDQuickAmountBefore = await this.dQuick.balanceOf.call(
        this.userProxy.address
      );

      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      // increase time 14 days in order to get reward
      await time.increase(time.duration.days(14));

      const userExpectReward = await this.stakingRewardsContract.earned.call(
        this.userProxy.address
      );

      // exit
      data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'exit', [this.lpToken.address]),
      ]);

      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      const actionReturns = getActionReturn(receipt, ['uint256', 'uint256']);
      const returnedUserLPAmount = actionReturns[0];
      const returnedUserReward = actionReturns[1];

      const userLPAmountAfter = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );
      const userDQuickAmountAfter = await this.dQuick.balanceOf.call(
        this.userProxy.address
      );

      expect(returnedUserLPAmount).to.be.bignumber.eq(lpAmount);
      expect(returnedUserReward).to.be.bignumber.gte(userExpectReward);

      expect(userLPAmountAfter.sub(userLPAmountBefore)).to.be.bignumber.eq(
        returnedUserLPAmount
      );
      expect(
        userDQuickAmountAfter.sub(userDQuickAmountBefore)
      ).to.be.bignumber.eq(returnedUserReward);
    });

    it('should revert: zero lp token staking', async function() {
      // exit
      data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapFarm.address,
        getCallData(AQuickswapFarm, 'exit', [this.lpToken.address]),
      ]);

      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'exit: Cannot withdraw 0'
      );
    });
  });
});
