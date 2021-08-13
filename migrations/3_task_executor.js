const TaskExecutor = artifacts.require('TaskExecutor');

module.exports = async function(deployer) {
  if (deployer.network === 'development') {
    return;
  }
  await deployer.deploy(TaskExecutor);
};
