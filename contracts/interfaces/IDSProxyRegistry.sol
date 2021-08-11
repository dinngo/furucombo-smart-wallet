// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IDSProxyRegistry {
    function proxies(address input) external view returns (address);
    function build() external returns (address);
    function build(address owner) external returns (address);
}
