const { BN, ether, expectRevert, time } = require('@openzeppelin/test-helpers');

const {
  DS_PROXY_REGISTRY,
  QUICKSWAP_LCD_MATIC,
  QUICKSWAP_LCD_MATIC_PROVIDER,
  QUICKSWAP_QUICK,
  QUICKSWAP_DQUICK,
  QUICKSWAP_DQUICK_PROVIDER,
  QUICKSWAP_STAKING_DUAL_REWARDS_FACTORY,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  getCallData,
  getActionReturn,
  getEventArgs,
  impersonate,
} = require('./utils/utils');

const AQuickswapDualMining = artifacts.require('AQuickswapDualMining');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const TaskExecutor = artifacts.require('TaskExecutorMock');
const IToken = artifacts.require('IERC20');
const IDQuick = artifacts.require('IDQuick');

const IStakingDualRewards = artifacts.require('IStakingDualRewards');
const IStakingDualRewardsFactory = artifacts.require(
  'IStakingDualRewardsFactory'
);

contract('AQuickswapDualMining', function([_, owner, collector, user, dummy]) {
  const lpTokenAddress = QUICKSWAP_LCD_MATIC;
  let lpTokenProvider = QUICKSWAP_LCD_MATIC_PROVIDER;
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

    this.stakingDualRewardsFactory = await IStakingDualRewardsFactory.at(
      QUICKSWAP_STAKING_DUAL_REWARDS_FACTORY
    );

    // staking dual rewards contract info, for fetching expect reward
    this.stakingRewardsInfo = await this.stakingDualRewardsFactory.stakingRewardsInfoByStakingToken.call(
      this.lpToken.address
    );
    this.stakingRewardsContract = await IStakingDualRewards.at(
      this.stakingRewardsInfo.stakingRewards
    );

    // create QuickswapFarm action.
    this.aQuickswapDualMining = await AQuickswapDualMining.new(
      owner,
      collector,
      fee
    );

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

  describe('constructor', function() {
    it('has an collector', async function() {
      expect(await this.aQuickswapDualMining.collector()).to.equal(collector);
    });

    it('has fee', async function() {
      expect(
        await this.aQuickswapDualMining.harvestFee.call()
      ).to.be.bignumber.equal(fee);
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'stake', [lpTokenAddress, lpAmount]),
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'stake', [
          lpTokenAddress,
          ether('1'),
        ]),
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'stake', [
          lpTokenAddress,
          stakeAmount,
        ]),
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'stake', [dummy, lpAmount]),
      ]);

      // stake
      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getStakingDualRewardsContract: StakingDualRewards contract not found'
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'stake', [
          this.lpToken.address,
          lpAmount,
        ]),
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
      const expectRewardA = await this.stakingRewardsContract.earnedA.call(
        this.userProxy.address
      );

      const expectRewardB = await this.stakingRewardsContract.earnedB.call(
        this.userProxy.address
      );

      const rewardTokenA = await IToken.at(
        this.stakingRewardsInfo.rewardsTokenA
      );
      const rewardTokenB = await IToken.at(
        this.stakingRewardsInfo.rewardsTokenB
      );

      const rewardAmountABefore = await rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountBBefore = await rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'getReward', [lpTokenAddress]),
      ]);

      // getReward
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      const userRewards = getActionReturn(receipt, ['uint256', 'uint256']);
      const userRewardA = userRewards[0];
      const userRewardB = userRewards[1];

      const rewardAmountAAfter = await rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountBAfter = await rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      // reward should >= expectRewards
      expect(userRewardA).to.be.bignumber.gte(expectRewardA);
      expect(userRewardB).to.be.bignumber.gte(expectRewardB);

      expect(rewardAmountAAfter).to.be.bignumber.gt(rewardAmountABefore);
      expect(rewardAmountAAfter.sub(rewardAmountABefore)).to.be.bignumber.eq(
        userRewardA
      );
      expect(rewardAmountBAfter).to.be.bignumber.gt(rewardAmountBBefore);
      expect(rewardAmountBAfter.sub(rewardAmountBBefore)).to.be.bignumber.eq(
        userRewardB
      );
    });

    it('get reward and charge', async function() {
      // total reward
      const totalRewardA = await this.stakingRewardsContract.earnedA.call(
        this.userProxy.address
      );

      const totalRewardB = await this.stakingRewardsContract.earnedB.call(
        this.userProxy.address
      );

      const expectCollectorRewardA = totalRewardA
        .mul(await this.aQuickswapDualMining.harvestFee.call())
        .div(await this.aQuickswapDualMining.FEE_BASE.call());

      const expectCollectorRewardB = totalRewardB
        .mul(await this.aQuickswapDualMining.harvestFee.call())
        .div(await this.aQuickswapDualMining.FEE_BASE.call());

      const expectUserRewardA = totalRewardA.sub(expectCollectorRewardA);
      const expectUserRewardB = totalRewardB.sub(expectCollectorRewardB);

      const rewardTokenA = await IToken.at(
        this.stakingRewardsInfo.rewardsTokenA
      );
      const rewardTokenB = await IToken.at(
        this.stakingRewardsInfo.rewardsTokenB
      );

      const rewardAmountABefore = await rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountBBefore = await rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      const collectorRewardAAmountBefore = await rewardTokenA.balanceOf.call(
        collector
      );

      const collectorRewardBAmountBefore = await rewardTokenB.balanceOf.call(
        collector
      );

      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'getRewardAndCharge', [
          lpTokenAddress,
        ]),
      ]);

      // getRewardAndCharge
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      const userRewards = getActionReturn(receipt, ['uint256', 'uint256']);
      const userRewardA = userRewards[0];
      const userRewardB = userRewards[1];

      const rewardAmountAAfter = await rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountBAfter = await rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      const collectorRewardAAmountAfter = await rewardTokenA.balanceOf.call(
        collector
      );

      const collectorRewardBAmountAfter = await rewardTokenB.balanceOf.call(
        collector
      );

      const collectorRewardA = collectorRewardAAmountAfter.sub(
        collectorRewardAAmountBefore
      );
      const collectorRewardB = collectorRewardBAmountAfter.sub(
        collectorRewardBAmountBefore
      );

      // event
      const eventSig =
        '0x10a5a7dcbe58723f464418da817090d9d97ecaef17b13547a8fd461986e9a8e8'; //Charged(address,address[2],uint256[2])

      const eventArgs = getEventArgs(receipt, eventSig, [
        'address',
        'address',
        'address',
        'uint256',
        'uint256',
      ]);

      const eStakingContract = eventArgs[0];
      const eRewardTokenA = eventArgs[1];
      const eRewardTokenB = eventArgs[2];
      const eCollectorRewardA = new BN(eventArgs[3]);
      const eCollectorRewardB = new BN(eventArgs[4]);

      expect(eStakingContract).to.be.eq(this.stakingRewardsContract.address);
      expect(eRewardTokenA).to.be.eq(rewardTokenA.address);
      expect(eRewardTokenB).to.be.eq(rewardTokenB.address);
      expect(eCollectorRewardA).to.be.bignumber.eq(collectorRewardA);
      expect(eCollectorRewardB).to.be.bignumber.eq(collectorRewardB);

      // user reward should greater or equal expectUserReward
      expect(userRewardA).to.be.bignumber.gte(expectUserRewardA);
      expect(userRewardB).to.be.bignumber.gte(expectUserRewardB);

      expect(rewardAmountAAfter).to.be.bignumber.gt(rewardAmountABefore);
      expect(rewardAmountBAfter).to.be.bignumber.gt(rewardAmountBBefore);

      expect(rewardAmountAAfter.sub(rewardAmountABefore)).to.be.bignumber.eq(
        userRewardA
      );
      expect(rewardAmountBAfter.sub(rewardAmountBBefore)).to.be.bignumber.eq(
        userRewardB
      );

      // collector reward should equal expectCollectorReward
      expect(collectorRewardA).to.be.bignumber.eq(expectCollectorRewardA);
      expect(collectorRewardB).to.be.bignumber.eq(expectCollectorRewardB);
    });
  });

  describe('leave', async function() {
    it('leave', async function() {
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'leave', [dQuickAmount]),
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'leave', [0]),
      ]);

      // should fail
      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'leave: zero amount'
      );
    });

    it('should revert: insufficient dQuick', async function() {
      // transfer dQuick to user proxy
      const dQuickAmount = ether('1');
      await this.dQuick.transfer(
        this.userProxy.address,
        dQuickAmount.div(new BN('2')),
        {
          from: QUICKSWAP_DQUICK_PROVIDER,
        }
      );

      // leave
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'leave', [dQuickAmount]),
      ]);

      // should fail
      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'leave: ERC20: burn amount exceeds balance'
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
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'stake', [
          this.lpToken.address,
          lpAmount,
        ]),
      ]);

      const rewardTokenA = await IToken.at(
        this.stakingRewardsInfo.rewardsTokenA
      );

      const rewardTokenB = await IToken.at(
        this.stakingRewardsInfo.rewardsTokenB
      );

      const rewardAmountABefore = await rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountBBefore = await rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      // increase time 14 days in order to get reward
      await time.increase(time.duration.days(14));

      // expect reward
      const userExpectRewardA = await this.stakingRewardsContract.earnedA.call(
        this.userProxy.address
      );

      const userExpectRewardB = await this.stakingRewardsContract.earnedB.call(
        this.userProxy.address
      );

      // exit
      data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'exit', [this.lpToken.address]),
      ]);

      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      const actionReturns = getActionReturn(receipt, [
        'uint256',
        'uint256',
        'uint256',
      ]);

      const returnedUserLPAmount = actionReturns[0];
      const returnedUserRewardA = actionReturns[1];
      const returnedUserRewardB = actionReturns[2];

      const userLPAmountAfter = await this.lpToken.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountAAfter = await rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      const rewardAmountBAfter = await rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      expect(returnedUserLPAmount).to.be.bignumber.eq(lpAmount);

      expect(returnedUserRewardA).to.be.bignumber.gte(userExpectRewardA);
      expect(returnedUserRewardB).to.be.bignumber.gte(userExpectRewardB);

      expect(userLPAmountAfter.sub(userLPAmountBefore)).to.be.bignumber.eq(
        returnedUserLPAmount
      );

      expect(rewardAmountAAfter.sub(rewardAmountABefore)).to.be.bignumber.eq(
        returnedUserRewardA
      );
      expect(rewardAmountBAfter.sub(rewardAmountBBefore)).to.be.bignumber.eq(
        returnedUserRewardB
      );
    });

    it('should revert: zero lp token staking', async function() {
      // exit
      data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'exit', [this.lpToken.address]),
      ]);

      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'exit: Cannot withdraw 0'
      );
    });

    it('should revert: wrong LP token', async function() {
      // exit
      data = getCallData(TaskExecutor, 'execMock', [
        this.aQuickswapDualMining.address,
        getCallData(AQuickswapDualMining, 'exit', [dummy]),
      ]);

      expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getStakingDualRewardsContract: StakingDualRewards contract not found'
      );
    });
  });
});
