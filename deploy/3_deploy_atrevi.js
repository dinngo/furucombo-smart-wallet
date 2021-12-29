const fee = 9;
const archangel = '0xf40236022134668361A3Da9EA9CcfA916E1c7441';

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log("deployer:" + deployer);
    await deploy('ATrevi', {
        from: deployer,
        args: [
            archangel,
            deployer,
            fee,
        ],
        log: true,
    });
};

module.exports.tags = ['ATrevi'];