// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ZapRouter (SECURE) — challenge 07
contract ZapRouterSecure {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public deposits;

    constructor(IERC20 token_) {
        token = token_;
    }

    function depositFor(address from, address beneficiary, uint256 amount) external {
        require(from == msg.sender, "can only pull your own tokens");
        token.safeTransferFrom(msg.sender, address(this), amount);
        deposits[beneficiary] += amount;
    }

    function withdraw(uint256 amount) external {
        deposits[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
    }
}
