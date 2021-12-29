# Exit script as soon as a command fails.
# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

hardhat_port=8545
tests="$@"

cleanup() {
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
    echo "POLYGON_MAINNET_NODE:" ${POLYGON_MAINNET_NODE}
    npx hardhat node --fork ${POLYGON_MAINNET_NODE} --no-deploy >/dev/null &
    #npx hardhat node --fork ${POLYGON_MAINNET_NODE} --fork-block-number 21411286 --no-deploy >/dev/null &
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
