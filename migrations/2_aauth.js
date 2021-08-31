const Action = artifacts.require('AAuth');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }

  const owner = deployer.provider.addresses[0];
  await deployer.deploy(Action, owner);
};
