pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../external/dapphub/DSGuard.sol";
import "../../interface/IDSProxy.sol";

contract AAuth {
    /// bytes4(keccak256("execute(address,bytes)"))
    bytes4 public constant FUNCTION_SIG_EXECUTE = 0x1cff79cd;

    function createAndSetAuth() public returns (DSGuard guard) {
        guard = new DSGuard();
        IDSProxy(address(this)).setAuthority(address(guard));
    }

    function createAndSetAuthPrePermit(address[] memory authCallers)
        public
        returns (DSGuard guard)
    {
        guard = new DSGuard();
        for (uint256 i = 0; i < authCallers.length; i++) {
            guard.permit(authCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
        IDSProxy(address(this)).setAuthority(address(guard));
    }

    function permit(address[] memory authCallers) public {
        DSGuard guard = DSGuard(IDSProxy(address(this)).authority());
        for (uint256 i = 0; i < authCallers.length; i++) {
            guard.permit(authCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
    }

    function forbid(address[] memory forbidCallers) public {
        DSGuard guard = DSGuard(IDSProxy(address(this)).authority());
        for (uint256 i = 0; i < forbidCallers.length; i++) {
            guard.forbid(forbidCallers[i], address(this), FUNCTION_SIG_EXECUTE);
        }
    }
}
