// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IDSProxyFactory {
    function isProxy(address proxy) external view returns (bool);
    function build() external returns (address);
    function build(address owner) external returns (address);
}