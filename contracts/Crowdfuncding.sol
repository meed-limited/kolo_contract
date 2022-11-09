// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "./interfaces/IERC20.sol";
import './abstract/Ownable.sol';

contract Crowdfunding is Ownable {
    IERC20 public immutable usdt;

    uint256 _projectId = 1;

    // track amount donated by each donors. Reset to zero after disbursement.
    mapping(address => uint256) private _donors;

    // tracker for project submitted
    mapping(uint256 => Project) private _projects;

    // track all donors for each project
    mapping(uint256 => address[]) private _donorsTracker;

    // track total donations for each project
    mapping(uint256 => uint256) private _totalDonations;

    event NewDonationMade(uint256 projectId, uint256 amount, address owner);
    event NewProjectSubmitted(uint256 projectId, uint256 amountRequired, address accountNumber, address sender);
    event VoteSubmitted(address voter, uint256 projectId);
    // event PollWinnerAnnounced(uint256 polllId, uint256 projectId, address winner);

    struct Project {
        uint256 id;
        bytes32 title;
        address ownerAccount;
        uint256 amountRequired;
    }

    constructor(address erc20Token) {
        usdt = IERC20(erc20Token);
    }

    // Append new project to the to history
    function submitProject(bytes32 title, uint256 amountRequired, address accountNumber) external {
        Project memory project = Project({id: _projectId, title: title, ownerAccount: msg.sender, amountRequired: amountRequired});
        _projects[_projectId] = project;

        emit NewProjectSubmitted(_projectId, amountRequired, accountNumber, msg.sender);
        _projectId = _projectId + 1;
    }

    // open poll for voting
    function donate(uint256 projectId, uint256 amount) external {
        require(usdt.balanceOf(msg.sender) >= amount, "Insufficient USDT");
        require(usdt.allowance(msg.sender, address(this)) >= amount, "Low allowance");
        usdt.transferFrom(msg.sender, address(this), amount);

        _totalDonations[projectId] += amount;
        _donors[msg.sender] += amount;
        _donorsTracker[_projectId].push(msg.sender); // problem arises when a donor donate to more than one projects. Not presently tracking it per project

        emit NewDonationMade(projectId, amount, msg.sender);
    }

    function disburseFunds(uint256[] memory projectIds) external onlyOwner() {
        for (uint256 i = 0; i < projectIds.length; i++) {
            address ownerAccount = (_projects[projectIds[i]]).ownerAccount;
            uint256 amountRequired = (_projects[projectIds[i]]).amountRequired;
            uint256 totalDonation = 0;

            address[] memory donors = _donorsTracker[projectIds[i]];
            uint256[] memory amounts;
            for (uint256 j = 0; j < donors.length; j++) {
                amounts[j] = _donors[donors[j]];
                totalDonation += amounts[j];
                // usdt.transfer(donors[j], amounts[j]); // use this if batch fail
            }

            if (totalDonation < amountRequired) {
                usdt.batchTransfer(donors, amounts); // this will probably fail
            } else {
                usdt.transfer(ownerAccount, amountRequired);
            }
        }
    }
}
