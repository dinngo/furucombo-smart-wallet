const fee = 2000;

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('AQuickswapDualMining', {
    from: deployer,
    args: [deployer, deployer, fee],
    log: true,
  });
};

module.exports.tags = ['AQuickswapDualMining'];
