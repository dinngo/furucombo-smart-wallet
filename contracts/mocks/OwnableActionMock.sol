// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../utils/OwnableAction.sol";

contract OwnableActionMock is OwnableAction {
    constructor(address payable _owner) public OwnableAction(_owner) {}
}
