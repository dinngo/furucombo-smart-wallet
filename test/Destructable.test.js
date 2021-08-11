const { expectRevert } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const { DS_PROXY_REGISTRY } = require('./utils/constants');

const Destructible = artifacts.require('DestructibleMock');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');

contract('Destructible', function([owner, other]) {
  before(async function() {
    this.destructible = await Destructible.new({ from: owner });

    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(other);
    this.otherProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(other)
    );
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('destroys', function() {
    it('destroy by owner', async function() {
      await this.destructible.destroy({
        from: owner,
      });
      expect(await web3.eth.getCode(this.destructible.address)).eq('0x');
    });

    it('prevents non-owners from destroying', async function() {
      await expectRevert(
        this.destructible.destroy({ from: other }),
        'Ownable: caller is not the owner'
      );
    });

    it('prevents other proxy from destroying', async function() {
      const data = getCallData(Destructible, 'destroy', []);
      await expectRevert(
        this.otherProxy.execute(this.destructible.address, data, {
          from: other,
        }),
        'Ownable: caller is not the owner'
      );
    });
  });
});