// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title RewardToken (VULNERABLE) — challenge 11
/// @notice A "relayer" mints loyalty rewards. The contract is fine on its own;
/// the bug is WHERE the relayer key lives (see app/config.js). It also has no limits,
/// so whoever holds the key can mint without bound.
contract RewardTokenVulnerable is ERC20 {
    address public immutable minter;

    constructor(address minter_) ERC20("Reward", "RWD") {
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "not minter");
        _mint(to, amount);
    }
}
