const { expectRevert } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const { evmRevert, evmSnapshot } = require('./utils/utils');

const DelegateCall = artifacts.require('DelegateCallActionMock');

contract('DelegateCallAction', function([_]) {
  before(async function() {
    this.delegateCall = await DelegateCall.new(5);
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('delegate call', function() {
    it('should revert: delegate call only', async function() {
      await expectRevert(this.delegateCall.getCount(), 'Delegate call only');
    });
  });
});
