module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('TaskExecutor', {
    from: deployer,
    args: [deployer],
    log: true,
  });
};

module.exports.tags = ['TaskExecutor'];
