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

contract('AAuth', function([_, owner, user, someone1, someone2]) {
  let id;

  before(async function() {
    this.dsRegistry = await IDSProxyRegistry.at(DS_PROXY_REGISTRY);
    await this.dsRegistry.build(user);
    this.userProxy = await IDSProxy.at(
      await this.dsRegistry.proxies.call(user)
    );
    this.aAuth = await AAuth.new(owner);
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
      const firstAuth = await DSGuard.new();
      await firstAuth.permit(
        someone1,
        this.userProxy.address,
        FUNCTION_SIG_EXECUTE
      );
      await this.userProxy.setAuthority(firstAuth.address, {
        from: user,
      });
      // Verify Auth
      expect(await this.userProxy.authority.call()).to.be.eq(firstAuth.address);
      expect(
        await firstAuth.canCall.call(
          someone1,
          this.userProxy.address,
          FUNCTION_SIG_EXECUTE
        )
      ).to.be.true;

      // Second Auth
      const callers = [someone2];
      const data = getCallData(AAuth, 'createAndSetAuthPrePermit', [callers]);
      const receipt = await this.userProxy.execute(this.aAuth.address, data, {
        from: someone1,
        value: ether('0.01'),
      });
      const newAuthAddress = await this.userProxy.authority.call();
      const newAuth = await IDSAuth.at(newAuthAddress);
      expect(newAuthAddress).to.be.not.eq(firstAuth.address);
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
      this.auth = await DSGuard.new();
      await this.auth.setOwner(this.userProxy.address);
      await this.userProxy.setAuthority(this.auth.address, { from: user });
      expect(await this.userProxy.authority.call()).to.be.eq(this.auth.address);
      expect(await this.auth.owner.call()).to.be.eq(this.userProxy.address);
      // Verify no auth given yet
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
      // Set new DSGuard with pre permit callers
      const callers = [someone1, someone2];
      this.auth = await DSGuard.new();
      await this.auth.permit(
        callers[0],
        this.userProxy.address,
        FUNCTION_SIG_EXECUTE
      );
      await this.auth.permit(
        callers[1],
        this.userProxy.address,
        FUNCTION_SIG_EXECUTE
      );
      await this.auth.setOwner(this.userProxy.address);
      await this.userProxy.setAuthority(this.auth.address, { from: user });
      // Verify pre set conditions
      expect(await this.userProxy.authority.call()).to.be.eq(this.auth.address);
      expect(await this.auth.owner.call()).to.be.eq(this.userProxy.address);
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

  describe('Destroy', function() {
    beforeEach(async function() {
      expect(await web3.eth.getCode(this.aAuth.address)).not.eq('0x');
    });

    it('kill by owner', async function() {
      await this.aAuth.destroy({
        from: owner,
      });
      // Verify
      expect(await web3.eth.getCode(this.aAuth.address)).eq('0x');
    });

    it('should revert: kill by invalid owner', async function() {
      await expectRevert(
        this.aAuth.destroy({
          from: user,
        }),
        'DestructibleAction: caller is not the owner'
      );
    });

    it('should revert: used in delegatecall', async function() {
      const data = getCallData(AAuth, 'destroy', []);
      await expectRevert.unspecified(
        this.userProxy.execute(this.aAuth.address, data, {
          from: user,
        })
      );
    });
  });
});
