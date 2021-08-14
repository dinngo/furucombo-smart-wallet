// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../utils/DestructibleAction.sol";
import "../../interfaces/IDSProxy.sol";
import "../../utils/ErrorMsg.sol";
import "../ActionBase.sol";

contract AWallet is ActionBase, DestructibleAction, ErrorMsg {
    using SafeERC20 for IERC20;

    constructor(address payable _owner) public DestructibleAction(_owner) {}

    function withdrawTokens(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external payable returns (uint256[] memory) {
        _requireMsg(
            (tokens.length == amounts.length),
            "withdraw",
            "tokens and amounts length inconsistent"
        );

        // Get DSProxy owner as receiver
        address payable receiver =
            address(uint160(IDSProxy(address(this)).owner()));

        // Withdraw tokens to receiver
        uint256[] memory amountsOut = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = _getBalanceWithAmount(tokens[i], amounts[i]);
            if (amount > 0) {
                if (tokens[i] == NATIVE_TOKEN_ADDRESS) {
                    receiver.transfer(amount);
                } else {
                    IERC20(tokens[i]).safeTransfer(receiver, amount);
                }
                amountsOut[i] = amount;
            }
        }

        return amountsOut;
    }
}
