// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "./interfaces/IERC20Permit.sol";

contract Ballot {
    IERC20Permit public immutable daoToken;
    address public immutable chairPerson;

    bool private _acceptingProjects = false;
    bool private _pollOpened = false;

    uint256 private _pollId = 1;
    uint256 private _projectId = 1;

    mapping(uint256 => mapping(uint256 => Project)) private _pollHistory;
    mapping(uint256 => uint256[]) private _tracker;
    mapping(uint256 => uint256) _pollWinner;

    modifier onlyOwner() {
        require(msg.sender == chairPerson, "Not owner");
        _;
    }

    event NewProjectSubmitted(uint256 projectId, bytes32 title, address owner);
    event VoteSubmitted(address voter, uint256 projectId);

    struct Project {
        uint256 id;
        bytes32 title;
        uint256 voteCount;
    }

    constructor(address erc20Token) {
        daoToken = IERC20Permit(erc20Token);
        chairPerson = msg.sender;
    }

    // change the status of the _acceptingProjects
    function setProjectStatus() external onlyOwner() {
        if (_acceptingProjects == false) {
            _acceptingProjects = true;
        } else {
            _acceptingProjects = false;
        }
    }

    // change the status of the acceptingroposal
    function setPollStatus() external onlyOwner {
        if (_pollOpened == false) {
            _pollOpened = true;
        } else {
            _pollOpened = false;
            _pollId = _pollId + 1;
        }
    }

    function isAcceptingProjects() external view returns (bool) {
        return _acceptingProjects;
    }

    function isPollOpened() external view returns (bool) {
        return _pollOpened;
    }

    function currentPollId() external view returns (uint256) {
        return _pollId;
    }

    function currentProjectId() external view returns (uint256) {
        return _projectId;
    }

    // Append new project to the to history
    function submitProject(bytes32 title) external returns (uint256) {
        require(_acceptingProjects == true, "No new project allowed now");
        Project memory submission = Project({id: _projectId, title: title, voteCount: 0});

        _pollHistory[_pollId][_projectId] = submission;

        _tracker[_pollId].push(_projectId);
        emit NewProjectSubmitted(_projectId, title, msg.sender);
        _projectId = _projectId + 1;

        return _projectId - 1;
    }

    function getProjects(uint256 pollId)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory ids = _tracker[pollId];

        return (ids);
    }

    // vote a Projectn with all KOL tokens
    function vote(uint256 projectId, uint256 amountOfVotes, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(_pollOpened == true, "Poll not open");
        require(projectId <= _projectId, "Invalid project id");

        // check if the user has any token
        require(daoToken.balanceOf(msg.sender) >= amountOfVotes, "Insufficient KOL");

        daoToken.permit(msg.sender, address(this), amountOfVotes, deadline, v, r, s);
        daoToken.transferFrom(msg.sender, address(this), amountOfVotes);

        Project memory candidate = _pollHistory[_pollId][_projectId];
        candidate.voteCount = candidate.voteCount + amountOfVotes;
        _pollHistory[_pollId][projectId] = candidate;

        emit VoteSubmitted(msg.sender, projectId);
    }

    function declarePollWinner(uint256 pollId, uint256 projectId)
        external
        onlyOwner
    {
        _pollWinner[pollId] = projectId;
    }

    function getPollWinner(uint256 pollId)
        external
        view
        returns (uint256, bytes32)
    {
        uint256 winnerId = _pollWinner[pollId];
        Project memory project = _pollHistory[pollId][winnerId];
        return (project.id, project.title);
    }
}
