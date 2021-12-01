// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IDQuick{
    function balanceOf(address account) external view returns (uint256);

    function leave(uint256 _dQuickAmount) external;

    function transfer(address recipient, uint256 amount) external returns (bool);
}
