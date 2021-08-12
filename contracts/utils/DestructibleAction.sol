// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./OwnableAction.sol";

/**
 * @dev Can only be destroyed by owner. All funds are sent to the owner.
 */
abstract contract DestructibleAction is OwnableAction {
    constructor(address payable _owner) internal OwnableAction(_owner) {}

    function destroy() external {
        require(
            msg.sender == actionOwner,
            "DestructibleAction: caller is not the owner"
        );
        selfdestruct(actionOwner);
    }
}
