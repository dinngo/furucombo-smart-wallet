const {
  balance,
  ether,
  expectRevert,
  send,
} = require('@openzeppelin/test-helpers');
const abi = require('ethereumjs-abi');
const { expect } = require('chai');
const {
  FURUCOMBO_REGISTRY,
  FURUCOMBO_REGISTRY_OWNER,
  FURUCOMBO_PROXY,
  FURUCOMBO_HFUNDS,
  FURUCOMBO_HQUICKSWAP,
  NATIVE_TOKEN,
  WMATIC_TOKEN,
  DAI_TOKEN,
  WETH_TOKEN,
  WETH_PROVIDER,
  DS_PROXY_REGISTRY,
} = require('./utils/constants');
const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getActionReturn,
  getCallData,
} = require('./utils/utils');
const { BN } = require('@openzeppelin/test-helpers/src/setup');

const TaskExecutor = artifacts.require('TaskExecutorMock');
const AFurucombo = artifacts.require('AFurucombo');
const IToken = artifacts.require('IERC20');
const IRegistry = artifacts.require('IRegistry');
const HFunds = artifacts.require('HFunds');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');

contract('AFurucombo', function([_, owner, user]) {
  const tokenAddress = WETH_TOKEN;
  const tokenProvider = WETH_PROVIDER;
  const tokenOutAddress = DAI_TOKEN;

  before(async function() {
    // Create actions
    this.executor = await TaskExecutor.new(owner);
    this.aFurucombo = await AFurucombo.new(owner, FURUCOMBO_PROXY);

    this.token = await IToken.at(tokenAddress);
    this.tokenOut = await IToken.at(tokenOutAddress);

    // Registry new hFunds
    this.hFunds = await HFunds.new();
    this.registry = await IRegistry.at(FURUCOMBO_REGISTRY);
    await send.ether(user, FURUCOMBO_REGISTRY_OWNER, ether('1'));
    await this.registry.register(
      this.hFunds.address,
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      {
        from: FURUCOMBO_REGISTRY_OWNER,
      }
    );
    expect(
      await this.registry.isValidHandler.call(this.hFunds.address)
    ).to.be.true;

    // Create user dsproxy
    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.furucomboTokenDust = new BN(10);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('inject and batchExec', function() {
    it('swap native and token to token', async function() {
      const tokensIn = [NATIVE_TOKEN, this.token.address];
      const amountsIn = [ether('2'), ether('1')];
      const tokensOut = [this.tokenOut.address];
      const tos = [
        this.hFunds.address,
        FURUCOMBO_HQUICKSWAP,
        FURUCOMBO_HQUICKSWAP,
      ];
      const configs = [
        '0x0004000000000000000000000000000000000000000000000000000000000000', // return size = 4 (uint256[2])
        '0x0100000000000000000102ffffffffffffffffffffffffffffffffffffffffff', // ref location = stack[2]
        '0x0100000000000000000103ffffffffffffffffffffffffffffffffffffffffff', // ref location = stack[3]
      ];
      const datas = [
        abi.simpleEncode('updateTokens(address[])', tokensIn),
        abi.simpleEncode(
          'swapExactETHForTokens(uint256,uint256,address[])',
          0, // amountIn: 100% return data
          1, // amountOutMin
          [WMATIC_TOKEN, this.tokenOut.address] // path
        ),
        abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[])',
          0, // amountIn: 100% return data
          1, // amountOutMin
          [this.token.address, this.tokenOut.address] // path
        ),
      ];

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aFurucombo.address,
        getCallData(AFurucombo, 'injectAndBatchExec', [
          tokensIn,
          amountsIn,
          tokensOut,
          tos,
          configs,
          datas,
        ]),
      ]);

      await this.token.transfer(this.userProxy.address, amountsIn[1], {
        from: tokenProvider,
      });

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        { from: user, value: amountsIn[0] }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const tokenAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenOutAfter = await this.tokenOut.balanceOf.call(
        this.userProxy.address
      );
      const tokenFurucomboAfter = await this.token.balanceOf.call(
        FURUCOMBO_PROXY
      );

      // Verify action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(tokenOutAfter);

      // Verify user dsproxy
      expect(balanceAfter).to.be.bignumber.zero;
      expect(tokenAfter).to.be.bignumber.zero;
      expect(tokenOutAfter).to.be.bignumber.gt(ether('0'));

      // Verify furucombo proxy
      expect(tokenFurucomboAfter).to.be.bignumber.lt(this.furucomboTokenDust);

      profileGas(receipt);
    });

    it('swap token to native and token', async function() {
      const tokensIn = [this.token.address];
      const amountsIn = [ether('1')];
      const tokensOut = [NATIVE_TOKEN, this.tokenOut.address];
      const tos = [
        this.hFunds.address,
        FURUCOMBO_HQUICKSWAP,
        FURUCOMBO_HQUICKSWAP,
      ];
      const configs = [
        '0x0003000000000000000000000000000000000000000000000000000000000000', // return size = 3 (uint256[1])
        '0x0100000000000000000102ffffffffffffffffffffffffffffffffffffffffff', // ref location = stack[2]
        '0x0100000000000000000102ffffffffffffffffffffffffffffffffffffffffff', // ref location = stack[2]
      ];
      const datas = [
        abi.simpleEncode('updateTokens(address[])', tokensIn),
        abi.simpleEncode(
          'swapExactTokensForETH(uint256,uint256,address[])',
          ether('0.5'), // amountIn: 50% return data
          1, // amountOutMin
          [this.token.address, WMATIC_TOKEN] // path
        ),
        abi.simpleEncode(
          'swapExactTokensForTokens(uint256,uint256,address[])',
          ether('0.5'), // amountIn: 50% return data
          1, // amountOutMin
          [this.token.address, this.tokenOut.address] // path
        ),
      ];

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aFurucombo.address,
        getCallData(AFurucombo, 'injectAndBatchExec', [
          tokensIn,
          amountsIn,
          tokensOut,
          tos,
          configs,
          datas,
        ]),
      ]);

      await this.token.transfer(this.userProxy.address, amountsIn[0], {
        from: tokenProvider,
      });

      // Execute
      const receipt = await this.userProxy.execute(
        this.executor.address,
        data,
        {
          from: user,
        }
      );

      // Record after balance
      const balanceAfter = await balance.current(this.userProxy.address);
      const tokenAfter = await this.token.balanceOf.call(
        this.userProxy.address
      );
      const tokenOutAfter = await this.tokenOut.balanceOf.call(
        this.userProxy.address
      );
      const tokenFurucomboAfter = await this.token.balanceOf.call(
        FURUCOMBO_PROXY
      );

      // Check action return
      const actionReturn = getActionReturn(receipt, ['uint256[]'])[0];
      expect(actionReturn[0]).to.be.bignumber.eq(balanceAfter);
      expect(actionReturn[1]).to.be.bignumber.eq(tokenOutAfter);

      // Check user dsproxy
      expect(balanceAfter).to.be.bignumber.gt(ether('0'));
      expect(tokenAfter).to.be.bignumber.zero;
      expect(tokenOutAfter).to.be.bignumber.gt(ether('0'));

      // Verify furucombo proxy
      expect(tokenFurucomboAfter).to.be.bignumber.lt(this.furucomboTokenDust);

      profileGas(receipt);
    });

    it('remaining tokens < token dust', async function() {
      const amountIn = this.furucomboTokenDust.sub(new BN(1));
      const tokensIn = [this.token.address];
      const amountsIn = [amountIn];
      const tokensOut = [];
      const tos = [];
      const configs = [];
      const datas = [];

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aFurucombo.address,
        getCallData(AFurucombo, 'injectAndBatchExec', [
          tokensIn,
          amountsIn,
          tokensOut,
          tos,
          configs,
          datas,
        ]),
      ]);

      await this.token.transfer(this.userProxy.address, amountsIn[0], {
        from: tokenProvider,
      });

      await this.userProxy.execute(this.executor.address, data, {
        from: user,
      });

      const tokenFurucomboAfter = await this.token.balanceOf.call(
        FURUCOMBO_PROXY
      );
      // Verify furucombo proxy
      expect(tokenFurucomboAfter).to.be.bignumber.eq(amountIn);
    });

    it('should revert: inconsistent length', async function() {
      const tokensIn = [this.token.address];
      const amountsIn = [ether('1'), ether('1')];
      const tokensOut = [];
      const tos = [];
      const configs = [];
      const datas = [];

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aFurucombo.address,
        getCallData(AFurucombo, 'injectAndBatchExec', [
          tokensIn,
          amountsIn,
          tokensOut,
          tos,
          configs,
          datas,
        ]),
      ]);

      await this.token.transfer(this.userProxy.address, amountsIn[0], {
        from: tokenProvider,
      });

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        '_inject: Input tokens and amounts length inconsistent'
      );
    });

    it('should revert: remaining tokens >= token dust', async function() {
      const tokensIn = [this.token.address];
      const amountsIn = [this.furucomboTokenDust];
      const tokensOut = [];
      const tos = [];
      const configs = [];
      const datas = [];

      // TaskExecutorMock data
      const data = getCallData(TaskExecutor, 'execMock', [
        this.aFurucombo.address,
        getCallData(AFurucombo, 'injectAndBatchExec', [
          tokensIn,
          amountsIn,
          tokensOut,
          tos,
          configs,
          datas,
        ]),
      ]);

      await this.token.transfer(this.userProxy.address, amountsIn[0], {
        from: tokenProvider,
      });

      await expectRevert(
        this.userProxy.execute(this.executor.address, data, {
          from: user,
        }),
        'injectAndBatchExec: Furucombo has remaining tokens'
      );
    });
  });

  describe('destroy', function() {
    it('normal', async function() {
      await this.aFurucombo.destroy({ from: owner });
      expect(await web3.eth.getCode(this.aFurucombo.address)).eq('0x');
    });
  });
});
