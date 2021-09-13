const {
  balance,
  BN,
  constants,
  ether,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { duration, increase, latest } = time;
const { ZERO_ADDRESS } = constants;
const abi = require('ethereumjs-abi');
const { expect } = require('chai');
const {
  DAI_TOKEN,
  DAI_PROVIDER,
  SUSHI_TOKEN,
  SUSHI_PROVIDER,
  WMATIC_PROVIDER,
  WMATIC_TOKEN,
  WETH_TOKEN,
  DS_PROXY_REGISTRY,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getCreated,
  getActionReturn,
  getCallData,
} = require('./utils/utils');

const TaskExecutor = artifacts.require('TaskExecutorMock');
const ATrevi = artifacts.require('ATrevi');
const IToken = artifacts.require('IERC20');
const Archangel = artifacts.require('Archangel');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');

async function addAngel(
  angelFactory,
  stakingToken,
  rewardToken,
  allocPoint,
  gracePerSecond,
  graceDuration
) {
  // Create angel
  angel = await getCreated(
    await angelFactory.create(rewardToken.address),
    Angel
  );
  expect(await angelFactory.isValid.call(angel.address)).to.be.true;

  // Approve reward token to angel
  const rewardAmount = graceDuration.mul(gracePerSecond);
  await rewardToken.approve(angel.address, rewardAmount);

  // Set grace per second
  const endTime = (await latest()).add(graceDuration);
  await angel.setGracePerSecond(gracePerSecond, endTime);

  // Add staking token to fountain
  const addAngelReceipt = await angel.add(
    allocPoint,
    stakingToken.address,
    ZERO_ADDRESS
  );
  angelPid = addAngelReceipt.logs[0].args.pid;
  expect(await angel.lpToken.call(angelPid)).to.be.eq(stakingToken.address);

  return [angel, angelPid];
}

contract('ATrevi', function([_, owner, collector, user, dummy]) {
  const stakingTokenAddress = DAI_TOKEN;
  const stakingTokenProvider = DAI_PROVIDER;
  const rewardTokenAAddress = WMATIC_TOKEN;
  const rewardTokenAProvider = WMATIC_PROVIDER;
  const rewardTokenBAddress = SUSHI_TOKEN;
  const rewardTokenBProvider = SUSHI_PROVIDER;
  const rewardTokenCAddress = WETH_TOKEN;
  const dummyAmount = ether('0.01');

  before(async function() {
    const defaultFlashloanFee = new BN(10);
    this.stakingToken = await IToken.at(stakingTokenAddress);
    this.rewardTokenA = await IToken.at(rewardTokenAAddress);
    this.rewardTokenB = await IToken.at(rewardTokenBAddress);
    this.rewardTokenC = await IToken.at(rewardTokenCAddress);
    this.archangel = await Archangel.new(defaultFlashloanFee);
    this.fountainFactory = await FountainFactory.at(
      await this.archangel.fountainFactory.call()
    );
    this.angelFactory = await AngelFactory.at(
      await this.archangel.angelFactory.call()
    );

    // Create fountain
    this.fountain = await getCreated(
      await this.fountainFactory.create(this.stakingToken.address),
      Fountain
    );
    expect(
      await this.fountainFactory.isValid.call(this.fountain.address)
    ).to.be.true;

    // Transfer reward token to deployer
    const rewardAAmount = await this.rewardTokenA.balanceOf.call(
      rewardTokenAProvider
    );
    await this.rewardTokenA.transfer(_, rewardAAmount, {
      from: rewardTokenAProvider,
    });
    const rewardBAmount = await this.rewardTokenB.balanceOf.call(
      rewardTokenBProvider
    );
    await this.rewardTokenB.transfer(_, rewardBAmount, {
      from: rewardTokenBProvider,
    });

    // Create and add Angel
    const allocPoint = 100;
    const gracePerSecond = ether('0.01');
    const graceDuration = duration.days(1);

    // Create rewardA angel
    [this.angelA, this.angelAPid] = await addAngel(
      this.angelFactory,
      this.stakingToken,
      this.rewardTokenA,
      allocPoint,
      gracePerSecond,
      graceDuration
    );

    // Create the second rewardA angel
    [this.angelA2, this.angelA2Pid] = await addAngel(
      this.angelFactory,
      this.stakingToken,
      this.rewardTokenA,
      allocPoint,
      gracePerSecond,
      graceDuration
    );

    // Create rewardB angel
    [this.angelB, this.angelBPid] = await addAngel(
      this.angelFactory,
      this.stakingToken,
      this.rewardTokenB,
      allocPoint,
      gracePerSecond,
      graceDuration
    );

    // Create unjoined angel
    this.angelC = await getCreated(
      await this.angelFactory.create(this.rewardTokenC.address),
      Angel
    );

    // Create actions
    this.fee = new BN('2000'); // 20% harvest fee
    this.executor = await TaskExecutor.new(owner);
    this.aTrevi = await ATrevi.new(
      owner,
      this.archangel.address,
      collector,
      this.fee
    );

    // Create user dsproxy
    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('collector', function() {
    it('has an collector', async function() {
      expect(await this.aTrevi.collector()).to.equal(collector);
    });
  });

  describe('deposit', function() {
    it('normal', async function() {
      const stakingAmount = ether('10');

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'deposit', [
          this.stakingToken.address,
          stakingAmount,
        ]),
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
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const tokenAfter = await this.stakingToken.balanceOf.call(
        this.userProxy.address
      );
      const fountainAfter = await this.fountain.balanceOf.call(
        this.userProxy.address
      );

      // Check action return
      const actionReturn = getActionReturn(receipt, ['uint256'])[0];
      expect(actionReturn).to.be.bignumber.eq(fountainAfter);

      // Check task executor
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(tokenAfter).to.be.zero;
      expect(fountainAfter).to.be.bignumber.eq(stakingAmount);

      profileGas(receipt);
    });

    it('should revert: insufficient staking token', async function() {
      const extra = ether('1');
      const stakingAmount = ether('10');

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'deposit', [
          this.stakingToken.address,
          stakingAmount.add(extra),
        ]),
      ]);

      // Send token to user dsproxy
      await this.stakingToken.transfer(this.userProxy.address, stakingAmount, {
        from: stakingTokenProvider,
      });

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'deposit: ERC20: transfer amount exceeds balance'
      );
    });

    it('should revert: fountain not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'deposit', [dummy, 0]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getFountain: fountain not found'
      );
    });
  });

  describe('withdraw', function() {
    const stakingAmount = ether('10');

    beforeEach(async function() {
      // Send ftn token to user dsproxy
      await this.stakingToken.approve(this.fountain.address, stakingAmount, {
        from: stakingTokenProvider,
      });
      await this.fountain.depositTo(stakingAmount, this.userProxy.address, {
        from: stakingTokenProvider,
      });
      expect(
        await this.fountain.balanceOf(this.userProxy.address)
      ).to.be.bignumber.eq(stakingAmount);
    });

    it('normal', async function() {
      const withdrawAmount = stakingAmount;

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'withdraw', [
          this.stakingToken.address,
          withdrawAmount,
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const tokenAfter = await this.stakingToken.balanceOf.call(
        this.userProxy.address
      );
      const fountainAfter = await this.fountain.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256'])[0];
      expect(actionReturn).to.be.bignumber.eq(tokenAfter);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(tokenAfter).to.be.bignumber.eq(withdrawAmount);
      expect(fountainAfter).to.be.zero;

      profileGas(receipt);
    });

    it('should revert: insufficient ftn token', async function() {
      const extra = ether('1');
      const withdrawAmount = stakingAmount.add(extra);

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'withdraw', [
          this.stakingToken.address,
          withdrawAmount,
        ]),
      ]);

      // Send extra token to fountain
      await this.stakingToken.transfer(this.fountain.address, extra, {
        from: stakingTokenProvider,
      });

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'withdraw: ERC20: burn amount exceeds balance'
      );
    });

    it('should revert: fountain not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'withdraw', [dummy, 0]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getFountain: fountain not found'
      );
    });
  });

  describe('harvest with fee charging', function() {
    const stakingAmount = ether('10');

    beforeEach(async function() {
      // Send ftn token to user dsproxy
      await this.stakingToken.approve(this.fountain.address, stakingAmount, {
        from: stakingTokenProvider,
      });
      await this.fountain.depositTo(stakingAmount, this.userProxy.address, {
        from: stakingTokenProvider,
      });
      expect(
        await this.fountain.balanceOf(this.userProxy.address)
      ).to.be.bignumber.eq(stakingAmount);

      // Join angel A
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelA.address),
        ]),
        {
          from: user,
        }
      );
    });

    it('normal', async function() {
      // Join angel B
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelB.address),
        ]),
        {
          from: user,
        }
      );

      await increase(duration.hours(1));

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [
          this.stakingToken.address,
          [this.angelA.address, this.angelB.address],
          [this.rewardTokenA.address, this.rewardTokenB.address],
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const rewardAAfter = await this.rewardTokenA.balanceOf.call(
        this.userProxy.address
      );
      const rewardBAfter = await this.rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(rewardAAfter);
      expect(actionReturn[1]).to.be.bignumber.eq(rewardBAfter);
      expect(actionReturn.length).to.equal(2);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(rewardAAfter).to.be.bignumber.gt(ether('0'));
      expect(rewardBAfter).to.be.bignumber.gt(ether('0'));

      // Verify fee
      const baseFee = new BN('10000');
      expect(
        await this.rewardTokenA.balanceOf.call(collector)
      ).to.be.bignumber.eq(
        rewardAAfter.mul(this.fee).div(baseFee.sub(this.fee))
      );
      expect(
        await this.rewardTokenB.balanceOf.call(collector)
      ).to.be.bignumber.eq(
        rewardBAfter.mul(this.fee).div(baseFee.sub(this.fee))
      );

      profileGas(receipt);
    });

    it('partial output tokens', async function() {
      // Join angel B
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelB.address),
        ]),
        {
          from: user,
        }
      );

      await increase(duration.hours(1));

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [
          this.stakingToken.address,
          [this.angelA.address, this.angelB.address],
          [this.rewardTokenA.address], // partial output tokens
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const rewardAAfter = await this.rewardTokenA.balanceOf.call(
        this.userProxy.address
      );
      const rewardBAfter = await this.rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(rewardAAfter);
      expect(actionReturn.length).to.equal(1);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(rewardAAfter).to.be.bignumber.gt(ether('0'));
      expect(rewardBAfter).to.be.bignumber.gt(ether('0'));

      // Verify fee
      const baseFee = new BN('10000');
      expect(
        await this.rewardTokenA.balanceOf.call(collector)
      ).to.be.bignumber.eq(
        rewardAAfter.mul(this.fee).div(baseFee.sub(this.fee))
      );
      expect(
        await this.rewardTokenB.balanceOf.call(collector)
      ).to.be.bignumber.eq(
        rewardBAfter.mul(this.fee).div(baseFee.sub(this.fee))
      );

      profileGas(receipt);
    });

    it('duplicate reward tokens', async function() {
      // Join angel A2
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelA2.address),
        ]),
        {
          from: user,
        }
      );

      await increase(duration.hours(1));

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [
          this.stakingToken.address,
          [this.angelA.address, this.angelA2.address],
          [this.rewardTokenA.address], // partial output tokens
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const rewardAAfter = await this.rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(rewardAAfter);
      expect(actionReturn.length).to.equal(1);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(rewardAAfter).to.be.bignumber.gt(ether('0'));

      // Verify fee
      const baseFee = new BN('10000');
      expect(
        await this.rewardTokenA.balanceOf.call(collector)
      ).to.be.bignumber.eq(
        rewardAAfter.mul(this.fee).div(baseFee.sub(this.fee))
      );

      profileGas(receipt);
    });

    it('should revert: fountain not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [dummy, [], []]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getFountain: fountain not found'
      );
    });

    it('should revert: fountain not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [dummy, [], []]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getFountain: fountain not found'
      );
    });

    it('should revert: unexpected length', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [
          this.stakingToken.address,
          [],
          [dummy],
        ]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_harvest: unexpected length'
      );
    });

    it('should revert: angel not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngelsAndCharge', [
          this.stakingToken.address,
          [this.angelC.address],
          [],
        ]),
      ]);
      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_fountainHarvest: _harvestAngel: not added by angel'
      );
    });
  });

  describe('harvest without fee charging', function() {
    const stakingAmount = ether('10');

    beforeEach(async function() {
      // Send ftn token to user dsproxy
      await this.stakingToken.approve(this.fountain.address, stakingAmount, {
        from: stakingTokenProvider,
      });
      await this.fountain.depositTo(stakingAmount, this.userProxy.address, {
        from: stakingTokenProvider,
      });
      expect(
        await this.fountain.balanceOf(this.userProxy.address)
      ).to.be.bignumber.eq(stakingAmount);

      // Join angel A
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelA.address),
        ]),
        {
          from: user,
        }
      );
    });

    it('normal', async function() {
      // Join angel B
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelB.address),
        ]),
        {
          from: user,
        }
      );

      await increase(duration.hours(1));

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [
          this.stakingToken.address,
          [this.angelA.address, this.angelB.address],
          [this.rewardTokenA.address, this.rewardTokenB.address],
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const rewardAAfter = await this.rewardTokenA.balanceOf.call(
        this.userProxy.address
      );
      const rewardBAfter = await this.rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(rewardAAfter);
      expect(actionReturn[1]).to.be.bignumber.eq(rewardBAfter);
      expect(actionReturn.length).to.equal(2);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(rewardAAfter).to.be.bignumber.gt(ether('0'));
      expect(rewardBAfter).to.be.bignumber.gt(ether('0'));

      // Verify fee
      expect(await this.rewardTokenA.balanceOf.call(collector)).to.be.zero;
      expect(await this.rewardTokenB.balanceOf.call(collector)).to.be.zero;

      profileGas(receipt);
    });

    it('partial output tokens', async function() {
      // Join angel B
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelB.address),
        ]),
        {
          from: user,
        }
      );

      await increase(duration.hours(1));

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [
          this.stakingToken.address,
          [this.angelA.address, this.angelB.address],
          [this.rewardTokenA.address], // partial output tokens
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const rewardAAfter = await this.rewardTokenA.balanceOf.call(
        this.userProxy.address
      );
      const rewardBAfter = await this.rewardTokenB.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(rewardAAfter);
      expect(actionReturn.length).to.equal(1);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(rewardAAfter).to.be.bignumber.gt(ether('0'));
      expect(rewardBAfter).to.be.bignumber.gt(ether('0'));

      // Verify fee
      expect(await this.rewardTokenA.balanceOf.call(collector)).to.be.zero;
      expect(await this.rewardTokenB.balanceOf.call(collector)).to.be.zero;

      profileGas(receipt);
    });

    it('duplicate reward tokens', async function() {
      // Join angel A2
      await this.userProxy.execute(
        this.executor.address,
        getCallData(TaskExecutor, 'callMock', [
          this.fountain.address,
          abi.simpleEncode('joinAngel(address)', this.angelA2.address),
        ]),
        {
          from: user,
        }
      );

      await increase(duration.hours(1));

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [
          this.stakingToken.address,
          [this.angelA.address, this.angelA2.address],
          [this.rewardTokenA.address], // partial output tokens
        ]),
      ]);

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
          value: dummyAmount,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const rewardAAfter = await this.rewardTokenA.balanceOf.call(
        this.userProxy.address
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(rewardAAfter);
      expect(actionReturn.length).to.equal(1);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.eq(dummyAmount);
      expect(rewardAAfter).to.be.bignumber.gt(ether('0'));

      // Verify fee
      expect(await this.rewardTokenA.balanceOf.call(collector)).to.be.zero;

      profileGas(receipt);
    });

    it('should revert: fountain not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [dummy, [], []]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getFountain: fountain not found'
      );
    });

    it('should revert: fountain not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [dummy, [], []]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_getFountain: fountain not found'
      );
    });

    it('should revert: unexpected length', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [
          this.stakingToken.address,
          [],
          [dummy],
        ]),
      ]);

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_harvest: unexpected length'
      );
    });

    it('should revert: angel not found', async function() {
      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aTrevi.address,
        getCallData(ATrevi, 'harvestAngels', [
          this.stakingToken.address,
          [this.angelC.address],
          [],
        ]),
      ]);
      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_fountainHarvest: _harvestAngel: not added by angel'
      );
    });
  });

  describe('destroy', function() {
    it('normal', async function() {
      await this.aTrevi.destroy({ from: owner });
      expect(await web3.eth.getCode(this.aTrevi.address)).eq('0x');
    });
  });
});
