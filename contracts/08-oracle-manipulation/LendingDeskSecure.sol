// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPriceFeed {
    function latest() external view returns (uint256 price, uint256 updatedAt);
}

/// @title LendingDesk (SECURE) — challenge 08
/// @notice Same interface, but prices come from an aggregated feed that a single swap
/// cannot move, with a staleness check.
contract LendingDeskSecure {
    uint256 public constant MAX_AGE = 1 hours;

    IERC20 public immutable collateral;
    IERC20 public immutable debtToken;
    IPriceFeed public immutable feed;

    mapping(address => uint256) public collateralOf;
    mapping(address => uint256) public debtOf;

    constructor(IERC20 collateral_, IERC20 debtToken_, IPriceFeed feed_) {
        collateral = collateral_;
        debtToken = debtToken_;
        feed = feed_;
    }

    function depositCollateral(uint256 amount) external {
        collateral.transferFrom(msg.sender, address(this), amount);
        collateralOf[msg.sender] += amount;
    }

    function price() public view returns (uint256 p) {
        uint256 updatedAt;
        (p, updatedAt) = feed.latest();
        require(p > 0 && block.timestamp - updatedAt <= MAX_AGE, "stale price");
    }

    function borrow(uint256 amount) external {
        uint256 value = (collateralOf[msg.sender] * price()) / 1e18;
        require(debtOf[msg.sender] + amount <= value / 2, "undercollateralised");
        debtOf[msg.sender] += amount;
        debtToken.transfer(msg.sender, amount);
    }
}
