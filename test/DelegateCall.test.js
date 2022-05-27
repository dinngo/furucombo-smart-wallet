const { expectRevert } = require('@openzeppelin/test-helpers');

const { evmRevert, evmSnapshot } = require('./utils/utils');

const DelegateCall = artifacts.require('DelegateCallActionMock');

contract('DelegateCallAction', function([_]) {
  let id;
  let initialEvmId;

  before(async function() {
    initialEvmId = await evmSnapshot();
    this.delegateCall = await DelegateCall.new(5);
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

  describe('delegate call', function() {
    it('should revert: delegate call only', async function() {
      await expectRevert(this.delegateCall.getCount(), 'Delegate call only');
    });
  });
});
