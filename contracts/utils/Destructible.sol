// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./Ownable.sol";

/**
 * @dev Can only be destroyed by owner. All funds are sent to the owner.
 */
abstract contract Destructible is Ownable {
    function destroy() external onlyOwner {
        selfdestruct(payable(owner()));
    }
}
