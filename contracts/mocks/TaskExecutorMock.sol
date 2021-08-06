// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../TaskExecutor.sol";
import "./debug/GasProfiler.sol";

contract TaskExecutorMock is TaskExecutor, GasProfiler {
    event RecordActionResult(bytes value);

    receive() external payable {}

    function execMock(address to, bytes memory data)
        external
        payable
        returns (bytes memory result)
    {
        _setBase();
        result = _exec(to, data);
        _deltaGas("Gas");
        emit RecordActionResult(result);
        return result;
    }

    function callMock(address to, bytes memory data)
        external
        payable
        returns (bytes memory)
    {
        (bool success, bytes memory result) = to.call{value: 0}(data);
        require(success, "callMock failed");

        return result;
    }
}
