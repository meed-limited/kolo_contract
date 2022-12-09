// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

// import "hardhat/console.sol";
import "./interfaces/IERC20Permit.sol";
import "./interfaces/IERC20.sol";
import "./utils/SafeERC20.sol";
import "./abstract/Ownable.sol";

contract Ballot is Ownable {
    using SafeERC20 for IERC20Permit;

    /* Storage:
     ************/

    IERC20Permit public immutable daoToken;

    IERC20 private immutable USDC =
        IERC20(0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d);
    IERC20 private immutable wETH =
        IERC20(0x2170Ed0880ac9A755fd29B2688956BD959F933F8);

    bool public isPollOpened = false; // false = submit, true = vote;
    uint256 public pollId = 1;

    struct Project {
        uint256 id;
        uint256 amountNeeded;
        bytes32 title;
        address owner;
    }

    mapping(uint256 => mapping(uint256 => Project)) private _specificProject; // map Project Struct per projectId per pollId
    mapping(uint256 => Project[]) private _projectsPerPoll; // map all projects per pollId
    mapping(uint256 => mapping(uint256 => uint256)) private _votesPerProject; // map vote count per pollId per projectId

    /* Events:
     **********/

    event NewProjectSubmitted(
        uint256 projectId,
        bytes32 title,
        uint256 amountNeeded,
        address owner
    );
    event VoteSubmitted(address voter, uint256 projectId);
    event PollWinnerAnnounced(uint256 polllId, Project winner);

    constructor(address erc20Token) {
        daoToken = IERC20Permit(erc20Token);
        _projectsPerPoll[pollId].push();
    }

    /* Write Functions:
     *******************/

    /**
     * @notice Append new project to the to history
     * @param _title Project title stored as bytes32
     * @param _amount Amount needed to fund the project
     */
    function submitProject(bytes32 _title, uint256 _amount) external {
        require(!isPollOpened, "No new project allowed now");

        uint256 _projectId = _projectsPerPoll[pollId].length;

        Project memory submission = Project({
            id: _projectId,
            title: _title,
            owner: msg.sender,
            amountNeeded: _amount
        });

        _specificProject[pollId][_projectId] = submission;
        _projectsPerPoll[pollId].push(submission);
        _votesPerProject[pollId][_projectId] = 0;
        emit NewProjectSubmitted(_projectId, _title, _amount, msg.sender);
    }

    /* View:
     *********/

    function voteWeight(address sender)
        external
        view
        returns (uint256 balance, uint256 allowance)
    {
        balance = daoToken.balanceOf(sender);
        allowance = daoToken.allowance(sender, address(this));
    }

    /**
     * @notice Return all projects submitted per poll Id
     * @param _pollId Specific poll id wanted
     */
    function getProjects(uint256 _pollId)
        external
        view
        returns (Project[] memory)
    {
        return _projectsPerPoll[_pollId];
    }

    /**
     * @notice Return the vote count for a specific project
     * @param projectId Specific project id wanted
     */
    function getVoteCount(uint256 projectId) external view returns (uint256) {
        return _votesPerProject[pollId][projectId];
    }

    /**
     * @notice Return the winner for a given pollId
     * Note: !!! Winner may ne be definitive on current poll !!!
     * @param _pollId Specific poll id wanted
     */
    function getWinner(uint256 _pollId) external view returns (Project memory) {
        require(_pollId <= pollId && _pollId != 0, "_pollId invalid");

        Project[] memory projects = _projectsPerPoll[_pollId];
        Project memory winner = projects[1];

        if (projects.length > 2) {
            uint256 prevVotes = this.getVoteCount(projects[1].id);

            for (uint256 i = 2; i < projects.length; i++) {
                uint256 currentVotes = this.getVoteCount(projects[i].id);

                if (currentVotes > prevVotes) {
                    winner = projects[i];
                    prevVotes = currentVotes;
                }
            }
        }
        return winner;
    }

    /* Restricted:
     ****************/

    /**
     * @notice Open poll for voting
     * @param bakers Array of addresses, to distribute off-chain token won to voters
     * @param amounts memory Amount of KOL tokens won per addresses
     * @dev bakers & amounts must have the same length
     */
    function startPoll(address[] memory bakers, uint256[] memory amounts)
        external
        onlyOwner
    {
        require(bakers.length == amounts.length, "Array don't match");

        isPollOpened = true; // stop accepting new projects
        bool result = daoToken.batchTransfer(bakers, amounts);
        require(result, "Error in batchTransfer");
    }

    /**
     * @notice Close poll and make payment
     */
    function closePoll() external onlyOwner {
        isPollOpened = false; // start accepting new projects

        if (_projectsPerPoll[pollId].length > 1) {
            Project memory winner = this.getWinner(pollId); // declare winner of last poll
            retrieveVotedTokens();

            emit PollWinnerAnnounced(pollId, winner);
            // @ToDo: Implement on-chain payment to winner
            pollId += 1;
            _projectsPerPoll[pollId].push(); //Push once to avoid <projectId == 0>
        }
    }

    /**
     * @notice Vote for a Project according to KOL tokens sent
     * Vote is restricted: voters only send a signed approval so the vote function stays free
     * @param sender Voter's address
     * @param projectId Project Id the voter is voting for
     * @param amountOfVotes Amount of KOL tokens the voter is allowing to the project
     */
    function vote(
        address sender,
        uint256 projectId,
        uint256 amountOfVotes
    ) external onlyOwner {
        require(isPollOpened, "Poll not open");
        require(
            projectId <= _projectsPerPoll[pollId].length && projectId != 0,
            "Invalid project id"
        );

        // check if the user has any token
        require(
            daoToken.balanceOf(sender) >= amountOfVotes,
            "Insufficient KOL"
        );
        require(
            daoToken.allowance(sender, address(this)) >= amountOfVotes,
            "Insufficient allowance"
        );

        // daoToken.permit(sender, address(this), amountOfVotes, deadline, v, r, s); // @ToDo: will be implemented later
        daoToken.safeTransferFrom(sender, address(this), amountOfVotes);
        _votesPerProject[pollId][projectId] += amountOfVotes;

        emit VoteSubmitted(sender, projectId);
    }

    /* Internal:
     *************/

    function retrieveVotedTokens() private {
        daoToken.safeTransfer(owner(), daoToken.balanceOf(address(this)));
    }
}
