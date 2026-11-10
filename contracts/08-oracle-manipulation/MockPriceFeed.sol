// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Stand-in for an aggregated oracle (e.g. a Chainlink feed) on the local chain.
contract MockPriceFeed {
    address public immutable admin;
    uint256 public price; // 18 decimals
    uint256 public updatedAt;

    constructor(uint256 initialPrice) {
        admin = msg.sender;
        price = initialPrice;
        updatedAt = block.timestamp;
    }

    function setPrice(uint256 p) external {
        require(msg.sender == admin, "not admin");
        price = p;
        updatedAt = block.timestamp;
    }

    function latest() external view returns (uint256, uint256) {
        return (price, updatedAt);
    }
}
