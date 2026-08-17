// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Bread (Atomic Arbitrage Router)
 * @notice High-performance 2-leg atomic arbitrage router for Base V2 pools.
 * @dev Includes explicit route validation and strict WETH enforcement.
 */
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

contract Bread {
    address public immutable owner;
    address public immutable weth;

    event ArbitrageExecuted(
        address indexed pool1,
        address indexed pool2,
        uint256 amountIn,
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

    /**
     * @notice Execute a 2-Leg Atomic Arbitrage with strict route validation
     */
    function executeArbitrage(
        address pool1,
        address pool2,
        uint256 amountIn,
        uint256 amountOut1,
        uint256 amountOut2,
        bool zeroForOne1,
        bool zeroForOne2,
        uint256 minProfit
    ) external onlyOwner returns (uint256 netProfit) {
        // 1. Strict Validation: Ensure the route logically connects WETH -> Intermediate -> WETH
        address p1t0 = IUniswapV2Pair(pool1).token0();
        address p1t1 = IUniswapV2Pair(pool1).token1();
        address p2t0 = IUniswapV2Pair(pool2).token0();
        address p2t1 = IUniswapV2Pair(pool2).token1();

        address intermediateToken;

        if (zeroForOne1) {
            require(p1t0 == weth, "ROUTE_ERR: P1_IN_NOT_WETH");
            intermediateToken = p1t1;
        } else {
            require(p1t1 == weth, "ROUTE_ERR: P1_IN_NOT_WETH");
            intermediateToken = p1t0;
        }

        if (zeroForOne2) {
            require(p2t0 == intermediateToken, "ROUTE_ERR: P2_IN_NOT_INTERMEDIATE");
            require(p2t1 == weth, "ROUTE_ERR: P2_OUT_NOT_WETH");
        } else {
            require(p2t1 == intermediateToken, "ROUTE_ERR: P2_IN_NOT_INTERMEDIATE");
            require(p2t0 == weth, "ROUTE_ERR: P2_OUT_NOT_WETH");
        }

        // 2. Initial Balance Check
        uint256 initialBalance = IERC20(weth).balanceOf(address(this));
        require(initialBalance >= amountIn, "INSUFFICIENT_INITIAL_BALANCE");

        // 3. Transfer WETH to pool1
        IERC20(weth).transfer(pool1, amountIn);

        // 4. Swap on pool1, routing intermediate token to pool2
        if (zeroForOne1) {
            IUniswapV2Pair(pool1).swap(0, amountOut1, pool2, new bytes(0));
        } else {
            IUniswapV2Pair(pool1).swap(amountOut1, 0, pool2, new bytes(0));
        }

        // 5. Swap on pool2, routing WETH back to this contract
        if (zeroForOne2) {
            IUniswapV2Pair(pool2).swap(0, amountOut2, address(this), new bytes(0));
        } else {
            IUniswapV2Pair(pool2).swap(amountOut2, 0, address(this), new bytes(0));
        }

        // 6. Atomic Profit Validation Hurdle
        uint256 finalBalance = IERC20(weth).balanceOf(address(this));
        require(finalBalance >= initialBalance + minProfit, "ARBITRAGE_NOT_PROFITABLE");
        netProfit = finalBalance - initialBalance;

        emit ArbitrageExecuted(pool1, pool2, amountIn, netProfit);
    }

    function sweepToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
            emit Sweep(token, balance);
        }
    }

    function sweepETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner.call{value: balance}("");
            require(success, "ETH_TRANSFER_FAILED");
            emit Sweep(address(0), balance);
        }
    }
}
