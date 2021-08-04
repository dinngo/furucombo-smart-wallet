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
const { evmRevert, evmSnapshot } = require('./utils/utils');

const IDSProxyRegistry = artifacts.require('IDSProxyRegistry');
const IDSProxy = artifacts.require('IDSProxy');
const IDSAuth = artifacts.require('IDSAuth');
const AAuth = artifacts.require('AAuth');

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
      const auth = await this.userProxy.authority.call();
      console.log(`auth = ${auth}`);
      expect(await this.userProxy.authority.call()).to.be.zero;
    });
    it('normal', async function() {
      const data = abi.simpleEncode('createAndSetAuth()');
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
      });

      const newAuthAddress = await this.userProxy.authority.call();
      const newAuth = await IDSAuth.at(newAuthAddress);
      console.log(`newAuthAddress = ${newAuthAddress}`);

      expect(newAuthAddress).to.be.not.zero;
      expect(await newAuth.owner.call()).to.be.eq(this.userProxy.address);
    });
  });
});
