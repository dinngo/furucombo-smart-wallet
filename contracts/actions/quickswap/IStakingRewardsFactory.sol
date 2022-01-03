// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

struct StakingRewardsInfo {
        address stakingRewards;
        uint256 rewardAmount;
        uint256 duration;
}

interface IStakingRewardsFactory{
    
    function stakingRewardsInfoByStakingToken(address token) external 
    view returns (StakingRewardsInfo memory);

    function notifyRewardAmount(address stakingToken) external;

    function update(address stakingToken, uint rewardAmount, uint256 rewardsDuration) external;

}
