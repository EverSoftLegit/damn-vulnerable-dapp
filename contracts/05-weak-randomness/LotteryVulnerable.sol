// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Lottery (VULNERABLE) — challenge 05
/// @notice Pay 1 ETH, guess a number 0-9. Guess right and win the whole pot.
contract LotteryVulnerable {
    uint256 public constant TICKET = 1 ether;
    address public lastWinner;

    constructor() payable {}

    function play(uint256 guess) external payable {
        require(msg.value == TICKET, "ticket is 1 ETH");
        // BUG: every input here is public and identical for any contract called in the same block.
        uint256 answer = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp))) % 10;
        if (guess == answer) {
            lastWinner = msg.sender;
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    receive() external payable {}
}
