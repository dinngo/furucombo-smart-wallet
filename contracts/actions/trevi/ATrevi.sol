// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../ActionBase.sol";
import "../../utils/DestructibleAction.sol";
import "../../utils/ErrorMsg.sol";

import "../../externals/trevi/interfaces/IArchangel.sol";
import "../../externals/trevi/interfaces/IAngel.sol";
import "../../externals/trevi/interfaces/IFountain.sol";

contract ATrevi is ActionBase, DestructibleAction, ErrorMsg {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IArchangel public immutable archangel;
    address public immutable collector;
    uint256 public immutable harvestFee;
    uint256 public constant FEE_BASE = 1e4;

    constructor(
        address payable _owner,
        address _archangel,
        address _collector,
        uint256 _fee
    ) public DestructibleAction(_owner) {
        require(_fee <= FEE_BASE, "ATrevi: fee rate exceeded");
        archangel = IArchangel(_archangel);
        collector = _collector;
        harvestFee = _fee;
    }

    /// @notice Deposit token to fountain.
    /// @param token The staking token of fountain.
    /// @param amount The staking token amount.
    /// @return The output token amount.
    function deposit(address token, uint256 amount)
        external
        payable
        returns (uint256)
    {
        IFountain fountain = _getFountain(token);
        uint256 amountOut = _getBalance(address(fountain));

        _tokenApprove(token, address(fountain), amount);
        try fountain.deposit(amount) {} catch Error(string memory reason) {
            _revertMsg("deposit", reason);
        } catch {
            _revertMsg("deposit");
        }

        return _getBalance(address(fountain)).sub(amountOut);
    }

    /// @notice Withdraw token from fountain.
    /// @param token The staking token of fountain.
    /// @param amount The staking token amount.
    /// @return The output token amount.
    function withdraw(address token, uint256 amount)
        external
        payable
        returns (uint256)
    {
        IFountain fountain = _getFountain(token);
        uint256 amountOut = IERC20(token).balanceOf(address(this));

        try fountain.withdraw(amount) {} catch Error(string memory reason) {
            _revertMsg("withdraw", reason);
        } catch {
            _revertMsg("withdraw");
        }

        return _getBalance(token).sub(amountOut);
    }

    /// @notice Harvest from multiple angels and charge fee.
    /// @param token The staking token of fountain.
    /// @param angels The angels to be harvested.
    /// @param tokensOut The tokens to be returned amount.
    /// @return The token amounts.
    function harvestAngelsAndCharge(
        address token,
        IAngel[] calldata angels,
        address[] calldata tokensOut
    ) external payable returns (uint256[] memory) {
        return _harvest(token, angels, tokensOut, true);
    }

    /// @notice Harvest from multiple angels without charge fee.
    /// @param token The staking token of fountain.
    /// @param angels The angels to be harvested.
    /// @param tokensOut The tokens to be returned amount.
    /// @return The token amounts.
    function harvestAngels(
        address token,
        IAngel[] calldata angels,
        address[] calldata tokensOut
    ) external payable returns (uint256[] memory) {
        return _harvest(token, angels, tokensOut, false);
    }

    /// @notice Harvest from multiple angels.
    /// @param token The staking token of fountain.
    /// @param angels The angels to be harvested.
    /// @param tokensOut The tokens to be returned amount.
    /// @param isCharge The flag of determining charge fee or not.
    /// @return The token amounts.
    function _harvest(
        address token,
        IAngel[] calldata angels,
        address[] calldata tokensOut,
        bool isCharge
    ) internal returns (uint256[] memory) {
        // Check reward tokens length should be more than tokens length to be returned
        _requireMsg(
            angels.length >= tokensOut.length,
            "_harvest",
            "unexpected length"
        );

        IFountain fountain = _getFountain(token);

        // Snapshot output token amounts
        uint256[] memory amountsOut = new uint256[](tokensOut.length);
        for (uint256 i = 0; i < tokensOut.length; i++) {
            amountsOut[i] = _getBalance(tokensOut[i]);
        }

        for (uint256 i = 0; i < angels.length; i++) {
            if (isCharge) {
                // Get grace amount before harvest if fee charging
                address grace = angels[i].GRACE();
                uint256 amountGrace = _getBalance(grace);

                // Fountain harvest
                _fountainHarvest(fountain, angels[i]);

                // Send charging fee to collector
                amountGrace = _getBalance(grace).sub(amountGrace);
                IERC20(grace).safeTransfer(collector, fee(amountGrace));
            } else {
                // Fountain harvest
                _fountainHarvest(fountain, angels[i]);
            }
        }

        // Calculate increased output token amounts
        for (uint256 i = 0; i < tokensOut.length; i++) {
            amountsOut[i] = _getBalance(tokensOut[i]).sub(amountsOut[i]);
        }

        return amountsOut;
    }

    /// @notice fountain harvest
    /// @param angel The angel wants to harvest from.
    /// @param fountain The fountain want to harvest.`
    function _fountainHarvest(IFountain fountain, IAngel angel) internal {
        // Fountain harvest
        try fountain.harvest(address(angel)) {} catch Error(
            string memory reason
        ) {
            _revertMsg("_fountainHarvest", reason);
        } catch {
            _revertMsg("_fountainHarvest");
        }
    }

    /// @dev The fee to be charged.
    /// @param amount The amount.
    /// @return The amount to be charged.
    function fee(uint256 amount) public view returns (uint256) {
        return (amount.mul(harvestFee)).div(FEE_BASE);
    }

    /// @notice Get fountain by staking token.
    /// @return The fountain.
    function _getFountain(address token) internal view returns (IFountain) {
        IFountain fountain = IFountain(archangel.getFountain(token));
        _requireMsg(
            address(fountain) != address(0),
            "_getFountain",
            "fountain not found"
        );

        return fountain;
    }
}
