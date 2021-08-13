// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IDSProxy {
    function execute(address _target, bytes calldata _data) external payable returns (bytes32 response);
    function owner() external view returns (address);
    function authority() external view returns (address);
    function setAuthority(address authority_) external;
}