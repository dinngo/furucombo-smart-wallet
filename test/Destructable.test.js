const { expectRevert } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const { evmRevert, evmSnapshot } = require('./utils/utils');

const Destructible = artifacts.require('DestructibleMock');

contract('Destructible', function([owner, other]) {
  before(async function() {
    this.destructible = await Destructible.new({ from: owner });
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
  });
});
