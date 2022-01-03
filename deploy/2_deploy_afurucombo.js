const proxy = '0x78B95131bC21eC73DF5158CF7A018Ad7bADa5561'; // replace it depend on your env

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log("deployer:" + deployer);
    await deploy('AFurucombo', {
        from: deployer,
        args: [
            deployer,
            proxy,
        ],
        log: true,
    });
};