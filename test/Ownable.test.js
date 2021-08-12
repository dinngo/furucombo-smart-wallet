const {
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const { DS_PROXY_REGISTRY } = require('./utils/constants');

const Ownable = artifacts.require('OwnableActionMock');
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
});
