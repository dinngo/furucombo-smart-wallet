const Action = artifacts.require('AFurucombo');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(Action);
};
