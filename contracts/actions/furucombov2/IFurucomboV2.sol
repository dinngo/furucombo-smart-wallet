// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IFurucomboV2 {
    function batchExec(
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] memory datas,
        uint256[] calldata ruleIndexes
    ) external payable;
}
