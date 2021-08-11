// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 *
 * This is a modified version of Ownable contract to save the owner address in a
 * specific storage slot.
 */
abstract contract Ownable is Context {
    /**
     * @dev Storage slot with the owner of the contract.
     * This is the keccak-256 hash of "ownable.owner".
     */
    // prettier-ignore
    bytes32 private constant _OWNER_SLOT = 0x8a721d7331971cd5eefcd6a2b20c226462fc25662d105424a4f69c8d550cca50;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() internal {
        address msgSender = _msgSender();
        _setOwner(msgSender);
        emit OwnershipTransferred(address(0), msgSender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address _owner) {
        bytes32 slot = _OWNER_SLOT;

        assembly {
            _owner := sload(slot)
        }
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(owner(), address(0));
        _setOwner(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        emit OwnershipTransferred(owner(), newOwner);
        _setOwner(newOwner);
    }

    /**
     * @dev Stores a new address in the owner slot.
     */
    function _setOwner(address newOwner) private {
        bytes32 slot = _OWNER_SLOT;

        assembly {
            sstore(slot, newOwner)
        }
    }
}
