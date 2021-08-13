const Action = artifacts.require('ATrevi');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Action);
};
