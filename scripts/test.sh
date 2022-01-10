#!/bin/bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

hardhat_port=8545

# get args with count nums
op=${@: 1:1}
tests=${@: 2:$#}

# magic block num for ensuring all test cases should pass before any dev changes
block_num='21411286'

cleanup() {
    # kill hardhat instances run by this script
    if [[ ${need_to_clean} != 1 ]]; then
        exit 0
    fi

    for hardhat_pid in ${hardhat_pids}
    do
        # kill the hardhat instance that we started (if we started one and if it's still running).
        if [ -n "$hardhat_pid" ] && ps -p ${hardhat_pid} > /dev/null; then
            kill -9 ${hardhat_pid}
            echo "killed hardhat" ${hardhat_pid}
        fi
    done
}

hardhat_running() {
    nc -z localhost "$hardhat_port"
}

start_hardhat() {
    # latestblock is for testing on the latest block status
    # setblock is for testing on a specific block number for narrowing dev bugs down to revised parts (excluding blockchain status)
    if [[ ${op} = 'latestblock' ]]; then
        npx hardhat node --fork ${POLYGON_MAINNET_NODE} --no-deploy >/dev/null &
        echo "fork latest block from POLYGON_MAINNET_NODE:" ${POLYGON_MAINNET_NODE}
    elif [[ ${op} = 'setblock' ]]; then
        npx hardhat node --fork ${POLYGON_MAINNET_NODE} --fork-block-number $block_num --no-deploy >/dev/null &
        echo "fork block" ${block_num} "from POLYGON_MAINNET_NODE:" ${POLYGON_MAINNET_NODE}
    else
        echo "exit due to unkown op:" ${op}
        exit 1
    fi
    need_to_clean=1
    echo "no deployment script will be executed"
}

wait_hardhat_ready() {
    while ! hardhat_running
    do
        sleep 3
    done
    hardhat_pids=`ps aux | grep hardhat | awk '{ print $2 }'`
    echo "hardhat pids:" ${hardhat_pids}
}

echo "running tests:" ${tests}

if hardhat_running; then
    echo "Using the existing hardhat network instance"
else
    echo "Starting a new hardhat network instance"
    start_hardhat
fi

wait_hardhat_ready

npx hardhat --version

# Execute rest test files with suffix `.test.js`
npx hardhat --network localhost test $tests
