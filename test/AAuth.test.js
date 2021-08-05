const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
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
const DSGuard = artifacts.require('DSGuard');
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
        value: ether('0.01'),
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
        value: ether('0.01'),
      });

      const newAuthAddress = await this.userProxy.authority.call();
      const newAuth = await IDSAuth.at(newAuthAddress);
      expect(newAuthAddress).to.be.not.zero;
      expect(await newAuth.owner.call()).to.be.eq(this.userProxy.address);
      // Verify Auth
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

    it('replace existing auth', async function() {
      // First Auth
      const callers0 = [someone1];
      const data0 = getCallData(AAuth, 'createAndSetAuthPrePermit', [callers0]);
      await this.userProxy.execute(this.aAuth.address, data0, {
        from: user,
        value: ether('0.01'),
      });
      const firstAuthAddress = await this.userProxy.authority.call();
      const firstAuth = await IDSAuth.at(firstAuthAddress);
      expect(firstAuthAddress).to.be.not.zero;
      // Verify Auth
      expect(
        await firstAuth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;

      // Second Auth
      const callers1 = [someone2];
      const data1 = getCallData(AAuth, 'createAndSetAuthPrePermit', [callers1]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data1, {
        from: callers0[0],
        value: ether('0.01'),
      });
      const newAuthAddress = await this.userProxy.authority.call();
      const newAuth = await IDSAuth.at(newAuthAddress);
      expect(newAuthAddress).to.be.not.eq(firstAuthAddress);
      // Verify Auth
      expect(
        await newAuth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.false;
      expect(
        await newAuth.canCall.call(
          someone2,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
    });
  });

  describe('Permit', function() {
    beforeEach(async function() {
      const data = getCallData(AAuth, 'createAndSetAuth', []);
      await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
        value: ether('0.01'),
      });
      this.authAddress = await this.userProxy.authority.call();
      this.auth = await IDSAuth.at(this.authAddress);
      expect(this.authAddress).to.be.not.zero;
    });

    it('single', async function() {
      const callers = [someone1];
      const data = getCallData(AAuth, 'permit', [callers]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
        value: ether('0.01'),
      });

      // Verify Auth
      expect(
        await this.auth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
      expect(
        await this.auth.canCall.call(
          someone2,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.false;
    });

    it('multiple', async function() {
      const callers = [someone1, someone2];
      const data = getCallData(AAuth, 'permit', [callers]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
        value: ether('0.01'),
      });

      // Verify Auth
      expect(
        await this.auth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
      expect(
        await this.auth.canCall.call(
          someone2,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
    });

    it('dsProxy not owner of dsGuard', async function() {
      // Prepare and set new dsGuard
      const newAuth = await DSGuard.new({ from: user });
      await this.userProxy.setAuthority(newAuth.address, {
        from: user,
      });
      expect(await newAuth.owner.call()).to.be.eq(user);
      expect(await this.userProxy.authority.call()).to.be.eq(newAuth.address);

      // Execute permit through dsProxy
      const callers = [someone1];
      const data = getCallData(AAuth, 'permit', [callers]);
      await expectRevert.unspecified(
        this.userProxy.execute(this.aAuth.address, data, {
          from: user,
          value: ether('0.01'),
        })
      );
    });
  });

  describe('Forbid', function() {
    beforeEach(async function() {
      const callers = [someone1, someone2];
      const data = getCallData(AAuth, 'createAndSetAuthPrePermit', [callers]);
      await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
      });
      this.authAddress = await this.userProxy.authority.call();
      this.auth = await IDSAuth.at(this.authAddress);
      expect(this.authAddress).to.be.not.zero;
      expect(
        await this.auth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
      expect(
        await this.auth.canCall.call(
          someone2,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;
    });

    it('single', async function() {
      const callers = [someone1];
      const data = getCallData(AAuth, 'forbid', [callers]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
        value: ether('0.01'),
      });

      // Verify Auth
      expect(
        await this.auth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.false;
    });

    it('multiple', async function() {
      const callers = [someone1, someone2];
      const data = getCallData(AAuth, 'forbid', [callers]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: user,
        value: ether('0.01'),
      });

      // Verify Auth
      expect(
        await this.auth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.false;
      expect(
        await this.auth.canCall.call(
          someone2,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.false;
    });

    it('dsProxy not owner of dsGuard', async function() {
      // Prepare and set new dsGuard
      const newAuth = await DSGuard.new({ from: user });
      await this.userProxy.setAuthority(newAuth.address, {
        from: user,
      });
      expect(await newAuth.owner.call()).to.be.eq(user);
      expect(await this.userProxy.authority.call()).to.be.eq(newAuth.address);

      // Execute forbid through dsProxy
      const callers = [someone1];
      const data = getCallData(AAuth, 'forbid', [callers]);
      await expectRevert.unspecified(
        this.userProxy.execute(this.aAuth.address, data, {
          from: user,
          value: ether('0.01'),
        })
      );
    });
  });
});
