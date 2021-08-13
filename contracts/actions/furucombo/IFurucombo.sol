// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IFurucombo {
    function batchExec(
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] memory datas
    ) external payable;
}
