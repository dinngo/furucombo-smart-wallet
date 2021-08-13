// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/ITaskExecutor.sol";
import "./utils/DestructibleAction.sol";
import "./lib/LibParam.sol";
import "./Config.sol";

contract TaskExecutor is ITaskExecutor, Config, DestructibleAction {
    using Address for address;
    using SafeERC20 for IERC20;
    using LibParam for bytes32;

    address private immutable self;

    modifier delegateCallOnly() {
        require(self != address(this), "TaskExecutor: Delegate call only");
        _;
    }

    constructor(address payable _owner) public DestructibleAction(_owner) {
        self = address(this);
    }

    /**
     * @notice task execution function.
     * @param tos The address of action.
     * @param configs The configurations of executing actions.
     * @param datas The action datas.
     */
    function batchExec(
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] memory datas
    ) external payable override delegateCallOnly {
        _execs(tos, configs, datas);
    }

    /**
     * @notice The execution phase.
     * @param tos The address of action.
     * @param configs The configurations of executing actions.
     * @param datas The action datas.
     */
    function _execs(
        address[] memory tos,
        bytes32[] memory configs,
        bytes[] memory datas
    ) internal {
        bytes32[256] memory localStack;
        uint256 index = 0;

        require(
            tos.length == datas.length,
            "TaskExecutor: Tos and datas length inconsistent"
        );
        require(
            tos.length == configs.length,
            "TaskExecutor: Tos and configs length inconsistent"
        );

        for (uint256 i = 0; i < tos.length; i++) {
            bytes32 config = configs[i];

            if (config.isDelegateCall()) {
                // Delegate call case

                // Trim params from local stack depend on config
                _trimParams(datas[i], config, localStack, index);

                // Execute action by delegate call
                bytes memory result =
                    tos[i].functionDelegateCall(
                        datas[i],
                        "TaskExecutor: low-level delegate call failed"
                    );

                // Store return data from action to local stack
                index = _parseReturn(result, config, localStack, index);
            } else {
                // Function Call case

                // Decode eth value from data
                (uint256 ethValue, bytes memory _data) =
                    _decodeEthValue(datas[i]);

                // Trim params from local stack depend on config
                _trimParams(_data, config, localStack, index);

                // Execute action by call
                bytes memory result =
                    tos[i].functionCallWithValue(
                        _data,
                        ethValue,
                        "TaskExecutor: low-level call with value failed"
                    );

                // Store return data from action to local stack depend on config
                index = _parseReturn(result, config, localStack, index);
            }
        }
    }

    /**
     * @notice Trimming the execution parameter if needed.
     * @param data The execution data.
     * @param config The configuration.
     * @param localStack The stack the be referenced.
     * @param index Current element count of localStack.
     */
    function _trimParams(
        bytes memory data,
        bytes32 config,
        bytes32[256] memory localStack,
        uint256 index
    ) internal pure {
        if (config.isStatic()) {
            // Don't need to trim parameters if static
            return;
        }

        // Trim the execution data base on the configuration and stack content if dynamic
        // Fetch the parameter configuration from config
        (uint256[] memory refs, uint256[] memory params) = config.getParams();

        // Trim the data with the reference and parameters
        for (uint256 i = 0; i < refs.length; i++) {
            require(
                refs[i] < index,
                "TaskExecutor: Reference to out of localStack"
            );
            bytes32 ref = localStack[refs[i]];
            uint256 offset = params[i];
            uint256 base = PERCENTAGE_BASE;
            assembly {
                let loc := add(add(data, 0x20), offset)
                let m := mload(loc)
                // Adjust the value by multiplier if a dynamic parameter is not zero
                if iszero(iszero(m)) {
                    // Assert no overflow first
                    let p := mul(m, ref)
                    if iszero(eq(div(p, m), ref)) {
                        revert(0, 0)
                    } // require(p / m == ref)
                    ref := div(p, base)
                }
                mstore(loc, ref)
            }
        }
    }

    /**
     * @notice Parse the execution return data to the local stack if needed.
     * @param ret The return data.
     * @param config The configuration.
     * @param localStack The local stack to place the return values.
     * @param index The current tail.
     */
    function _parseReturn(
        bytes memory ret,
        bytes32 config,
        bytes32[256] memory localStack,
        uint256 index
    ) internal pure returns (uint256) {
        if (config.isReferenced()) {
            // If so, parse the output and place it into local stack
            uint256 num = config.getReturnNum();
            uint256 newIndex = _parse(localStack, ret, index);
            require(
                newIndex == index + num,
                "TaskExecutor: Return num and parsed return num not matched"
            );
            index = newIndex;
        }
        return index;
    }

    /**
     * @notice Parse the return data to the local stack.
     * @param localStack The local stack to place the return values.
     * @param ret The return data.
     * @param index The current tail.
     */
    function _parse(
        bytes32[256] memory localStack,
        bytes memory ret,
        uint256 index
    ) internal pure returns (uint256 newIndex) {
        uint256 len = ret.length;
        // The return value should be multiple of 32-bytes to be parsed.
        require(len % 32 == 0, "TaskExecutor: Illegal length for _parse");
        // Estimate the tail after the process.
        newIndex = index + len / 32;
        require(newIndex <= 256, "TaskExecutor: Stack overflow");
        assembly {
            let offset := shl(5, index)
            // Store the data into localStack
            for {
                let i := 0
            } lt(i, len) {
                i := add(i, 0x20)
            } {
                mstore(
                    add(localStack, add(i, offset)),
                    mload(add(add(ret, i), 0x20))
                )
            }
        }
    }

    /**
     * @notice decode eth value from the execution data.
     * @param data The execution data.
     */
    function _decodeEthValue(bytes memory data)
        internal
        pure
        returns (uint256, bytes memory)
    {
        return abi.decode(data, (uint256, bytes));
    }
}
