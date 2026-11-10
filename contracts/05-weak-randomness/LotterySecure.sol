// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Lottery (SECURE-ER) — challenge 05
/// @notice Commit first, settle later: the random value comes from the hash of a block that
/// did not exist when the guess was locked in, so no contract can compute it at play() time.
/// NOTE: a block producer can still bias a future blockhash. Real money needs a VRF
/// (e.g. Chainlink VRF) — see docs/05-weak-randomness.md.
contract LotterySecure {
    uint256 public constant TICKET = 1 ether;
    address public lastWinner;

    struct Ticket {
        uint256 guess;
        uint256 blockNumber;
    }
    mapping(address => Ticket) public tickets;

    constructor() payable {}

    function play(uint256 guess) external payable {
        require(msg.value == TICKET, "ticket is 1 ETH");
        require(tickets[msg.sender].blockNumber == 0, "already playing");
        tickets[msg.sender] = Ticket(guess, block.number);
    }

    function settle() external {
        Ticket memory t = tickets[msg.sender];
        require(t.blockNumber != 0, "no ticket");
        require(block.number > t.blockNumber + 1, "too early");
        delete tickets[msg.sender];
        bytes32 h = blockhash(t.blockNumber + 1);
        require(h != bytes32(0), "ticket expired"); // blockhash only covers the last 256 blocks
        uint256 answer = uint256(keccak256(abi.encodePacked(h, msg.sender))) % 10;
        if (t.guess == answer) {
            lastWinner = msg.sender;
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    receive() external payable {}
}
