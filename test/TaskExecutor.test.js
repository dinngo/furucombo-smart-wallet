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
const utils = web3.utils;

const { expect } = require('chai');

const {
  evmRevert,
  evmSnapshot,
  getCallData,
  genCallActionData,
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
  let balanceSomeone;
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
    balanceUser = await tracker(user);
    balanceSomeone = await tracker(someone);
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('execute', function() {
    describe('execute by delegate call', function() {
      before(async function() {
        await send.ether(user, this.userProxy.address, ether('10'));
      });

      it('single action', async function() {
        // Prepare action data
        const expectNValue = new BN(101);
        const actionAData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          expectNValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
      });

      it('multiple actions', async function() {
        // Prepare action data
        const expectNValue = new BN(101);
        const actionAData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          expectNValue,
        ]);

        const expectBValue =
          '0x00000000000000000000000000000000000000000000000000000000000000ff';
        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          expectBValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
        expect(await this.foo.bValue.call()).to.be.eq(expectBValue);
      });

      it('payable action', async function() {
        var balanceFoo = await tracker(this.foo.address);

        // Prepare action data
        const value = ether('1');
        const expectNValue = new BN(101);
        const actionAData = getCallData(FooAction, 'barUint2', [
          this.foo.address,
          expectNValue,
          value,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
        expect(await balanceFoo.delta()).to.be.bignumber.eq(value);
      });

      it('should revert: no contract code', async function() {
        // Prepare action data
        const value = ether('1');
        const expectNValue = new BN(101);
        const actionAData = getCallData(FooAction, 'barUint2', [
          this.foo.address,
          expectNValue,
          value,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [ZERO_ADDRESS],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: revert in contract', async function() {
        // Prepare action data
        const value = ether('1');
        const expectNValue = new BN(101);
        const actionAData = getCallData(FooAction, 'barUint2', [
          this.foo.address,
          expectNValue,
          value,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [ZERO_ADDRESS],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: non existed function', async function() {
        // Prepare action data
        const value = ether('1');
        const expectNValue = new BN(101);
        const actionAData = web3.eth.abi.encodeFunctionSignature(
          'noExistedfunc()'
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [ZERO_ADDRESS],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });
    });

    describe('execute by call', function() {
      before(async function() {
        await send.ether(user, this.userProxy.address, ether('10'));
      });

      it('single action', async function() {
        // Prepare action data
        const actionEthValue = ether('0');
        const expectNValue = new BN(111);
        const actionData = genCallActionData(actionEthValue, Foo, 'barUint1', [
          expectNValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
      });

      it('multiple actions', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const expectNValue = new BN(111);
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUint1',
          [expectNValue]
        );

        const actionBEthValue = ether('0');
        const expectBValue =
          '0x00000000000000000000000000000000000000000000000000000000000000ff';
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          expectBValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData, actionBData],
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
        const actionEthValue = ether('5');
        const expectNValue = new BN(111);
        const actionData = genCallActionData(actionEthValue, Foo, 'barUint2', [
          expectNValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
        expect(await balanceFoo.delta()).to.be.bignumber.eq(actionEthValue);
      });

      it('send token', async function() {
        // Prepare action data
        const actionEthValue = ether('5');
        const actionData = web3.eth.abi.encodeParameters(
          ['uint256', 'bytes'],
          [actionEthValue, '0x']
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [someone],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await balanceSomeone.delta()).to.be.bignumber.eq(actionEthValue);
      });

      it('should revert: revert in contract', async function() {
        // Prepare action data
        const actionEthValue = ether('0');
        const actionData = genCallActionData(
          actionEthValue,
          Foo,
          'revertCall',
          []
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: non existed function', async function() {
        // Prepare action data
        const ethValue = ether('0');
        const actionData = web3.eth.abi.encodeParameters(
          ['uint256', 'bytes'],
          [ethValue, web3.eth.abi.encodeFunctionSignature('noExistedfunc()')]
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });
    });

    describe('execute by mix calls', function() {
      before(async function() {
        await send.ether(user, this.userProxy.address, ether('10'));
      });

      it('delegate call + call', async function() {
        // Prepare action data
        const expectNValue = new BN(101);
        const actionAData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          expectNValue,
        ]);

        const actionBEthValue = ether('0');
        const expectBValue =
          '0x00000000000000000000000000000000000000000000000000000000000000ff';
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          expectBValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.foo.address],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0200000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
        expect(await this.foo.bValue.call()).to.be.eq(expectBValue);
      });

      it('call + delegate call', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const expectBValue =
          '0x00000000000000000000000000000000000000000000000000000000000000ff';
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar1', [
          expectBValue,
        ]);

        const expectNValue = new BN(101);
        const actionBData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          expectNValue,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.fooAction.address],
          [
            '0x0200000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectNValue);
        expect(await this.foo.bValue.call()).to.be.eq(expectBValue);
      });
    });
  });

  describe('chained input', function() {
    describe('dynamic parameter by delegate call', function() {
      before(async function() {
        await send.ether(user, this.userProxy.address, ether('10'));
      });

      it('replace parameter', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
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
        const actionAData = getCallData(FooAction, 'barUList', [
          this.foo.address,
          ether('1'),
          secAmt,
          ether('1'),
        ]);
        const actionBData = getCallData(FooAction, 'barUint1', [
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
          [actionAData, actionBData],
        ]);
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
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBData = getCallData(FooAction, 'bar2', [
          this.foo.address,
          '0x000000000000000000000000000000000000000000000000000000000000000a',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000400ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
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
        const actionAData = getCallData(FooAction, 'barUint', [
          this.foo.address,
        ]);
        const actionBData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          percent,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
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
        const actionAData = getCallData(FooAction, 'barUList', [
          this.foo.address,
          expectNList[0],
          expectNList[1],
          expectNList[2],
        ]);
        const actionBData = getCallData(FooAction, 'barUList2', [
          this.foo.address,
          [new BN(0), new BN(0), new BN(0)],
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x01000000000000000038040302ffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        for (var i = 0; i < expectNList.length; i++) {
          expect(await this.foo.nList.call(i)).to.be.bignumber.eq(
            expectNList[i]
          );
        }
      });

      it('should revert: location count less than ref count', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            // 1 32-bytes return value to be referenced
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x010000000000000000020000ffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (1, 2)
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: location count greater than ref count', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            // 1 32-bytes return value to be referenced
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000300ffffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (2, 1)
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: ref to out of localStack', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            // 1 32-bytes return value to be referenced
            '0x0001000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
            '0x0100000000000000000201ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: expected return amount not match', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            // expect 2 32-bytes return but will only get 1
            '0x0002000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: overflow during trimming', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'barUint', [
          this.foo.address,
        ]);
        const actionBData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          MAX_UINT256,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.fooAction.address],
          [
            // expect 2 32-bytes return but will only get 1
            '0x0001000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });
    });

    describe('dynamic parameter by call', function() {
      before(async function() {
        await send.ether(user, this.userProxy.address, ether('10'));
      });

      it('replace parameter', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000100ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
      });

      it('replace parameter with dynamic array return', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const secAmt = ether('1');
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUList',
          [ether('1'), secAmt, ether('1')]
        );

        const actionBEthValue = ether('0');
        const ratio = ether('0.7');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUint1',
          [ratio]
        );

        // Prepare task data and execute
        // local stack idx start from [+2] if using dynamic array
        // because it will store 2 extra data(pointer and array length) to local stack in the first and second index
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            '0x0205000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x0300000000000000000102ffffffffffffffffffffffffffffffffffffffffff', //replace params[0] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
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
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar2', [
          '0x000000000000000000000000000000000000000000000000000000000000000a',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
      });

      it('replace parameter by 50% of ref value', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUint',
          []
        );

        const actionBEthValue = ether('0');
        const percent = ether('0.5');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUint1',
          [percent]
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000100ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
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
        const actionAEthValue = ether('0');
        const expectNList = [new BN(300), new BN(100), new BN(75)];
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUList',
          [expectNList[0], expectNList[1], expectNList[2]]
        );

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUList2',
          [[new BN(0), new BN(0), new BN(0)]]
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            '0x0205000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x0300000000000000001C040302ffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        for (var i = 0; i < expectNList.length; i++) {
          expect(await this.foo.nList.call(i)).to.be.bignumber.eq(
            expectNList[i]
          );
        }
      });

      it('should revert: location count less than ref count', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            // 1 32-bytes return value to be referenced
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x03000000000000000010000ffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (1, 2)
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: location count greater than ref count', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar2', [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            // 1 32-bytes return value to be referenced
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000300ffffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (2, 1)
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: ref to out of localStack', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            // 1 32-bytes return value to be referenced
            '0x0201000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
            '0x0300000000000000000101ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: expected return amount not match', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            // expect 2 32-bytes return but will only get 1
            '0x0202000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });

      it('should revert: overflow during trimming', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUint',
          []
        );

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUint1',
          [MAX_UINT256]
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.foo.address],
          [
            // expect 2 32-bytes return but will only get 1
            '0x0201000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
            '0x0100000000000000000100ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await expectRevert.unspecified(
          this.userProxy.execute(target, data, {
            from: user,
          })
        );
      });
    });

    describe('dynamic parameter by mix call', function() {
      before(async function() {
        await send.ether(user, this.userProxy.address, ether('10'));
      });

      it('replace parameter by delegate call + call', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar1', [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.foo.address],
          [
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000100ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
      });

      it('replace parameter by call + delegate call', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        const actionBData = getCallData(FooAction, 'bar1', [
          this.foo.address,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.fooAction.address],
          [
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
      });

      it('replace parameter with dynamic array return by delegate call + call', async function() {
        // Prepare action data
        const secAmt = ether('1');
        const actionAData = getCallData(FooAction, 'barUList', [
          this.foo.address,
          ether('1'),
          secAmt,
          ether('1'),
        ]);

        const actionBEthValue = ether('0');
        const ratio = ether('0.7');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUint1',
          [ratio]
        );

        // Prepare task data and execute
        // local stack idx start from [+2] if using dynamic array
        // because it will store 2 extra data(pointer and array length) to local stack in the first and second index
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.foo.address],
          [
            '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x0300000000000000000102ffffffffffffffffffffffffffffffffffffffffff', //replace params[0] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await this.foo.nValue.call()).to.be.bignumber.eq(
          secAmt.mul(ratio).div(ether('1'))
        );
      });

      it('replace parameter with dynamic array return by call + delegate call', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const secAmt = ether('1');
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUList',
          [ether('1'), secAmt, ether('1')]
        );
        const ratio = ether('0.7');
        const actionBData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          ratio,
        ]);

        // Prepare task data and execute
        // local stack idx start from [+2] if using dynamic array
        // because it will store 2 extra data(pointer and array length) to local stack in the first and second index
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.fooAction.address],
          [
            '0x0205000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x0100000000000000000203ffffffffffffffffffffffffffffffffffffffffff', //replace params[0] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        expect(await this.foo.nValue.call()).to.be.bignumber.eq(
          secAmt.mul(ratio).div(ether('1'))
        );
      });

      it('replace third parameter by delegate call + call', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'bar', [this.foo.address]);
        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(actionBEthValue, Foo, 'bar2', [
          '0x000000000000000000000000000000000000000000000000000000000000000a',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.foo.address],
          [
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
      });

      it('replace third parameter by call + delegate call', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(actionAEthValue, Foo, 'bar', []);

        // Prepare action data
        const actionBData = getCallData(FooAction, 'bar2', [
          this.foo.address,
          '0x000000000000000000000000000000000000000000000000000000000000000a',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.fooAction.address],
          [
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000400ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.bValue.call()).eq(await this.foo.bar.call());
      });

      it('replace parameter by 50% of ref value by delegate call + call', async function() {
        // Prepare action data
        const actionAData = getCallData(FooAction, 'barUint', [
          this.foo.address,
        ]);

        const actionBEthValue = ether('0');
        const percent = ether('0.5');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUint1',
          [percent]
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.foo.address],
          [
            '0x0001000000000000000000000000000000000000000000000000000000000000',
            '0x0300000000000000000100ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.nValue.call()).to.be.bignumber.eq(
          (await this.foo.barUint.call()).mul(percent).div(ether('1'))
        );
      });

      it('replace parameter by 50% of ref value by call + delegate call', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUint',
          []
        );

        const percent = ether('0.5');
        const actionBData = getCallData(FooAction, 'barUint1', [
          this.foo.address,
          percent,
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.fooAction.address],
          [
            '0x0201000000000000000000000000000000000000000000000000000000000000',
            '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        expect(await this.foo.nValue.call()).to.be.bignumber.eq(
          (await this.foo.barUint.call()).mul(percent).div(ether('1'))
        );
      });

      it('replace dynamic array parameter with dynamic array return by delegate call + call', async function() {
        // Prepare action data
        const expectNList = [new BN(300), new BN(100), new BN(75)];
        const actionAData = getCallData(FooAction, 'barUList', [
          this.foo.address,
          expectNList[0],
          expectNList[1],
          expectNList[2],
        ]);

        const actionBEthValue = ether('0');
        const actionBData = genCallActionData(
          actionBEthValue,
          Foo,
          'barUList2',
          [[new BN(0), new BN(0), new BN(0)]]
        );

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.fooAction.address, this.foo.address],
          [
            '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x0300000000000000001C040302ffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        for (var i = 0; i < expectNList.length; i++) {
          expect(await this.foo.nList.call(i)).to.be.bignumber.eq(
            expectNList[i]
          );
        }
      });

      it('replace dynamic array parameter with dynamic array return by call + delegate call', async function() {
        // Prepare action data
        const actionAEthValue = ether('0');
        const expectNList = [new BN(300), new BN(100), new BN(75)];
        const actionAData = genCallActionData(
          actionAEthValue,
          Foo,
          'barUList',
          [expectNList[0], expectNList[1], expectNList[2]]
        );

        const actionBData = getCallData(FooAction, 'barUList2', [
          this.foo.address,
          [new BN(0), new BN(0), new BN(0)],
        ]);

        // Prepare task data and execute
        const data = getCallData(TaskExecutor, 'batchExec', [
          [this.foo.address, this.fooAction.address],
          [
            '0x0205000000000000000000000000000000000000000000000000000000000000', // be referenced
            '0x01000000000000000038040302ffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
          ],
          [actionAData, actionBData],
        ]);
        const target = this.taskExecutor.address;
        await this.userProxy.execute(target, data, {
          from: user,
        });

        // Verify
        for (var i = 0; i < expectNList.length; i++) {
          expect(await this.foo.nList.call(i)).to.be.bignumber.eq(
            expectNList[i]
          );
        }
      });
    });
  });
});
