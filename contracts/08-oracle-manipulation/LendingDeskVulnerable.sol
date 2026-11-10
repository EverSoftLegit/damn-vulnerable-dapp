// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISpotPool {
    function spotPrice() external view returns (uint256);
}

/// @title LendingDesk (VULNERABLE) — challenge 08
/// @notice Deposit DVT as collateral, borrow dUSD up to 50% of its value.
contract LendingDeskVulnerable {
    IERC20 public immutable collateral; // DVT
    IERC20 public immutable debtToken; // dUSD
    ISpotPool public immutable pool;

    mapping(address => uint256) public collateralOf;
    mapping(address => uint256) public debtOf;

    constructor(IERC20 collateral_, IERC20 debtToken_, ISpotPool pool_) {
        collateral = collateral_;
        debtToken = debtToken_;
        pool = pool_;
    }

    function depositCollateral(uint256 amount) external {
        collateral.transferFrom(msg.sender, address(this), amount);
        collateralOf[msg.sender] += amount;
    }

    // BUG: the price comes from a single low-liquidity pool's current reserves,
    // which anyone can move within one transaction.
    function price() public view returns (uint256) {
        return pool.spotPrice();
    }

    function borrow(uint256 amount) external {
        uint256 value = (collateralOf[msg.sender] * price()) / 1e18;
        require(debtOf[msg.sender] + amount <= value / 2, "undercollateralised");
        debtOf[msg.sender] += amount;
        debtToken.transfer(msg.sender, amount);
    }
}
