const Action = artifacts.require('AAuth');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Action);
};
