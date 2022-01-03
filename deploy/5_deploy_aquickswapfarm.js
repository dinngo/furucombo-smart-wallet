const fee = 2000;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log("deployer:" + deployer);
    await deploy('AQuickswapFarm', {
        from: deployer,
        args: [
            deployer,
            deployer,
            fee,
        ],
        log: true,
    });
};

module.exports.tags = ['AQuickswapFarm'];