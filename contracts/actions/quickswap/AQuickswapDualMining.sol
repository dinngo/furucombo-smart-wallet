// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IStakingDualRewards.sol";
import "./IStakingDualRewardsFactory.sol";
import "./IDQuick.sol";
import "../ActionBase.sol";
import "../../utils/DestructibleAction.sol";
import "../../utils/DelegateCallAction.sol";
import "../../utils/ErrorMsg.sol";

contract AQuickswapDualMining is
    ActionBase,
    DestructibleAction,
    DelegateCallAction,
    ErrorMsg
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public constant quick =
        IERC20(0x831753DD7087CaC61aB5644b308642cc1c33Dc13);

    IDQuick public constant dQuick =
        IDQuick(0xf28164A485B0B2C90639E47b0f377b4a438a16B1);

    IStakingDualRewardsFactory public constant stakingDualRewardsFactory =
        IStakingDualRewardsFactory(0x9Dd12421C637689c3Fc6e661C9e2f02C2F61b3Eb);

    address public immutable collector;
    uint256 public immutable harvestFee;
    uint256 public constant FEE_BASE = 1e4;

    constructor(
        address payable _owner,
        address _collector,
        uint256 _fee
    ) public DestructibleAction(_owner) DelegateCallAction() {
        require(_fee <= FEE_BASE, "AQuickswapDualMining: fee rate exceeded");
        collector = _collector;
        harvestFee = _fee;
    }

    /// @notice Stake LP token to dual mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @param amount The staking amount.
    function stake(address token, uint256 amount)
        external
        payable
        delegateCallOnly
    {
        IStakingDualRewards stakingDualRewards =
            _getStakingDualRewardsContract(token);

        _tokenApprove(token, address(stakingDualRewards), amount);
        try stakingDualRewards.stake(amount) {} catch Error(
            string memory reason
        ) {
            _revertMsg("stake", reason);
        } catch {
            _revertMsg("stake");
        }
        _tokenApproveZero(token, address(stakingDualRewards));
    }

    /// @notice Harvest from dual mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @return The reward tokens amount.
    function getRewardAndCharge(address token)
        external
        payable
        delegateCallOnly
        returns (uint256, uint256)
    {
        IStakingDualRewards stakingDualRewards =
            _getStakingDualRewardsContract(token);

        (IERC20 rewardTokenA, IERC20 rewardTokenB) =
            _getStakingDualRewardsTokens(token);
        (uint256 rewardA, uint256 rewardB) = _getReward(token);

        // charge fee.
        uint256 feeA = fee(rewardA);
        uint256 feeB = fee(rewardB);
        rewardTokenA.safeTransfer(collector, feeA);
        rewardTokenB.safeTransfer(collector, feeB);

        emit Charged(address(stakingDualRewards), address(rewardTokenA), feeA);
        emit Charged(address(stakingDualRewards), address(rewardTokenB), feeB);

        return (rewardA.sub(feeA), rewardB.sub(feeB));
    }

    /// @notice Harvest from dual mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @return The reward tokens amount.
    function getReward(address token)
        external
        payable
        delegateCallOnly
        returns (uint256, uint256)
    {
        return _getReward(token);
    }

    /// @notice Claim back Quick.
    /// @param amount The amount of dQuick.
    /// @return Amount of Quick.
    function dQuickLeave(uint256 amount)
        external
        payable
        delegateCallOnly
        returns (uint256)
    {
        _requireMsg(amount > 0, "dQuickLeave", "zero amount");
        // Quick amount before leave
        uint256 quickAmountBefore = quick.balanceOf(address(this));

        // leave
        try dQuick.leave(amount) {} catch Error(string memory reason) {
            _revertMsg("dQuickLeave", reason);
        } catch {
            _revertMsg("dQuickLeave");
        }

        // Quick amount after leave
        uint256 quickAmountAfter = quick.balanceOf(address(this));

        return quickAmountAfter.sub(quickAmountBefore);
    }

    /// @notice Withdraw staking token and rewards from dual mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @return lpAmount Amount of LP token.
    /// @return rewardTokenAAmount Amount of reward tokenA.
    /// @return rewardTokenBAmount Amount of reward tokenB.
    function exit(address token)
        external
        payable
        delegateCallOnly
        returns (
            uint256 lpAmount,
            uint256 rewardTokenAAmount,
            uint256 rewardTokenBAmount
        )
    {
        IStakingDualRewards stakingDualRewards =
            _getStakingDualRewardsContract(token);

        (IERC20 rewardTokenA, IERC20 rewardTokenB) =
            _getStakingDualRewardsTokens(token);

        // reward token amount before exit
        uint256 rewardTokenAAmountBefore =
            rewardTokenA.balanceOf(address(this));

        uint256 rewardTokenBAmountBefore =
            rewardTokenB.balanceOf(address(this));

        // LP token amount before exit
        uint256 lpAmountBefore = IERC20(token).balanceOf(address(this));

        try stakingDualRewards.exit() {} catch Error(string memory reason) {
            _revertMsg("exit", reason);
        } catch {
            _revertMsg("exit");
        }

        // reward token amount after exit
        uint256 rewardTokenAAmountAfter = rewardTokenA.balanceOf(address(this));
        uint256 rewardTokenBAmountAfter = rewardTokenB.balanceOf(address(this));

        // LP token amount after exit
        uint256 lpAmountAfter = IERC20(token).balanceOf(address(this));

        // return
        lpAmount = lpAmountAfter.sub(lpAmountBefore);

        rewardTokenAAmount = rewardTokenAAmountAfter.sub(
            rewardTokenAAmountBefore
        );

        rewardTokenBAmount = rewardTokenBAmountAfter.sub(
            rewardTokenBAmountBefore
        );
    }

    /// @notice The fee to be charged.
    /// @param amount The amount.
    /// @return The amount to be charged.
    function fee(uint256 amount) public view returns (uint256) {
        return (amount.mul(harvestFee)).div(FEE_BASE);
    }

    function _getReward(address token) private returns (uint256, uint256) {
        IStakingDualRewards stakingDualRewards =
            _getStakingDualRewardsContract(token);

        (IERC20 rewardsTokenA, IERC20 rewardsTokenB) =
            _getStakingDualRewardsTokens(token);

        // reward token amount before harvest
        uint256 rewardsTokenAAmountBefore =
            rewardsTokenA.balanceOf(address(this));
        uint256 rewardsTokenBAmountBefore =
            rewardsTokenB.balanceOf(address(this));

        // getReward
        try stakingDualRewards.getReward() {} catch Error(
            string memory reason
        ) {
            _revertMsg("_getReward", reason);
        } catch {
            _revertMsg("_getReward");
        }

        // reward token amount after harvest
        uint256 rewardsTokenAAmountAfter =
            rewardsTokenA.balanceOf(address(this));
        uint256 rewardsTokenBAmountAfter =
            rewardsTokenB.balanceOf(address(this));

        return (
            rewardsTokenAAmountAfter.sub(rewardsTokenAAmountBefore),
            rewardsTokenBAmountAfter.sub(rewardsTokenBAmountBefore)
        );
    }

    /// @notice Get staking rewards contract in the dual mining page.
    /// @dev Get staking rewards contract from stakingDualRewardsFactory.
    /// @param token The LP token of Quickswap pool.
    /// @return The StakingDualRewards contract.
    function _getStakingDualRewardsContract(address token)
        internal
        view
        returns (IStakingDualRewards)
    {
        StakingRewardsInfo memory info =
            stakingDualRewardsFactory.stakingRewardsInfoByStakingToken(token);

        _requireMsg(
            info.stakingRewards != address(0),
            "_getStakingDualRewardsContract",
            "StakingDualRewards contract not found"
        );
        return IStakingDualRewards(info.stakingRewards);
    }

    /// @notice Get staking rewards tokens in the dual mining page.
    /// @dev Get staking rewards tokens from stakingDualRewardsFactory.
    /// @param token The LP token of Quickswap pool.
    /// @return rewardsTokenA rewardsTokenB The staking rewards tokens.
    function _getStakingDualRewardsTokens(address token)
        internal
        view
        returns (IERC20 rewardsTokenA, IERC20 rewardsTokenB)
    {
        StakingRewardsInfo memory info =
            stakingDualRewardsFactory.stakingRewardsInfoByStakingToken(token);

        _requireMsg(
            info.rewardsTokenA != address(0),
            "_getStakingDualRewardsTokens",
            "rewardsTokenA contract not found"
        );

        _requireMsg(
            info.rewardsTokenB != address(0),
            "_getStakingDualRewardsTokens",
            "rewardsTokenB contract not found"
        );

        rewardsTokenA = IERC20(info.rewardsTokenA);
        rewardsTokenB = IERC20(info.rewardsTokenB);
    }
}
