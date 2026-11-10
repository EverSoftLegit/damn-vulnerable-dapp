// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EtherBank (VULNERABLE) — challenge 01
/// @notice Users deposit ETH and withdraw it later.
contract EtherBankVulnerable {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "nothing to withdraw");
        // BUG: external call happens BEFORE the balance is zeroed.
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] = 0;
    }
}
