const proxy = '0x125d2E4a83bBba4e6f51a244c494f9A1958D20BB'; // replace it depend on your env

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('AFurucombo', {
    from: deployer,
    args: [deployer, proxy],
    log: true,
  });
};

module.exports.tags = ['AFurucombo'];
