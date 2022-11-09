// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "./interfaces/IERC20Permit.sol";

contract Ballot {
    IERC20Permit public immutable daoToken;
    address public immutable chairPerson;

    bool private _acceptingProjects = true;
    bool private _pollOpened = false;

    uint256 private _pollId = 1;
    uint256 private _projectId = 1;

    mapping(uint256 => mapping(uint256 => Project)) private _pollHistory;
    mapping(uint256 => uint256[]) private _tracker;

    modifier onlyOwner() {
        require(msg.sender == chairPerson, "Not owner");
        _;
    }

    event NewProjectSubmitted(uint256 projectId, bytes32 title, address owner);
    event VoteSubmitted(address voter, uint256 projectId);
    event PollWinnerAnnounced(uint256 polllId, uint256 projectId, address winner);

    struct Project {
        uint256 id;
        bytes32 title;
        address owner;
        uint256 voteCount;
    }

    constructor(address erc20Token) {
        daoToken = IERC20Permit(erc20Token);
        chairPerson = msg.sender;
    }

    // open poll for voting
    function startPoll(address[] memory bakers, uint256[] memory amounts) external onlyOwner() {
        _acceptingProjects = false; // stop accepting new projects
        _pollOpened = true; // start allowing me poll
        daoToken.batchTransfer(bakers, amounts);
    }

    // close poll and make payment
    function closePoll() external onlyOwner() {
        _acceptingProjects = true; // start accepting new proposals immediately
        _pollOpened = false; // stop voting
        (uint256 projectId, address winner) = getPollWinner(_pollId);// declare winner of last poll
        emit PollWinnerAnnounced(_pollId, projectId, winner);
        // make payment to winner ofchain and record onchain
        _pollId = _pollId + 1; // increment poll id

    }

/*
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
*/

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
        Project memory submission = Project({id: _projectId, title: title, owner: msg.sender, voteCount: 0});

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

    function voteWeight(address sender) external view returns (uint256 balance, uint256 allowance) {
        balance = daoToken.balanceOf(sender);
        allowance = daoToken.allowance(sender, address(this));
    }

    // vote a Projectn with all KOL tokens
    function vote(address sender, uint256 projectId, uint256 amountOfVotes) external {
        require(_pollOpened == true, "Poll not open");
        require(projectId <= _projectId, "Invalid project id");

        // check if the user has any token
        require(daoToken.balanceOf(sender) >= amountOfVotes, "Insufficient KOL");
        require(daoToken.allowance(sender, address(this)) >= amountOfVotes, "Insufficient allowance");

        // daoToken.permit(sender, address(this), amountOfVotes, deadline, v, r, s);
        daoToken.transferFrom(sender, address(this), amountOfVotes);

        Project memory candidate = _pollHistory[_pollId][_projectId];
        candidate.voteCount = candidate.voteCount + amountOfVotes;
        _pollHistory[_pollId][projectId] = candidate;

        emit VoteSubmitted(msg.sender, projectId);
    }

    function getPollWinner(uint256 pollId)
        internal
        view returns(uint256, address)
    {
        uint256[] memory projectIds = _tracker[pollId];

        uint256 winnerProjectId = 0;
        address winnerAddress;
        uint256 totalVotes = 0;
        for (uint256 i = 0; i < projectIds.length; i++) {
            if ((_pollHistory[_pollId][projectIds[i]]).voteCount > totalVotes) {
                totalVotes = (_pollHistory[_pollId][projectIds[i]]).voteCount;
                winnerAddress = (_pollHistory[_pollId][projectIds[i]]).owner;
                winnerProjectId = projectIds[i];
            }
        }
        return (winnerProjectId, winnerAddress);
    }

    function getPollResult(uint256 pollId) external view returns (uint256[] memory, uint256[] memory) {
        uint256[] memory projectIds = _tracker[pollId];

        uint256[] memory results;
        for (uint256 i = 0; i < projectIds.length; i++) {
            results[i] = (_pollHistory[_pollId][projectIds[i]]).voteCount;
        }

        return (projectIds, results);
    }

    function retrieveVotedTokens() external onlyOwner() {
        daoToken.transfer(chairPerson, daoToken.balanceOf(address(this)));
    }
}
