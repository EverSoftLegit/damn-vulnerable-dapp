// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ZapRouter (VULNERABLE) — challenge 07
/// @notice Users approve the router once, then "zap" tokens into a savings balance.
contract ZapRouterVulnerable {
    IERC20 public immutable token;
    mapping(address => uint256) public deposits;

    constructor(IERC20 token_) {
        token = token_;
    }

    /// @notice "Integration helper": deposit on behalf of someone.
    // BUG: `from` is caller-controlled. Anyone who approved this router can be drained.
    function depositFor(address from, address beneficiary, uint256 amount) external {
        token.transferFrom(from, address(this), amount);
        deposits[beneficiary] += amount;
    }

    function withdraw(uint256 amount) external {
        deposits[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
    }
}
