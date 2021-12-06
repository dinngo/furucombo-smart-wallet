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

    function owner() external view returns (address);
    
    
    // function stakingRewardsInfoByStakingToken(address token) external view returns (address, uint256, uint256);
    
}
