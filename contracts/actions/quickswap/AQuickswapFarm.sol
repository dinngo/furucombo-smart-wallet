// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../ActionBase.sol";
import "../../utils/DestructibleAction.sol";
import "../../utils/DelegateCallAction.sol";
import "../../utils/ErrorMsg.sol";

import "../../externals/trevi/interfaces/IArchangel.sol";
import "../../externals/trevi/interfaces/IAngel.sol";
import "../../externals/trevi/interfaces/IFountain.sol";

contract AQuickswapFarm is
    ActionBase,
    DestructibleAction,
    DelegateCallAction,
    ErrorMsg
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public constant DQUICK = IERC20(0xf28164A485B0B2C90639E47b0f377b4a438a16B1);
    //StakeRewardFactory stakeRewardFactory =   

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
        uint256 userReward = _harvest(token);

        // charge fee.  reward * (harvestFee / FEE_BASE)

        return userReward - fee;
    }

    /// @notice Harvest from Quickswap farming pool
    /// @param token The LP token of Quickswap pool.
    /// @return The dQuick amounts.
    function harvest(address token)
        external
        payable
        delegateCallOnly
        returns (uint256)
    {
        return _harvest(token);
    }

    
    function dQuickWithdraw() public returns (uint256){
        // get dQuick balance
        // get Quick balance before leave

        // leave

        // get Quick balance after leave

        return after - before
    }

    /// @dev The fee to be charged.
    /// @param amount The amount.
    /// @return The amount to be charged.
    function fee(uint256 amount) public view returns (uint256) {
        return (amount.mul(harvestFee)).div(FEE_BASE);
    }

    /// @notice Harvest from Quickswap pool
    /// @param token The staking token of Quickswap pool.
    /// @return The token amounts.
    function _harvest(address token) internal returns (uint256) {
        // get StakeReward contract from staking token

        // get dQuick balance before harvest

        // harvest (getReward)

        // get dQuick balance after harvest

        return after - before;
    }

   

    /// @notice Get StakeReward by staking token.
    /// @return The StakeReward.
    function _getStakeReward(address token) internal view returns (IStakeReward) {
        // IFountain fountain = IFountain(archangel.getFountain(token));
        // _requireMsg(
        //     address(fountain) != address(0),
        //     "_getFountain",
        //     "fountain not found"
        // );

        return stakeReward;
    }
}
