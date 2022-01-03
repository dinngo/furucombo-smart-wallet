const { constants, expectRevert } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const { DS_PROXY_REGISTRY } = require('./utils/constants');

const Destructible = artifacts.require('DestructibleActionMock');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');

contract('DestructibleAction', function ([_, owner, other]) {
  before(async function () {
    initialEvmId = await evmSnapshot();

    this.destructible = await Destructible.new(owner);

    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    const dsProxyAddr = await this.dsRegistry.proxies.call(other);
    if (dsProxyAddr == constants.ZERO_ADDRESS) {
      await this.dsRegistry.build(other);
    }
    this.otherProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(other)
    );
  });

  beforeEach(async function () {
    id = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(id);
  });

  after(async function () {
    await evmRevert(initialEvmId);
  });

  describe('destroys', function () {
    it('destroy by owner', async function () {
      await this.destructible.destroy({
        from: owner,
      });
      expect(await web3.eth.getCode(this.destructible.address)).eq('0x');
    });

    it('prevents non-owners from destroying', async function () {
      await expectRevert(
        this.destructible.destroy({ from: other }),
        'DestructibleAction: caller is not the owner'
      );
    });

    it('prevents other proxy from destroying', async function () {
      const data = getCallData(Destructible, 'destroy', []);
      await expectRevert(
        this.otherProxy.execute(this.destructible.address, data, {
          from: other,
        }),
        'DestructibleAction: caller is not the owner'
      );
    });
  });
});
