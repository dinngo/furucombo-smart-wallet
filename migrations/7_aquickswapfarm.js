const Action = artifacts.require('AQuickswapFarm');

const fee = 2000;

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }

  const owner = deployer.provider.addresses[0];
  await deployer.deploy(Action, owner, owner, fee);
};
