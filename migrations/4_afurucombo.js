const Action = artifacts.require('AFurucombo');

const proxy = '0x78B95131bC21eC73DF5158CF7A018Ad7bADa5561'; // replace it depend on your env

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  const owner = deployer.provider.addresses[0];
  await deployer.deploy(Action, owner, proxy);
};
