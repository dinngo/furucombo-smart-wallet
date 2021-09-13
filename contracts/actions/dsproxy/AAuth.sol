// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../../utils/DestructibleAction.sol";
import "../../utils/DelegateCallAction.sol";
import "../../externals/dapphub/DSGuard.sol";
import "../../interfaces/IDSProxy.sol";

contract AAuth is DestructibleAction, DelegateCallAction {
    /// bytes4(keccak256("execute(address,bytes)"))
    bytes4 public constant FUNCTION_SIG_EXECUTE = 0x1cff79cd;

    constructor(address payable _owner)
        public
        DestructibleAction(_owner)
        DelegateCallAction()
    {}

    function createAndSetAuth()
        external
        payable
        delegateCallOnly
        returns (DSGuard guard)
    {
        guard = new DSGuard();
        IDSProxy(address(this)).setAuthority(address(guard));
    }

    function createAndSetAuthPrePermit(address[] calldata authCallers)
        external
        payable
        delegateCallOnly
        returns (DSGuard guard)
    {
        guard = new DSGuard();
        for (uint256 i = 0; i < authCallers.length; i++) {
            guard.permit(authCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
        IDSProxy(address(this)).setAuthority(address(guard));
    }

    function permit(address[] calldata authCallers)
        external
        payable
        delegateCallOnly
    {
        DSGuard guard = DSGuard(IDSProxy(address(this)).authority());
        for (uint256 i = 0; i < authCallers.length; i++) {
            guard.permit(authCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
    }

    function forbid(address[] calldata forbidCallers)
        external
        payable
        delegateCallOnly
    {
        DSGuard guard = DSGuard(IDSProxy(address(this)).authority());
        for (uint256 i = 0; i < forbidCallers.length; i++) {
            guard.forbid(forbidCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
    }
}
