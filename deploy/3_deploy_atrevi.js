const fee = 9;
const archangel = '0xf40388b593efb236d1AB314A6aa969F9487890d8';

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('ATrevi', {
    from: deployer,
    args: [deployer, archangel, deployer, fee],
    log: true,
  });
};

module.exports.tags = ['ATrevi'];
