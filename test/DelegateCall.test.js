const { expectRevert, BN } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const { DS_PROXY_REGISTRY } = require('./utils/constants');

const DelegateCall = artifacts.require('DelegateCallActionMock');
const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');

contract('DelegateCallAction', function([_, owner, other]) {
  before(async function() {
    this.delegateCall = await DelegateCall.new(5);

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

  describe('delegate call', function() {
    it('should revert: delegate call only', async function() {
      await expectRevert(this.delegateCall.getCount(), 'Delegate call only');
    });
  });
});
