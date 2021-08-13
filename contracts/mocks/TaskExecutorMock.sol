// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../TaskExecutor.sol";
import "./debug/GasProfiler.sol";

contract TaskExecutorMock is TaskExecutor, GasProfiler {
    event RecordActionResult(bytes value);

    constructor(address payable _owner) public TaskExecutor(_owner) {}

    function execMock(address to, bytes memory data)
        external
        payable
        returns (bytes memory result)
    {
        _setBase();
        result = to.functionDelegateCall(data);
        _deltaGas("Gas");
        emit RecordActionResult(result);
    }

    function callMock(address to, bytes memory data)
        external
        payable
        returns (bytes memory result)
    {
        result = to.functionCallWithValue(data, 0);
    }
}
