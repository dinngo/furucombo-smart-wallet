// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../ActionBase.sol";
import "../../utils/DestructibleAction.sol";
import "../../utils/DelegateCallAction.sol";
import "../../utils/ErrorMsg.sol";
import "./IFurucombo.sol";

contract AFurucombo is
    ActionBase,
    DestructibleAction,
    DelegateCallAction,
    ErrorMsg
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address payable public immutable proxy;
    uint256 private constant _TOKEN_DUST = 10;

    constructor(address payable _owner, address payable _proxy)
        public
        DestructibleAction(_owner)
        DelegateCallAction()
    {
        proxy = _proxy;
    }

    /// @notice Inject tokens and execute combo.
    /// @param tokensIn The input tokens.
    /// @param amountsIn The input token amounts.
    /// @param tokensOut The output tokens.
    /// @param tos The handlers of combo.
    /// @param configs The configurations of executing cubes.
    /// @param datas The combo datas.
    /// @return The output token amounts.
    function injectAndBatchExec(
        address[] calldata tokensIn,
        uint256[] calldata amountsIn,
        address[] calldata tokensOut,
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] memory datas
    ) external payable delegateCallOnly returns (uint256[] memory) {
        // Inject and execute combo
        _inject(tokensIn, amountsIn);

        // Snapshot output token amounts
        uint256[] memory amountsOut = new uint256[](tokensOut.length);
        for (uint256 i = 0; i < tokensOut.length; i++) {
            amountsOut[i] = _getBalance(tokensOut[i]);
        }

        // Execute furucombo proxy batchExec
        try IFurucombo(proxy).batchExec(tos, configs, datas) {} catch Error(
            string memory reason
        ) {
            _revertMsg("injectAndBatchExec", reason);
        } catch {
            _revertMsg("injectAndBatchExec");
        }

        // Check no remaining input tokens to ensure updateTokens was called
        for (uint256 i = 0; i < tokensIn.length; i++) {
            if (tokensIn[i] != NATIVE_TOKEN_ADDRESS) {
                _requireMsg(
                    IERC20(tokensIn[i]).balanceOf(proxy) < _TOKEN_DUST,
                    "injectAndBatchExec",
                    "Furucombo has remaining tokens"
                );
            }
        }

        // Calculate increased output token amounts
        for (uint256 i = 0; i < tokensOut.length; i++) {
            amountsOut[i] = _getBalance(tokensOut[i]).sub(amountsOut[i]);
        }

        return amountsOut;
    }

    /// @notice Inject tokens to furucombo.
    function _inject(address[] memory tokensIn, uint256[] memory amountsIn)
        internal
    {
        _requireMsg(
            tokensIn.length == amountsIn.length,
            "_inject",
            "Input tokens and amounts length inconsistent"
        );

        for (uint256 i = 0; i < tokensIn.length; i++) {
            uint256 amount = amountsIn[i];
            if (amount > 0) {
                if (tokensIn[i] == NATIVE_TOKEN_ADDRESS) {
                    proxy.transfer(amount);
                } else {
                    IERC20(tokensIn[i]).safeTransfer(proxy, amount);
                }
            }
        }
    }
}
