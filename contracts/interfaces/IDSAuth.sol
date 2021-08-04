pragma solidity ^0.6.0;

interface IDSAuth {
    function owner() external view returns (address);
    function authority() external view returns (address);
    function setOwner(address owner_) external;
    function setAuthority(address authority_) external;

    function canCall(
        address src, address dst, bytes4 sig
    ) external view returns (bool);
}
