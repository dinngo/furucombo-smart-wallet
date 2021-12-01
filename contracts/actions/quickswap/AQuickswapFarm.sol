// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IStakingRewards.sol";
import "./IStakingRewardsFactory.sol";
import "./IDQuick.sol";
import "../ActionBase.sol";
import "../../utils/DestructibleAction.sol";
import "../../utils/DelegateCallAction.sol";
import "../../utils/ErrorMsg.sol";

contract AQuickswapFarm is
    ActionBase,
    DestructibleAction,
    DelegateCallAction,
    ErrorMsg
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public constant QUICK =
        IERC20(0x831753DD7087CaC61aB5644b308642cc1c33Dc13);

    IDQuick public constant DQUICK =
        IDQuick(0xf28164A485B0B2C90639E47b0f377b4a438a16B1);

    IStakingRewardsFactory stakingRewardsFactory =
        IStakingRewardsFactory(0x8aAA5e259F74c8114e0a471d9f2ADFc66Bfe09ed);

    address public immutable collector;
    uint256 public immutable harvestFee;
    uint256 public constant FEE_BASE = 1e4;

    constructor(
        address payable _owner,
        address _collector,
        uint256 _fee
    ) public DestructibleAction(_owner) DelegateCallAction() {
        require(_fee <= FEE_BASE, "AQuickswapFarm: fee rate exceeded");
        collector = _collector;
        harvestFee = _fee;
    }

    /// @notice Harvest from Quickswap farming pool
    /// @param token The LP token of Quickswap pool.
    /// @return The dQuick amounts.
    function getRewardAndCharge(address token)
        external
        payable
        delegateCallOnly
        returns (uint256)
    {
        uint256 userReward = _getReward(token);

        // charge fee.
        uint256 fee = fee(userReward);
        DQUICK.transfer(collector, fee);

        return userReward.sub(fee);
    }

    /// @notice Harvest from Quickswap farming pool
    /// @param token The LP token of Quickswap pool.
    /// @return The dQuick amounts.
    function getReward(address token)
        external
        payable
        delegateCallOnly
        returns (uint256)
    {
        return _getReward(token);
    }

    /// @notice Claim back Quick.
    /// @return Amount of Quick
    function dQuickLeave() public returns (uint256) {
        // get dQuick amount
        uint256 dQuickAmount = DQUICK.balanceOf(address(this));

        // get Quick amount before leave
        uint256 quickAmountBefore = QUICK.balanceOf(address(this));

        // leave
        DQUICK.leave(dQuickAmount);

        // get Quick amount after leave
        uint256 quickAmountAfter = QUICK.balanceOf(address(this));

        return quickAmountAfter.sub(quickAmountBefore);
    }

    /// @dev The fee to be charged.
    /// @param amount The amount.
    /// @return The amount to be charged.
    function fee(uint256 amount) public view returns (uint256) {
        return (amount.mul(harvestFee)).div(FEE_BASE);
    }

    /// @notice Get rewards(harvest) from Quickswap pool
    /// @param token The staking token of Quickswap pool.
    /// @return The dQuick token amounts.
    function _getReward(address token) internal returns (uint256) {
        // get StakeReward contract from staking token
        StakingRewardsInfo memory info =
            stakingRewardsFactory.stakingRewardsInfoByStakingToken(token);

        IStakingRewards stakingReward = IStakingRewards(info.stakingRewards);

        // get dQuick amount before harvest
        uint256 dQuickAmountBefore = DQUICK.balanceOf(address(this));

        // harvest (getReward)
        stakingReward.getReward();

        // get dQuick amount after harvest
        uint256 dQuickAmountAfter = DQUICK.balanceOf(address(this));

        return dQuickAmountAfter.sub(dQuickAmountBefore);
    }
}
