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

    IStakingRewardsFactory public constant stakingRewardsFactory =
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

    /// @notice Stake LP token to liquidity mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @param amount The staking amount.
    function stake(address token, uint256 amount)
        external
        payable
        delegateCallOnly
    {
        IStakingRewards stakingRewards = _getStakingRewardsContract(token);

        _tokenApprove(token, address(stakingRewards), amount);
        try stakingRewards.stake(amount) {} catch Error(string memory reason) {
            _revertMsg("stake", reason);
        } catch {
            _revertMsg("stake");
        }
        _tokenApproveZero(token, address(stakingRewards));
    }

    /// @notice Harvest from liquidity mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @return The dQuick amounts.
    function getRewardAndCharge(address token)
        external
        payable
        delegateCallOnly
        returns (uint256)
    {
        uint256 reward = _getReward(token);

        // charge fee.
        uint256 fee = fee(reward);
        DQUICK.transfer(collector, fee);

        return reward.sub(fee);
    }

    /// @notice Harvest from liquidity mining pool.
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
    /// @return Amount of Quick.
    function dQuickLeave() external payable delegateCallOnly returns (uint256) {
        // dQuick amount
        uint256 dQuickAmount = DQUICK.balanceOf(address(this));
        _requireMsg(
            dQuickAmount > 0,
            "dQuickLeave",
            "dQuick amount not enough"
        );

        // Quick amount before leave
        uint256 quickAmountBefore = QUICK.balanceOf(address(this));

        // leave
        try DQUICK.leave(dQuickAmount) {} catch Error(string memory reason) {
            _revertMsg("dQuickLeave", reason);
        } catch {
            _revertMsg("dQuickLeave");
        }

        // Quick amount after leave
        uint256 quickAmountAfter = QUICK.balanceOf(address(this));

        return quickAmountAfter.sub(quickAmountBefore);
    }

    /// @notice Withdraw from liquidity mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @return lpAmount Amount of LP token.
    /// @return reward Amount of dQuick.
    function exit(address token)
        external
        payable
        delegateCallOnly
        returns (uint256 lpAmount, uint256 reward)
    {
        IStakingRewards stakingRewards = _getStakingRewardsContract(token);

        // dQuick amount before exit
        uint256 dQuickAmountBefore = DQUICK.balanceOf(address(this));

        // LP token amount before exit
        uint256 lpAmountBefore = IERC20(token).balanceOf(address(this));

        try stakingRewards.exit() {} catch Error(string memory reason) {
            _revertMsg("exit", reason);
        } catch {
            _revertMsg("exit");
        }

        // dQuick amount after exit
        uint256 dQuickAmountAfter = DQUICK.balanceOf(address(this));

        // LP token amount after exit
        uint256 lpAmountAfter = IERC20(token).balanceOf(address(this));

        return (
            lpAmountAfter.sub(lpAmountBefore),
            dQuickAmountAfter.sub(dQuickAmountBefore)
        );
    }

    /// @notice The fee to be charged.
    /// @param amount The amount.
    /// @return The amount to be charged.
    function fee(uint256 amount) public view returns (uint256) {
        return (amount.mul(harvestFee)).div(FEE_BASE);
    }

    /// @notice Get rewards(harvest) from liquidity mining pool.
    /// @param token The LP token of Quickswap pool.
    /// @return The dQuick token amounts.
    function _getReward(address token) private returns (uint256) {
        IStakingRewards stakingRewards = _getStakingRewardsContract(token);

        // dQuick amount before harvest
        uint256 dQuickAmountBefore = DQUICK.balanceOf(address(this));

        // getReward
        try stakingRewards.getReward() {} catch Error(string memory reason) {
            _revertMsg("_getReward", reason);
        } catch {
            _revertMsg("_getReward");
        }

        // dQuick amount after harvest
        uint256 dQuickAmountAfter = DQUICK.balanceOf(address(this));

        return dQuickAmountAfter.sub(dQuickAmountBefore);
    }

    /// @notice Get staking rewards contract in the LP mining page.
    /// @dev Get staking rewards contract from stakingRewardsFactory.
    /// @param token The LP token of Quickswap pool.
    /// @return The StakingRewards contract.
    function _getStakingRewardsContract(address token)
        internal
        view
        returns (IStakingRewards)
    {
        StakingRewardsInfo memory info =
            stakingRewardsFactory.stakingRewardsInfoByStakingToken(token);

        _requireMsg(
            info.stakingRewards != address(0),
            "_getStakingRewardsContract",
            "StakingRewards contract not found"
        );

        return IStakingRewards(info.stakingRewards);
    }
}
