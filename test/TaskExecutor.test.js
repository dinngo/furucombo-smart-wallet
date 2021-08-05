const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  send,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32, MAX_UINT256, ZERO_ADDRESS } = constants;
// const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getCallData,
} = require('./utils/utils');
const { DS_PROXY_REGISTRY } = require('./utils/constants');

const Foo = artifacts.require('Foo');
const FooAction = artifacts.require('FooAction');
const IDSProxy = artifacts.require('IDSProxy');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const TaskExecutor = artifacts.require('TaskExecutor');

contract('TaskExecutor', function([_, user, someone]) {
  let id;
  let balanceUser;
  let balanceProxy;

  before(async function() {
    this.dsProxyRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    this.taskExecutor = await TaskExecutor.new();
    this.foo = await Foo.new();
    this.fooAction = await FooAction.new();

    // Build user DSProxy
    await this.dsProxyRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsProxyRegistry.proxies.call(user)
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  // Call
  // TODO: Single action
  // TODO: multiple action
  // TODO: revert no action

  // ChainedInput
  // TODO: dynamic array replace

  describe('execute by delegate call', function() {
    before(async function() {
      await send.ether(user, this.userProxy.address, ether('10'));
    });

    it('single action', async function() {
      // Prepare action data
      const expectNValue = new BN(101);
      const action1Data = getCallData(FooAction, 'barUint1', [
        this.foo.address,
        expectNValue,
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address],
        ['0x0000000000000000000000000000000000000000000000000000000000000000'],
        [action1Data],
      ]);
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
    });

    it('multiple actions', async function() {
      // Prepare action data
      const expectNValue = new BN(101);
      const action1Data = getCallData(FooAction, 'barUint1', [
        this.foo.address,
        expectNValue,
      ]);

      const expectBValue =
        '0x00000000000000000000000000000000000000000000000000000000000000ff';
      const action2Data = getCallData(FooAction, 'bar1', [
        this.foo.address,
        expectBValue,
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
        [action1Data, action2Data],
      ]);
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
      expect(await this.foo.bValue.call()).to.be.eq(expectBValue);
    });

    it('payable action', async function() {
      var balanceFoo = await tracker(this.foo.address);

      // Prepare action data
      const value = ether('1');
      const expectNValue = new BN(101);
      const action1Data = getCallData(FooAction, 'barUint2', [
        this.foo.address,
        expectNValue,
        value,
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address],
        ['0x0000000000000000000000000000000000000000000000000000000000000000'],
        [action1Data],
      ]);
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
      expect(await balanceFoo.delta()).to.be.bignumber.eq(value);
    });

    it('should revert: no action code', async function() {
      // Prepare action data
      const value = ether('1');
      const expectNValue = new BN(101);
      const action1Data = getCallData(FooAction, 'barUint2', [
        this.foo.address,
        expectNValue,
        value,
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [ZERO_ADDRESS],
        ['0x0000000000000000000000000000000000000000000000000000000000000000'],
        [action1Data],
      ]);

      const target = this.taskExecutor.address;
      await expectRevert.unspecified(
        this.userProxy.execute(target, data, {
          from: user,
        })
      );
    });
  });

  describe('dynamic parameter', function() {
    before(async function() {
      await send.ether(user, this.userProxy.address, ether('10'));
    });

    it('replace parameter', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'bar', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'bar1', [
        this.foo.address,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          '0x0001000000000000000000000000000000000000000000000000000000000000',
          '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      // Verify
      expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
    });

    it('replace parameter with dynamic array return', async function() {
      // Prepare action data
      const secAmt = ether('1');
      const ratio = ether('0.7');
      const action1Data = getCallData(FooAction, 'barUList', [
        this.foo.address,
        ether('1'),
        secAmt,
        ether('1'),
      ]);
      const action2Data = getCallData(FooAction, 'barUint1', [
        this.foo.address,
        ratio,
      ]);

      // Prepare task data
      // local stack idx start from [+2] if using dynamic array
      // because it will store 2 extra data(pointer and array length) to local stack in the first and second index
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
          '0x0100000000000000000203ffffffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(
        secAmt.mul(ratio).div(ether('1'))
      );
    });

    it('replace third parameter', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'bar', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'bar2', [
        this.foo.address,
        '0x000000000000000000000000000000000000000000000000000000000000000a',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          '0x0001000000000000000000000000000000000000000000000000000000000000',
          '0x0100000000000000000400ffffffffffffffffffffffffffffffffffffffffff',
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      // Verify
      expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
    });

    it('replace parameter by 50% of ref value', async function() {
      // Prepare action data
      const percent = ether('0.5');
      const action1Data = getCallData(FooAction, 'barUint', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'barUint1', [
        this.foo.address,
        percent,
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          '0x0001000000000000000000000000000000000000000000000000000000000000',
          '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      // Verify
      expect(await this.foo.nValue.call()).to.be.bignumber.eq(
        (await this.foo.barUint.call()).mul(percent).div(ether('1'))
      );
    });

    it('replace dynamic array parameter with dynamic array return', async function() {
      // Prepare action data
      const expectNList = [new BN(300), new BN(100), new BN(75)];
      const action1Data = getCallData(FooAction, 'barUList', [
        this.foo.address,
        expectNList[0],
        expectNList[1],
        expectNList[2],
      ]);
      const action2Data = getCallData(FooAction, 'barUList2', [
        this.foo.address,
        [new BN(0), new BN(0), new BN(0)],
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
          '0x01000000000000000038040302ffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await this.userProxy.execute(target, data, {
        from: user,
      });

      // Verify
      for (var i = 0; i < expectNList.length; i++) {
        expect(await this.foo.nList.call(i)).to.be.bignumber.eq(expectNList[i]);
      }
    });

    it('should revert: location count less than ref count', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'bar', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'bar1', [
        this.foo.address,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          // 1 32-bytes return value to be referenced
          '0x0001000000000000000000000000000000000000000000000000000000000000',
          '0x010000000000000000020000ffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (1, 2)
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await expectRevert.unspecified(
        this.userProxy.execute(target, data, {
          from: user,
        })
      );
    });

    it('should revert: location count greater than ref count', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'bar', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'bar1', [
        this.foo.address,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          // 1 32-bytes return value to be referenced
          '0x0001000000000000000000000000000000000000000000000000000000000000',
          '0x0100000000000000000300ffffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (2, 1)
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await expectRevert.unspecified(
        this.userProxy.execute(target, data, {
          from: user,
        })
      );
    });

    it('should revert: ref to out of localStack', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'bar', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'bar1', [
        this.foo.address,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          // 1 32-bytes return value to be referenced
          '0x0001000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
          '0x0100000000000000000201ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await expectRevert.unspecified(
        this.userProxy.execute(target, data, {
          from: user,
        })
      );
    });

    it('should revert: expected return amount not match', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'bar', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'bar1', [
        this.foo.address,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          // expect 2 32-bytes return but will only get 1
          '0x0002000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
          '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await expectRevert.unspecified(
        this.userProxy.execute(target, data, {
          from: user,
        })
      );
    });

    it('should revert: overflow during trimming', async function() {
      // Prepare action data
      const action1Data = getCallData(FooAction, 'barUint', [this.foo.address]);
      const action2Data = getCallData(FooAction, 'barUint1', [
        this.foo.address,
        MAX_UINT256,
      ]);

      // Prepare task data
      const data = getCallData(TaskExecutor, 'batchExec', [
        [this.fooAction.address, this.fooAction.address],
        [
          // expect 2 32-bytes return but will only get 1
          '0x0001000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
          '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
        ],
        [action1Data, action2Data],
      ]);

      // Execute task executor
      const target = this.taskExecutor.address;
      await expectRevert.unspecified(
        this.userProxy.execute(target, data, {
          from: user,
        })
      );
    });
  });
});
