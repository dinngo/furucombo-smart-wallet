const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
  send,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { duration, increase, latest } = time;
const abi = require('ethereumjs-abi');
const utils = web3.utils;

const { expect } = require('chai');

const { DS_PROXY_REGISTRY } = require('./utils/constants');
const { evmRevert, evmSnapshot, getCallData } = require('./utils/utils');

const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const IDSAuth = artifacts.require('IDSAuth');
const AAuth = artifacts.require('AAuth');

const FUNCTION_SIG_EXECUTE = '0x1cff79cd';

contract('AAuth', function([_, user, someone1, someone2]) {
  let id;

  before(async function() {
    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.aAuth = await AAuth.new();
  });

  beforeEach(async function() {
    id = await evmSnapshot();
  });

  afterEach(async function() {
    await evmRevert(id);
  });

  describe('Create DSGuard And Set', function() {
    beforeEach(async function() {
      expect(await this.userProxy.authority.call()).to.be.zero;
    });

    it('normal', async function() {
      const data = getCallData(AAuth, 'createAndSetAuth', []);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
      });

      const newAuthAddress = await this.userProxy.authority.call();
      const newAuth = await IDSAuth.at(newAuthAddress);
      expect(newAuthAddress).to.be.not.zero;
      expect(await newAuth.owner.call()).to.be.eq(this.userProxy.address);
    });

    it('pre-permit', async function() {
      const callers = [someone1];
      const data = getCallData(AAuth, 'createAndSetAuthPrePermit', [callers]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
      });

      const newAuthAddress = await this.userProxy.authority.call();
      const newAuth = await IDSAuth.at(newAuthAddress);
      expect(newAuthAddress).to.be.not.zero;
      expect(await newAuth.owner.call()).to.be.eq(this.userProxy.address);
      expect(
        await newAuth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
      expect(
        await newAuth.canCall.call(
          someone2,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.false;
    });
  });
});
