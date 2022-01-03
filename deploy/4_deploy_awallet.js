module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log("deployer:" + deployer);
    await deploy('AWallet', {
        from: deployer,
        args: [deployer],
        log: true,
    });
};

module.exports.tags = ['AWallet'];