const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_BYTES32, MAX_UINT256 } = constants;
// const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const {
  evmRevert,
  evmSnapshot,
  profileGas,
  getCallData,
} = require('./utils/utils');
const { DSProxyRegistry } = require('./utils/constants');

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
    this.dsProxyRegistry = await IDSProxyRegistry.at(DSProxyRegistry);
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

  describe('dsproxy', function() {
    before(async function() {
      // this.foo = await Foo4.new();
      // this.fooHandler = await Foo4Handler.new();
      // await this.registry.register(
      //   this.fooHandler.address,
      //   utils.asciiToHex('foo4')
      // );
    });

    it('Setup DSProxy', async function() {
      console.log('DSProxy', this.userProxy.address);
    });

    it('Task Executor execute', async function() {
      // Prepare action data
      const expectValue = new BN(101);
      const action1Data = getCallData(FooAction, 'barUint1', [
        this.foo.address,
        expectValue,
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

      expect(await this.foo.nValue.call()).to.be.bignumber.eq(expectValue);
    });
  });

  // describe('execute', function() {
  //   before(async function() {
  //     this.fooFactory = await FooFactory.new({ from: deployer });
  //     expect(this.fooFactory.address).to.be.eq(
  //       '0xFdd454EA7BF7ca88C1B7a824c3FB0951Fb8a1318'
  //     );
  //     await this.fooFactory.createFoo();
  //     await this.fooFactory.createFoo();
  //     this.foo0 = await Foo.at(await this.fooFactory.addressOf.call(0));
  //     this.foo1 = await Foo.at(await this.fooFactory.addressOf.call(1));
  //     this.foo2 = await Foo.at(await this.fooFactory.addressOf.call(2));
  //     this.fooHandler = await FooHandler.new();
  //     await this.registry.register(
  //       this.fooHandler.address,
  //       utils.asciiToHex('foo')
  //     );
  //   });

  //   it('single', async function() {
  //     const index = 0;
  //     const num = new BN('25');
  //     const data = abi.simpleEncode(
  //       'bar(uint256,uint256):(uint256)',
  //       index,
  //       num
  //     );
  //     await this.proxy.execMock(this.fooHandler.address, data);
  //     const result = await this.foo0.accounts.call(this.proxy.address);
  //     expect(result).to.be.bignumber.eq(num);
  //   });

  //   it('should revert: caller as handler', async function() {
  //     this.fooHandler2 = await FooHandler.new();
  //     await this.registry.registerCaller(
  //       this.fooHandler2.address,
  //       utils.asciiToHex('foo')
  //     );
  //     const index = 0;
  //     const num = new BN('25');
  //     const to = [this.fooHandler2.address];
  //     const config = [ZERO_BYTES32];
  //     const data = [
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index, num),
  //     ];
  //     await expectRevert(
  //       this.proxy.batchExec(to, config, data),
  //       'Invalid handler'
  //     );
  //   });

  //   it('should revert: handler as caller - directly', async function() {
  //     this.foo5Handler = await Foo5Handler.new();
  //     await this.registry.register(
  //       this.foo5Handler.address,
  //       utils.asciiToHex('foo5')
  //     );
  //     const data = abi.simpleEncode('bar()');
  //     await expectRevert(
  //       this.foo5Handler.exec(this.proxy.address, data),
  //       'Sender is not initialized'
  //     );
  //   });

  //   it('should revert: handler as caller - after initialize', async function() {
  //     this.foo5Handler = await Foo5Handler.new();
  //     await this.registry.register(
  //       this.foo5Handler.address,
  //       this.foo5Handler.address
  //     );
  //     const to = this.foo5Handler.address;
  //     const data0 = abi.simpleEncode('bar()');
  //     const data1 = abi.simpleEncode(
  //       'exec(address,bytes)',
  //       this.proxy.address,
  //       data0
  //     );
  //     const data2 = abi.simpleEncode('exec(address,bytes)', to, data1);
  //     await expectRevert(this.proxy.execMock(to, data2), 'Invalid caller');
  //   });

  //   it('should revert: banned agent executing batchExec()', async function() {
  //     await this.registry.ban(this.proxy.address);
  //     const index = 0;
  //     const num = new BN('25');
  //     const to = [this.fooHandler.address];
  //     const config = [ZERO_BYTES32];
  //     const data = [
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index, num),
  //     ];
  //     await expectRevert(
  //       this.proxy.batchExec(to, config, data, { from: user }),
  //       'Banned'
  //     );
  //   });

  //   it('should revert: banned agent executing fallback()', async function() {
  //     await this.registry.ban(this.proxy.address);
  //     await expectRevert(
  //       web3.eth.sendTransaction({
  //         from: user,
  //         to: this.proxy.address,
  //         value: ether('1'),
  //         data: '0x123',
  //       }),
  //       'Banned'
  //     );
  //   });

  //   it('should revert: banned agent executing execs()', async function() {
  //     await this.registry.ban(this.proxy.address);
  //     const index = 0;
  //     const num = new BN('25');
  //     const to = [this.fooHandler.address];
  //     const config = [ZERO_BYTES32];
  //     const data = [
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index, num),
  //     ];
  //     await expectRevert(
  //       this.proxy.execs(to, config, data, { from: user }),
  //       'Banned'
  //     );
  //   });

  //   it('should revert: call batchExec() when registry halted', async function() {
  //     await this.registry.halt();
  //     const index = 0;
  //     const num = new BN('25');
  //     const to = [this.fooHandler.address];
  //     const config = [ZERO_BYTES32];
  //     const data = [
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index, num),
  //     ];
  //     await expectRevert(
  //       this.proxy.batchExec(to, config, data, { from: user }),
  //       'Halted'
  //     );
  //   });

  //   it('should revert: call fallback() when registry halted', async function() {
  //     await this.registry.halt();
  //     await expectRevert(
  //       web3.eth.sendTransaction({
  //         from: user,
  //         to: this.proxy.address,
  //         value: ether('1'),
  //         data: '0x123',
  //       }),
  //       'Halted'
  //     );
  //   });

  //   it('should revert: call execs() registry halted', async function() {
  //     await this.registry.halt();
  //     const index = 0;
  //     const num = new BN('25');
  //     const to = [this.fooHandler.address];
  //     const config = [ZERO_BYTES32];
  //     const data = [
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index, num),
  //     ];
  //     await expectRevert(
  //       this.proxy.execs(to, config, data, { from: user }),
  //       'Halted'
  //     );
  //   });

  //   it('multiple', async function() {
  //     const index = [0, 1, 2];
  //     const num = [new BN('25'), new BN('26'), new BN('27')];
  //     const to = [
  //       this.fooHandler.address,
  //       this.fooHandler.address,
  //       this.fooHandler.address,
  //     ];
  //     const config = [ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32];
  //     const data = [
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index[0], num[0]),
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index[1], num[1]),
  //       abi.simpleEncode('bar(uint256,uint256):(uint256)', index[2], num[2]),
  //     ];
  //     await this.proxy.batchExec(to, config, data);
  //     const result = [
  //       await this.foo0.accounts.call(this.proxy.address),
  //       await this.foo1.accounts.call(this.proxy.address),
  //       await this.foo2.accounts.call(this.proxy.address),
  //     ];
  //     expect(result[0]).to.be.bignumber.eq(num[0]);
  //     expect(result[1]).to.be.bignumber.eq(num[1]);
  //     expect(result[2]).to.be.bignumber.eq(num[2]);
  //   });
  // });

  // describe('dynamic parameter', function() {
  //   before(async function() {
  //     this.foo = await Foo4.new();
  //     this.fooHandler = await Foo4Handler.new();
  //     await this.registry.register(
  //       this.fooHandler.address,
  //       utils.asciiToHex('foo4')
  //     );
  //   });

  //   it('static parameter', async function() {
  //     const tos = [this.fooHandler.address];
  //     const a =
  //       '0x00000000000000000000000000000000000000000000000000000000000000ff';
  //     const configs = [
  //       '0x0000000000000000000000000000000000000000000000000000000000000000',
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
  //     ];

  //     await this.proxy.batchExec(tos, configs, datas, {
  //       from: user,
  //       value: ether('1'),
  //     });

  //     expect(await this.foo.bValue.call()).eq(a);
  //   });

  //   it('replace parameter', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.bar.call();
  //     const a =
  //       '0x0000000000000000000000000000000000000000000000000000000000000000';
  //     const configs = [
  //       // 1 32-bytes return value to be referenced
  //       '0x0001000000000000000000000000000000000000000000000000000000000000',
  //       '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar(address)', this.foo.address),
  //       abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
  //     ];

  //     await this.proxy.batchExec(tos, configs, datas, {
  //       from: user,
  //       value: ether('1'),
  //     });

  //     expect(await this.foo.bValue.call()).eq(r);
  //   });

  //   it('replace parameter with dynamic array return', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const secAmt = ether('1');
  //     const ratio = ether('0.7');

  //     // local stack idx start from [+2] if using dynamic array
  //     // because it will store 2 extra data(pointer and array length) to local stack in the first and second index
  //     const configs = [
  //       // 5 32-bytes return value to be referenced
  //       '0x0005000000000000000000000000000000000000000000000000000000000000', // be referenced
  //       '0x0100000000000000000203ffffffffffffffffffffffffffffffffffffffffff', //replace params[1] -> local stack[3]
  //     ];

  //     const datas = [
  //       abi.simpleEncode(
  //         'barUList(address,uint256,uint256,uint256)',
  //         this.foo.address,
  //         ether('1'),
  //         secAmt,
  //         ether('1')
  //       ),
  //       abi.simpleEncode('barUint1(address,uint256)', this.foo.address, ratio),
  //     ];

  //     const receipt = await this.proxy.batchExec(tos, configs, datas, {
  //       from: user,
  //       value: ether('1'),
  //     });

  //     expect(await this.foo.nValue.call()).to.be.bignumber.eq(
  //       secAmt.mul(ratio).div(ether('1'))
  //     );
  //   });

  //   it('replace third parameter', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.bar.call();
  //     const a =
  //       '0x000000000000000000000000000000000000000000000000000000000000000a';
  //     const b =
  //       '0x0000000000000000000000000000000000000000000000000000000000000000';
  //     const configs = [
  //       '0x0001000000000000000000000000000000000000000000000000000000000000',
  //       '0x0100000000000000000400ffffffffffffffffffffffffffffffffffffffffff',
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar(address)', this.foo.address),
  //       abi.simpleEncode(
  //         'bar2(address,bytes32,bytes32)',
  //         this.foo.address,
  //         a,
  //         b
  //       ),
  //     ];

  //     await this.proxy.batchExec(tos, configs, datas, {
  //       from: user,
  //       value: ether('1'),
  //     });

  //     expect(await this.foo.bValue.call()).eq(r);
  //   });

  //   it('replace parameter by 50% of ref value', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.barUint.call();
  //     const a = ether('0.5');
  //     const configs = [
  //       '0x0001000000000000000000000000000000000000000000000000000000000000',
  //       '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
  //     ];
  //     const datas = [
  //       abi.simpleEncode('barUint(address)', this.foo.address),
  //       abi.simpleEncode('barUint1(address,uint256)', this.foo.address, a),
  //     ];

  //     await this.proxy.batchExec(tos, configs, datas, {
  //       from: user,
  //       value: ether('1'),
  //     });

  //     expect(await this.foo.nValue.call()).to.be.bignumber.eq(
  //       r.mul(a).div(ether('1'))
  //     );
  //   });

  //   it('should revert: location count less than ref count', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.bar.call();
  //     const a =
  //       '0x0000000000000000000000000000000000000000000000000000000000000000';
  //     const configs = [
  //       // 1 32-bytes return value to be referenced
  //       '0x0001000000000000000000000000000000000000000000000000000000000000',
  //       '0x010000000000000000020000ffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (1, 2)
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar(address)', this.foo.address),
  //       abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
  //     ];

  //     await expectRevert(
  //       this.proxy.batchExec(tos, configs, datas, {
  //         from: user,
  //         value: ether('1'),
  //       }),
  //       'Location count less than ref count'
  //     );
  //   });

  //   it('should revert: location count greater than ref count', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.bar.call();
  //     const a =
  //       '0x0000000000000000000000000000000000000000000000000000000000000000';
  //     const configs = [
  //       // 1 32-bytes return value to be referenced
  //       '0x0001000000000000000000000000000000000000000000000000000000000000',
  //       '0x0100000000000000000300ffffffffffffffffffffffffffffffffffffffffff', // (locCount, refCount) = (2, 1)
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar(address)', this.foo.address),
  //       abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
  //     ];

  //     await expectRevert(
  //       this.proxy.batchExec(tos, configs, datas, {
  //         from: user,
  //         value: ether('1'),
  //       }),
  //       'Location count exceeds ref count'
  //     );
  //   });

  //   it('should revert: ref to out of localStack', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.bar.call();
  //     const a =
  //       '0x0000000000000000000000000000000000000000000000000000000000000000';
  //     const configs = [
  //       // 1 32-bytes return value to be referenced
  //       '0x0001000000000000000000000000000000000000000000000000000000000000', // set localStack[0]
  //       '0x0100000000000000000201ffffffffffffffffffffffffffffffffffffffffff', // ref to localStack[1]
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar(address)', this.foo.address),
  //       abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
  //     ];

  //     await expectRevert(
  //       this.proxy.batchExec(tos, configs, datas, {
  //         from: user,
  //         value: ether('1'),
  //       }),
  //       'Reference to out of localStack'
  //     );
  //   });

  //   it('should revert: expected return amount not match', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.bar.call();
  //     const a =
  //       '0x0000000000000000000000000000000000000000000000000000000000000000';
  //     const configs = [
  //       // expect 2 32-bytes return but will only get 1
  //       '0x0002000000000000000000000000000000000000000000000000000000000000',
  //       '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
  //     ];
  //     const datas = [
  //       abi.simpleEncode('bar(address)', this.foo.address),
  //       abi.simpleEncode('bar1(address,bytes32)', this.foo.address, a),
  //     ];

  //     await expectRevert(
  //       this.proxy.batchExec(tos, configs, datas, {
  //         from: user,
  //         value: ether('1'),
  //       }),
  //       'Return num and parsed return num not matched'
  //     );
  //   });

  //   it('should revert: overflow during trimming', async function() {
  //     const tos = [this.fooHandler.address, this.fooHandler.address];
  //     const r = await this.foo.barUint.call();
  //     const a = MAX_UINT256; // multiply by any num greater than 0 will cause overflow
  //     const configs = [
  //       '0x0001000000000000000000000000000000000000000000000000000000000000',
  //       '0x0100000000000000000200ffffffffffffffffffffffffffffffffffffffffff',
  //     ];
  //     const datas = [
  //       abi.simpleEncode('barUint(address)', this.foo.address),
  //       abi.simpleEncode('barUint1(address,uint256)', this.foo.address, a),
  //     ];

  //     await expectRevert.unspecified(
  //       this.proxy.batchExec(tos, configs, datas, {
  //         from: user,
  //         value: ether('1'),
  //       })
  //     );
  //   });
  // });
});
