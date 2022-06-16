// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

struct StakingRewardsInfo {
    address stakingRewards;
    address rewardsTokenA;
    address rewardsTokenB;
    uint256 rewardAmountA;
    uint256 rewardAmountB;
    uint256 duration;
}

interface IStakingDualRewardsFactory{
    
    function stakingRewardsInfoByStakingToken(address token) external 
    view returns (StakingRewardsInfo memory);

    function update(address stakingToken, uint rewardAmountA, uint rewardAmountB, uint256 rewardsDuration) external;

    function notifyRewardAmounts() external;

    function notifyRewardAmount(address stakingToken) external;

    function pullExtraTokens(address token, uint256 amount) external;
}
