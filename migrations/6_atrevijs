const Action = artifacts.require('AWallet');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Action);
};
