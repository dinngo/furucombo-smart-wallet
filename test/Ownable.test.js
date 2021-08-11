const {
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const { DS_PROXY_REGISTRY } = require('./utils/constants');

const Ownable = artifacts.require('OwnableMock');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');

contract('Ownable', function([owner, other]) {
  before(async function() {
    this.ownable = await Ownable.new({ from: owner });

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

  it('has an owner', async function() {
    expect(await this.ownable.owner()).to.equal(owner);
  });

  describe('transfer ownership', function() {
    it('changes owner after transfer', async function() {
      const receipt = await this.ownable.transferOwnership(other, {
        from: owner,
      });
      expectEvent(receipt, 'OwnershipTransferred', {
        previousOwner: owner,
        newOwner: other,
      });

      expect(await this.ownable.owner()).to.equal(other);
    });

    it('prevents non-owners from transferring', async function() {
      await expectRevert(
        this.ownable.transferOwnership(other, { from: other }),
        'Ownable: caller is not the owner'
      );
    });

    it('prevents other proxy from transferring', async function() {
      const data = getCallData(Ownable, 'transferOwnership', [other]);
      await expectRevert(
        this.otherProxy.execute(this.ownable.address, data, {
          from: other,
        }),
        'Ownable: caller is not the owner'
      );
    });

    it('guards ownership against stuck state', async function() {
      await expectRevert(
        this.ownable.transferOwnership(ZERO_ADDRESS, { from: owner }),
        'Ownable: new owner is the zero address'
      );
    });
  });

  describe('renounce ownership', function() {
    it('loses owner after renouncement', async function() {
      const receipt = await this.ownable.renounceOwnership({ from: owner });
      expectEvent(receipt, 'OwnershipTransferred', {
        previousOwner: owner,
        newOwner: ZERO_ADDRESS,
      });

      expect(await this.ownable.owner()).to.equal(ZERO_ADDRESS);
    });

    it('prevents non-owners from renouncement', async function() {
      await expectRevert(
        this.ownable.renounceOwnership({ from: other }),
        'Ownable: caller is not the owner'
      );
    });
  });
});
