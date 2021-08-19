const Action = artifacts.require('ATrevi');

const fee = 9;
const archangel = '0xf40236022134668361A3Da9EA9CcfA916E1c7441'; // replace it depend on your env

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }

  const owner = deployer.provider.addresses[0];
  await deployer.deploy(Action, owner, archangel, owner, fee);
};
