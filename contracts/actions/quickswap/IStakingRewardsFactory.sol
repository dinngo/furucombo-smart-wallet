// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

struct StakingRewardsInfo {
        address stakingRewards;
        uint rewardAmount;
        uint duration;
}

interface IStakingRewardsFactory{
    function stakingRewardsInfoByStakingToken(address token) external returns (StakingRewardsInfo memory);
}
