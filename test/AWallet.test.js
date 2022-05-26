const {
  balance,
  BN,
  ether,
  expectRevert,
  send,
} = require('@openzeppelin/test-helpers');

const { MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const { tracker } = balance;
const { expect } = require('chai');

const {
  DS_PROXY_REGISTRY,
  NATIVE_TOKEN,
  DAI_TOKEN,
  WETH_TOKEN,
} = require('./utils/constants');

const {
  evmRevert,
  evmSnapshot,
  getCallData,
  tokenProviderQuick,
} = require('./utils/utils');

const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const IToken = artifacts.require('IERC20');
const AWallet = artifacts.require('AWallet');

contract('AWallet', function([_, owner, user]) {
  let id;
  let initialEvmId;

  let tokenAProviderAddress;
  let tokenBProviderAddress;

  const tokenAAddress = DAI_TOKEN;
  const tokenBAddress = WETH_TOKEN;

  before(async function() {
    initialEvmId = await evmSnapshot();

    // Get token provider
    tokenProvider = await tokenProviderQuick(tokenAAddress, tokenBAddress);

    console.log(tokenProvider);

    this.tokenAProviderAddress = tokenProvider;
    this.tokenBProviderAddress = tokenProvider;

    this.tokenA = await IToken.at(tokenAAddress);
    this.tokenB = await IToken.at(tokenBAddress);
    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.aWallet = await AWallet.new(owner);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
    balanceUser = await tracker(user);
    balanceProxy = await tracker(this.userProxy.address);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  after(async function() {
    await evmRevert(initialEvmId);
  });

  describe('withdraw token', function() {
    const depositNativeAmount = ether('5');
    const depositTokenAAmount = ether('10');
    const depositTokenBAmount = ether('10');
    beforeEach(async function() {
      await send.ether(user, this.userProxy.address, depositNativeAmount);
      await this.tokenA.transfer(this.userProxy.address, depositTokenAAmount, {
        from: this.tokenAProviderAddress,
      });

      await this.tokenB.transfer(this.userProxy.address, depositTokenBAmount, {
        from: this.tokenBProviderAddress,
      });
      balanceUser.get();
      balanceProxy.get();
    });

    it('withdraw single token', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const withdrawAmount = depositTokenAAmount.div(new BN(2));
      const data = getCallData(AWallet, 'withdrawTokens', [
        [this.tokenA.address],
        [withdrawAmount],
      ]);

      // Execute
      await this.userProxy.execute(this.aWallet.address, data, {
        from: user,
        value: dummyAmount,
      });

      // Verify Proxy
      expect(
        await this.tokenA.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenAAmount.sub(withdrawAmount));
      expect(
        await this.tokenB.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenBAmount);
      expect(await balanceProxy.get()).to.be.bignumber.eq(
        depositNativeAmount.add(dummyAmount)
      );

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        withdrawAmount
      );

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(dummyAmount)
      );
    });

    it('withdraw single token with max amount', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const data = getCallData(AWallet, 'withdrawTokens', [
        [this.tokenA.address],
        [MAX_UINT256],
      ]);

      // Execute
      await this.userProxy.execute(this.aWallet.address, data, {
        from: user,
        value: dummyAmount,
      });

      // Verify Proxy
      expect(
        await this.tokenA.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.zero;
      expect(
        await this.tokenB.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenBAmount);
      expect(await balanceProxy.get()).to.be.bignumber.eq(
        depositNativeAmount.add(dummyAmount)
      );

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        depositTokenAAmount
      );

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        ether('0').sub(dummyAmount)
      );
    });

    it('withdraw single native token', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const withdrawAmount = ether('2');
      const data = getCallData(AWallet, 'withdrawTokens', [
        [NATIVE_TOKEN],
        [withdrawAmount],
      ]);

      // Execute
      await this.userProxy.execute(this.aWallet.address, data, {
        from: user,
        value: dummyAmount,
      });

      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.eq(
        depositNativeAmount.sub(withdrawAmount).add(dummyAmount)
      );
      expect(
        await this.tokenA.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenAAmount);
      expect(
        await this.tokenB.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenBAmount);

      // Verify user balance
      expect(await balanceUser.delta()).to.be.bignumber.eq(
        withdrawAmount.sub(dummyAmount)
      );
    });

    it('withdraw single native token with max amount', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const data = getCallData(AWallet, 'withdrawTokens', [
        [NATIVE_TOKEN],
        [MAX_UINT256],
      ]);

      // Execute
      await this.userProxy.execute(this.aWallet.address, data, {
        from: user,
        value: dummyAmount,
      });

      // Verify proxy balance
      expect(await balanceProxy.get()).to.be.bignumber.zero;
      expect(
        await this.tokenA.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenAAmount);
      expect(
        await this.tokenB.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenBAmount);

      // Verify user balance
      // return all balance of DSProxy includes dummyAmount
      expect(await balanceUser.delta()).to.be.bignumber.eq(depositNativeAmount);
    });

    it('withdraw multiple tokens', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const withdrawNativeAmount = ether('3');
      const withdrawTokenAAmount = depositTokenAAmount.div(new BN(2));
      const withdrawTokenBAmount = MAX_UINT256;

      const data = getCallData(AWallet, 'withdrawTokens', [
        [this.tokenA.address, NATIVE_TOKEN, this.tokenB.address],
        [withdrawTokenAAmount, withdrawNativeAmount, withdrawTokenBAmount],
      ]);

      // Execute
      await this.userProxy.execute(this.aWallet.address, data, {
        from: user,
        value: dummyAmount,
      });

      // Verify Proxy
      expect(await balanceProxy.get()).to.be.bignumber.eq(
        depositNativeAmount.sub(withdrawNativeAmount).add(dummyAmount)
      );
      expect(
        await this.tokenA.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.eq(depositTokenAAmount.sub(withdrawTokenAAmount));
      expect(
        await this.tokenB.balanceOf.call(this.userProxy.address)
      ).to.be.bignumber.zero;

      // Verify user balance
      expect(await this.tokenA.balanceOf.call(user)).to.be.bignumber.eq(
        withdrawTokenAAmount
      );
      expect(await this.tokenB.balanceOf.call(user)).to.be.bignumber.eq(
        depositTokenBAmount
      );

      expect(await balanceUser.delta()).to.be.bignumber.eq(
        withdrawNativeAmount.sub(dummyAmount)
      );
    });

    it('should revert: tokens and amounts length inconsistent', async function() {
      const data = getCallData(AWallet, 'withdrawTokens', [
        [this.tokenA.address, NATIVE_TOKEN, this.tokenB.address],
        [],
      ]);

      await expectRevert(
        this.userProxy.execute(this.aWallet.address, data, {
          from: user,
          value: ether('0.01'),
        }),
        'withdraw: tokens and amounts length inconsistent'
      );
    });

    it('should revert: token insufficient balance', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const withdrawAmount = depositTokenAAmount.mul(new BN(2));
      const data = getCallData(AWallet, 'withdrawTokens', [
        [this.tokenA.address],
        [withdrawAmount],
      ]);

      await expectRevert(
        this.userProxy.execute(this.aWallet.address, data, {
          from: user,
          value: dummyAmount,
        }),
        'ERC20: transfer amount exceeds balance'
      );
    });

    it('should revert: native token insufficient balance', async function() {
      // Prepare action data
      const dummyAmount = ether('0.01');
      const withdrawAmount = depositNativeAmount.mul(new BN(2));
      const data = getCallData(AWallet, 'withdrawTokens', [
        [NATIVE_TOKEN],
        [withdrawAmount],
      ]);

      await expectRevert.unspecified(
        this.userProxy.execute(this.aWallet.address, data, {
          from: user,
          value: dummyAmount,
        })
      );
    });
  });
});
