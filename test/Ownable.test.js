const { expect } = require('chai');

const { evmRevert, evmSnapshot } = require('./utils/utils');

const Ownable = artifacts.require('OwnableActionMock');

contract('OwnableAction', function([_, owner]) {
  let initialEvmId;

  before(async function() {
    initialEvmId = await evmSnapshot();
    this.ownable = await Ownable.new(owner);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  after(async function() {
    await evmRevert(initialEvmId);
  });

  it('has an owner', async function() {
    expect(await this.ownable.actionOwner()).to.equal(owner);
  });
});
