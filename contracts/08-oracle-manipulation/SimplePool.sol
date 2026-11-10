// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SimplePool — challenge 08
/// @notice Minimal constant-product (x*y=k) AMM, no fees. tokenA = DVT, tokenB = dUSD.
contract SimplePool {
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    uint256 public reserveA;
    uint256 public reserveB;

    constructor(IERC20 a, IERC20 b) {
        tokenA = a;
        tokenB = b;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        reserveA += amountA;
        reserveB += amountB;
    }

    /// @notice Swap `amountIn` of tokenIn for the other token.
    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut) {
        bool aToB = tokenIn == address(tokenA);
        require(aToB || tokenIn == address(tokenB), "bad token");
        (uint256 rIn, uint256 rOut) = aToB ? (reserveA, reserveB) : (reserveB, reserveA);
        amountOut = (amountIn * rOut) / (rIn + amountIn);
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        if (aToB) {
            reserveA += amountIn;
            reserveB -= amountOut;
            tokenB.transfer(msg.sender, amountOut);
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
            tokenA.transfer(msg.sender, amountOut);
        }
    }

    /// @notice Price of 1 tokenA in tokenB, 18 decimals. This is a SPOT price.
    function spotPrice() external view returns (uint256) {
        return (reserveB * 1e18) / reserveA;
    }
}
