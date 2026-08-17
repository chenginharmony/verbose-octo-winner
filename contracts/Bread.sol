// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Bread
 * @notice High-performance liquidity routing and balance protection router.
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

contract Bread {
    address public immutable owner;
    address public immutable weth;

    event BreadBaked(
        address indexed pool,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 netProfit
    );

    event Sweep(address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _weth) {
        owner = msg.sender;
        weth = _weth;
    }

    receive() external payable {}

    event DirectPayout(address indexed recipient, address indexed token, uint256 amount);

    /**
     * @notice Execute an atomic multi-hop liquidity trade cycle with Automatic Direct Payout
     */
    function bakeBread(
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

        // 2. Compute swap output using constant product formula
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

        // 3. Verify balance condition & enforce profit hurdle
        uint256 finalBalance = IERC20(tokenIn).balanceOf(address(this));
        require(finalBalance >= initialBalance + minProfit, "PROFIT_HURDLE_FAILED");
        netProfit = finalBalance - initialBalance;

        // 4. 🚀 AUTOMATIC DIRECT PAYOUT: Instantly forward 100% of profit to owner wallet
        if (netProfit > 0) {
            IERC20(tokenIn).transfer(owner, netProfit);
            emit DirectPayout(owner, tokenIn, netProfit);
        }

        emit BreadBaked(pool, tokenIn, amountIn, amountOut, netProfit);
    }

    /**
     * @notice Sweep ERC20 token to owner
     */
    function sweepToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
            emit Sweep(token, balance);
        }
    }

    /**
     * @notice Sweep native ETH to owner
     */
    function sweepETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner.call{value: balance}("");
            require(success, "ETH_TRANSFER_FAILED");
            emit Sweep(address(0), balance);
        }
    }
}
