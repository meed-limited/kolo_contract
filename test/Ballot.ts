import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { signERC2612Permit } from "eth-permit";
import { KoloToken, Ballot } from "../typechain-types";
import { parseBytes32String } from "ethers/lib/utils";

const TITLE = ethers.utils.formatBytes32String("First Project");
const TITLE2 = ethers.utils.formatBytes32String("Second Project");
const AMOUNT = 50;
const AMOUNT2 = 75;
const INITIAL_PROJECT_ID: number = 1;
const VOTE_AMOUNT: BigNumber = ethers.utils.parseUnits("10", 18);

describe("Ballot", function () {
  // define fixture setup
  async function deployBallotFixture() {
    const [owner, rango, joseph, paul] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("KoloToken");
    const token: KoloToken = await Token.deploy();
    await token.deployed();

    const Ballot = await ethers.getContractFactory("Ballot");
    const ballot: Ballot = await Ballot.deploy(token.address);
    await ballot.deployed();

    const totalSupply: any = await token.totalSupply();
    const name: string = await token.name();

    return { owner, rango, joseph, paul, token, ballot, name, totalSupply };
  }

  describe("Deployment", function () {
    it("should initialize token variables", async () => {
      const totalSupply: any = ethers.utils.parseUnits("100000000", 18);
      const name: string = "Kolo Token";
      const symbol: string = "KOL";

      const { owner, token } = await loadFixture(deployBallotFixture);
      expect(await token.name()).to.equal(name);
      expect(await token.symbol()).to.equal(symbol);
      expect(await token.totalSupply()).to.equal(totalSupply);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("should initialize ballot variables", async () => {
      const initialPollId: number = 1;

      const { owner, ballot, token } = await loadFixture(deployBallotFixture);

      expect(await ballot.isPollOpened()).to.equal(false);
      expect(await ballot.pollId()).to.equal(initialPollId);
      expect(await ballot.chairPerson()).to.equal(owner.address);
      expect(await ballot.daoToken()).to.equal(token.address);
    });
  });

  describe("Project and Voting", () => {
    describe("Project Submission", () => {
      it("should fail to submit if isPollOpened is true", async () => {
        const { ballot, owner, rango } = await loadFixture(deployBallotFixture);

        await expect(ballot.connect(rango).startPoll([owner.address], [0])).to.be.revertedWith("Not owner");

        await ballot.connect(owner).startPoll([owner.address], [0]);
        expect(await ballot.isPollOpened()).to.equal(true);
        await expect(ballot.connect(rango).submitProject(TITLE, AMOUNT)).to.be.revertedWith(
          "No new project allowed now"
        );
      });

      it("should submit a new Project successfully", async () => {
        const { ballot, rango } = await loadFixture(deployBallotFixture);

        expect(await ballot.isPollOpened()).to.equal(false);

        let rangoBalance = ethers.utils.formatEther(await ethers.provider.getBalance(rango.address));
        console.log(`rango balance: ${rangoBalance}`);

        await expect(await ballot.connect(rango).submitProject(TITLE, AMOUNT))
          .to.emit(ballot, "NewProjectSubmitted")
          .withArgs(INITIAL_PROJECT_ID, TITLE, AMOUNT, rango.address);

        expect(ethers.utils.parseBytes32String(TITLE)).to.equal("First Project");

        const projects = await ballot.getProjects(1);
        expect(projects.length).to.equal(2);
      });
    });

    describe("Project Vote", () => {
      it("should fail to vote", async () => {
        const { ballot, owner, rango } = await loadFixture(deployBallotFixture);

        expect(await ballot.isPollOpened()).to.equal(false);

        // Submit 2 projects
        await expect(await ballot.connect(rango).submitProject(TITLE, AMOUNT))
          .to.emit(ballot, "NewProjectSubmitted")
          .withArgs(INITIAL_PROJECT_ID, TITLE, AMOUNT, rango.address);
        await expect(await ballot.connect(owner).submitProject(TITLE2, AMOUNT2))
          .to.emit(ballot, "NewProjectSubmitted")
          .withArgs(INITIAL_PROJECT_ID + 1, TITLE2, AMOUNT2, owner.address);

        // Check that projects were submitted succesfully
        const projects = await ballot.getProjects(1);
        expect(projects.length).to.equal(3);
        expect(projects[2].id).to.equal(2);
        expect(projects[2].amountNeeded).to.equal(75);
        expect(parseBytes32String(projects[2].title)).to.equal("Second Project");
        expect(projects[2].owner).to.equal(owner.address);

        await expect(ballot.connect(owner).vote(rango.address, INITIAL_PROJECT_ID, VOTE_AMOUNT)).to.be.revertedWith(
          "Poll not open"
        );

        await ballot.startPoll([owner.address], [0]);
        await expect(ballot.connect(rango).vote(rango.address, INITIAL_PROJECT_ID, VOTE_AMOUNT)).to.be.revertedWith(
          "Not owner"
        );
      });

      it("should vote successfully", async () => {
        const { ballot, token, owner, rango, totalSupply } = await loadFixture(deployBallotFixture);
        const amount: BigNumber = ethers.utils.parseUnits("100", 18);

        await ballot.connect(rango).submitProject(TITLE, AMOUNT);
        await ballot.connect(owner).submitProject(TITLE2, AMOUNT2);

        await ballot.startPoll([owner.address], [0]);
        expect(await ballot.isPollOpened()).to.equal(true);

        expect(await token.balanceOf(rango.address)).to.equal(0);
        expect(await token.balanceOf(owner.address)).to.equal(totalSupply);

        await token.transfer(rango.address, amount);
        expect(await token.balanceOf(rango.address)).to.equal(amount);
        expect(await token.balanceOf(owner.address)).to.equal(totalSupply.toBigInt() - amount.toBigInt());

        // get rango signatures
        const deadline = 100000000000000;
        const nonce = await token.nonces(rango.address);

        const result = await signERC2612Permit(
          rango,
          token.address,
          rango.address,
          ballot.address,
          amount.toString(),
          deadline,
          parseInt(nonce.toString())
        );

        // Approve rango from owner
        await token.permit(
          rango.address,
          ballot.address,
          amount.toString(),
          result.deadline,
          result.v,
          result.r,
          result.s
        );

        // Check allowance has been set
        expect(await token.allowance(rango.address, ballot.address)).to.equal(amount.toString());

        const voteWeight = await ballot.voteWeight(rango.address);
        expect(voteWeight.allowance).to.equal(amount.toString());
        expect(voteWeight.balance).to.equal(amount.toString());

        await expect(await ballot.connect(owner).vote(rango.address, 2, amount.toString()))
          .to.emit(ballot, "VoteSubmitted")
          .withArgs(rango.address, INITIAL_PROJECT_ID + 1);

        expect(await ballot.getVoteCount(INITIAL_PROJECT_ID + 1)).to.equal(amount.toString());
      });

      it("should close poll and return winner", async () => {
        const { ballot, token, owner, rango, totalSupply } = await loadFixture(deployBallotFixture);
        const amount: BigNumber = ethers.utils.parseUnits("100", 18);

        await ballot.connect(rango).submitProject(TITLE, AMOUNT);
        await ballot.connect(owner).submitProject(TITLE2, AMOUNT2);

        await ballot.startPoll([owner.address], [0]);

        await token.connect(owner).approve(ballot.address, amount.toString());
        await expect(await ballot.connect(owner).vote(owner.address, 2, amount.toString()))
          .to.emit(ballot, "VoteSubmitted")
          .withArgs(owner.address, INITIAL_PROJECT_ID + 1);

        await expect(ballot.connect(rango).closePoll()).to.be.revertedWith("Not owner");

        const winner = await ballot.getWinner(1);
        await expect(ballot.connect(owner).closePoll()).to.emit(ballot, "PollWinnerAnnounced").withArgs(1, winner);
      });
    });
  });
});
