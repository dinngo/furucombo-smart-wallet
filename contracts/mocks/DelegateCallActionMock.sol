// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../utils/DelegateCallAction.sol";

contract DelegateCallActionMock is DelegateCallAction {
    uint256 private count;

    constructor(uint256 c) public DelegateCallAction() {
        count = c;
    }

    function getCount() external payable delegateCallOnly returns (uint256) {
        count;
    }
}
