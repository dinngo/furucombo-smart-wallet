# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

hardhat_port=8545

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
    npx hardhat node --fork ${POLYGON_MAINNET_NODE} --no-deploy >/dev/null &
    echo "fork latest block from POLYGON_MAINNET_NODE:" ${POLYGON_MAINNET_NODE}       
}

wait_hardhat_ready() {
    while ! hardhat_running
    do
        sleep 3
    done
    hardhat_pids=`ps aux | grep hardhat | awk '{ print $2 }'`
    echo "hardhat pids:" ${hardhat_pids}
}

echo "deploying to localhost ..."

if hardhat_running; then
    echo "Using the existing hardhat network instance"
else
    echo "Starting a new hardhat network instance"
    start_hardhat
fi

wait_hardhat_ready

npx hardhat --version

# deploy all the scripts
npx hardhat --network localhost deploy
