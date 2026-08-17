// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SandwichExecutor
 * @notice Gas-optimized atomic execution contract for MEV sandwich and arbitrage opportunities.
 * @dev Enforces mandatory atomic profit verification. All trades revert if minimum profit is not realized.
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

interface IAerodromePair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function stable() external view returns (bool);
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract SandwichExecutor {
    address public immutable owner;
    address public immutable weth;

    event SandwichExecuted(
        address indexed pool,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 netProfit
    );

    event EmergencyWithdraw(address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _weth) {
        owner = msg.sender;
        weth = _weth;
    }

    receive() external payable {}

    /**
     * @notice Execute an atomic Uniswap V2 / Aerodrome V2 sandwich cycle
     * @param pool Address of the target liquidity pool
     * @param tokenIn Address of the token to spend (e.g. WETH)
     * @param amountIn Amount of tokenIn to swap in the frontrun leg
     * @param zeroForOne Direction of the trade in token0/token1
     * @param minProfit Minimum profit required (in tokenIn wei) to prevent reverts
     */
    function executeSandwichV2(
        address pool,
        address tokenIn,
        uint256 amountIn,
        bool zeroForOne,
        uint256 minProfit
    ) external onlyOwner returns (uint256 netProfit) {
        uint256 initialBalance = IERC20(tokenIn).balanceOf(address(this));
        require(initialBalance >= amountIn, "INSUFFICIENT_INITIAL_BALANCE");

        // 1. Transfer tokenIn to pool
        IERC20(tokenIn).transfer(pool, amountIn);

        // 2. Compute frontrun output using constant product formula
        (uint112 r0, uint112 r1, ) = IUniswapV2Pair(pool).getReserves();
        uint256 amountOut;
        if (zeroForOne) {
            uint256 amountInWithFee = amountIn * 997;
            amountOut = (amountInWithFee * uint256(r1)) / (uint256(r0) * 1000 + amountInWithFee);
            IUniswapV2Pair(pool).swap(0, amountOut, address(this), new bytes(0));
        } else {
            uint256 amountInWithFee = amountIn * 997;
            amountOut = (amountInWithFee * uint256(r0)) / (uint256(r1) * 1000 + amountInWithFee);
            IUniswapV2Pair(pool).swap(amountOut, 0, address(this), new bytes(0));
        }

        // 3. Verify balance condition & enforce atomic profit guard
        uint256 finalBalance = IERC20(tokenIn).balanceOf(address(this));
        require(finalBalance >= initialBalance + minProfit, "ATOMIC_PROFIT_HURDLE_FAILED");
        netProfit = finalBalance - initialBalance;

        emit SandwichExecuted(pool, tokenIn, amountIn, amountOut, netProfit);
    }

    /**
     * @notice Emergency sweep of any ERC20 token to the owner
     */
    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
            emit EmergencyWithdraw(token, balance);
        }
    }

    /**
     * @notice Emergency sweep of native ETH to the owner
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner.call{value: balance}("");
            require(success, "ETH_TRANSFER_FAILED");
            emit EmergencyWithdraw(address(0), balance);
        }
    }
}
