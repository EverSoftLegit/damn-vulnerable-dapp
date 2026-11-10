// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title RewardToken (SECURE) — challenge 11
/// @notice The minter key stays server-side (env var, never shipped to the browser), and
/// the contract limits the blast radius if that key ever leaks: a per-mint cap and a
/// per-recipient cooldown.
contract RewardTokenSecure is ERC20 {
    uint256 public constant MAX_PER_MINT = 10 ether;
    uint256 public constant COOLDOWN = 1 days;

    address public immutable minter;
    mapping(address => uint256) public lastMint;

    constructor(address minter_) ERC20("Reward", "RWD") {
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "not minter");
        require(amount <= MAX_PER_MINT, "over cap");
        require(lastMint[to] == 0 || block.timestamp >= lastMint[to] + COOLDOWN, "cooldown");
        lastMint[to] = block.timestamp;
        _mint(to, amount);
    }
}
