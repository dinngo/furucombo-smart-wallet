// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./OwnableAction.sol";

/**
 * @dev Can only be destroyed by owner. All funds are sent to the owner.
 */
abstract contract DestructibleAction is OwnableAction {
    function destroy() external {
        require(
            owner() == _msgSender(),
            "DestructibleAction: caller is not the owner"
        );
        selfdestruct(payable(owner()));
    }
}
