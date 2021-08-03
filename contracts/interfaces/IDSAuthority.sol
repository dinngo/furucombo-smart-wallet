pragma solidity ^0.6.0;

interface IDSAuthority {
    function canCall(
        address src,
        address dst,
        bytes4 sig
    ) external view returns (bool);
}
