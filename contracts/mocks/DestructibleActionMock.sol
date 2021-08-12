// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../utils/DestructibleAction.sol";

contract DestructibleActionMock is DestructibleAction {
    constructor(address payable _owner) public DestructibleAction(_owner) {}
}
