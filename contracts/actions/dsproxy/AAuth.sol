// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../../externals/dapphub/DSGuard.sol";
import "../../interfaces/IDSProxy.sol";

contract AAuth {
    /// bytes4(keccak256("execute(address,bytes)"))
    bytes4 public constant FUNCTION_SIG_EXECUTE = 0x1cff79cd;
    address public immutable OWNER;

    constructor() public {
        OWNER = msg.sender;
    }

    function createAndSetAuth() external payable returns (DSGuard guard) {
        guard = new DSGuard();
        IDSProxy(address(this)).setAuthority(address(guard));
    }

    function createAndSetAuthPrePermit(address[] calldata authCallers)
        external
        payable
        returns (DSGuard guard)
    {
        guard = new DSGuard();
        for (uint256 i = 0; i < authCallers.length; i++) {
            guard.permit(authCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
        IDSProxy(address(this)).setAuthority(address(guard));
    }

    function permit(address[] calldata authCallers) external payable {
        DSGuard guard = DSGuard(IDSProxy(address(this)).authority());
        for (uint256 i = 0; i < authCallers.length; i++) {
            guard.permit(authCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
    }

    function forbid(address[] calldata forbidCallers) external payable {
        DSGuard guard = DSGuard(IDSProxy(address(this)).authority());
        for (uint256 i = 0; i < forbidCallers.length; i++) {
            guard.forbid(forbidCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
    }

    /// Destroy this action contract. Only callable by action owner.
    function kill() external {
        require(msg.sender == OWNER, "Invalid owner");
        selfdestruct(msg.sender);
    }
}
