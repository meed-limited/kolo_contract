import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { getPermitDigest, getDomainSeparator, sign } from "./helpers/signatures";

describe('Ballot', function () {
    // define fixture setup
    async function deployBallotFixture() {

        const [owner, rango, joseph, paul] = await ethers.getSigners();
        console.log(`owner address ${owner.address}`)

        const Token = await ethers.getContractFactory('Token');
        const token = await Token.deploy();

        const Ballot = await ethers.getContractFactory('Ballot');
        const ballot = await Ballot.deploy(token.address);

        const totalSupply: any = await token.totalSupply();
        const name: string = await token.name();

        return { owner, rango, joseph, paul, token, ballot, name, totalSupply };
    }

    describe('Deployment', function () {
        it('should initialize token variables', async () => {

            const totalSupply: any = ethers.utils.parseUnits('100000000', 18);
            const name: string = 'Kolo Token';
            const symbol: string = 'KOL';

            const { owner, token } = await loadFixture(deployBallotFixture);
            expect(await token.name()).to.equal(name);
            expect(await token.symbol()).to.equal(symbol);
            expect(await token.totalSupply()).to.equal(totalSupply);
            expect(await token.owner()).to.equal(owner.address);
        });

        it('should initialize ballot variables', async () => {
            const initialPollId: number = 1;
            const initialProjectId: number = 1;
            
            const { owner, ballot, token } = await loadFixture(deployBallotFixture);
            
            expect(await ballot.isAcceptingProjects()).to.equal(false);
            expect(await ballot.isPollOpened()).to.equal(false);
            expect(await ballot.currentPollId()).to.equal(initialPollId);
            expect(await ballot.currentProjectId()).to.equal(initialProjectId);
            expect(await ballot.chairPerson()).to.equal(owner.address);
            expect(await ballot.daoToken()).to.equal(token.address);
        });

        it('should fail if the acceptingProjects is false', async () => {
            const topic = ethers.utils.formatBytes32String('First Project');

            const { ballot, rango } = await loadFixture(deployBallotFixture);
            await expect(ballot.connect(rango).submitProject(topic)).to.be.revertedWith('No new project allowed now');
        });
    });

    describe('Project and Voting', () => {
        describe('Project Submission', () => {
            it('should fail to submit by a person who is not owner', async () => {
                const initialPollId: number = 1;
                const initialProjectId: number = 1;

                const { ballot, rango } = await loadFixture(deployBallotFixture);
                
                const topic = ethers.utils.formatBytes32String('First Project');
                await expect(ballot.connect(rango).submitProject(topic)).to.be.revertedWith('No new project allowed now');
                expect(await ballot.currentPollId()).to.equal(initialProjectId);
            });

            it('should submit a new Project', async () => {
                const initialProjectId: number = 1;
                const topic = ethers.utils.formatBytes32String('First Project');

                const { token, name, totalSupply, ballot, owner, rango } = await loadFixture(deployBallotFixture);

                await ballot.setProjectStatus();
                expect(await ballot.isAcceptingProjects()).to.equal(true);

                // get the projectId from events for API request
                // const projectId = await ballot.submitProject(topic);
                // console.log(`projectId: ${JSON.stringify(projectId)}`);

                let rangoBalance = ethers.utils.formatEther(await ethers.provider.getBalance(rango.address));
                console.log(`rango balance: ${rangoBalance}`);

                await expect(await ballot.connect(rango).submitProject(topic))
                    .to.emit(ballot, 'NewProjectSubmitted')
                    .withArgs(initialProjectId, topic, rango.address);
                
                expect(await ballot.currentProjectId()).to.equal(2);

                const amountOfTokensToVote: any = ethers.utils.parseUnits('10', 18);
                const deadline: any = ethers.constants.MaxUint256;

                //

                expect(await token.balanceOf(rango.address)).to.equal(0);
                expect(await token.balanceOf(owner.address)).to.equal(totalSupply);

                const amount: any = ethers.utils.parseUnits('100', 18);
                await token.transfer(rango.address, amount);
                expect(await token.balanceOf(rango.address)).to.equal(amount);
                // expect(await token.balanceOf(owner.address)).to.equal(totalSupply - amount);

                // get rango signatures
                const { v, r, s }: any = await getPermitSignature(rango, token, ballot.address, amountOfTokensToVote, deadline );

                console.log('Balance BEFORE Signature by Rango')
                rangoBalance = ethers.utils.formatEther(await ethers.provider.getBalance(rango.address));
                let balanceBefore = rangoBalance;
                let ownerBalance = ethers.utils.formatEther(await ethers.provider.getBalance(owner.address));
                let rangoKOL = ethers.utils.formatEther(await token.balanceOf(rango.address));
                let ownerKOL = ethers.utils.formatEther(await token.balanceOf(owner.address));
                console.log(`Rango - ETH balance: ${rangoBalance}, KOL balance: ${rangoKOL}`);
                console.log(`Owner - ETH balance: ${ownerBalance}, KOL balance: ${ownerKOL}`);

                await expect(ballot.vote(rango.address, initialProjectId, amountOfTokensToVote))
                    .to.be.revertedWith('Poll not open');

                // open poll
                await ballot.setPollStatus();
                expect(await ballot.isPollOpened()).to.equal(true);

                // owner call permit approval using rango signatures
                await token.permit(rango.address, ballot.address, amountOfTokensToVote, deadline, v, r, s);

                console.log('\nBalance AFTER Permit approval by Rango BEFORE voting by Owner');
                rangoBalance = ethers.utils.formatEther(await ethers.provider.getBalance(rango.address));
                balanceBefore = rangoBalance;
                ownerBalance = ethers.utils.formatEther(await ethers.provider.getBalance(owner.address));
                rangoKOL = ethers.utils.formatEther(await token.balanceOf(rango.address));
                ownerKOL = ethers.utils.formatEther(await token.balanceOf(owner.address));
                console.log(`Rango - ETH balance: ${rangoBalance}, KOL balance: ${rangoKOL}`);
                console.log(`Owner - ETH balance: ${ownerBalance}, KOL balance: ${ownerKOL}`);

                console.log(`Rango allowance: ${await token.allowance(rango.address, ballot.address)}`);

                await ballot.vote(rango.address, initialProjectId, amountOfTokensToVote);

                expect(await token.balanceOf(ballot.address)).to.equal(amountOfTokensToVote);

                console.log('\nBalance AFTER Owner submit vote for Rango')
                rangoBalance = ethers.utils.formatEther(await ethers.provider.getBalance(rango.address));
                ownerBalance = ethers.utils.formatEther(await ethers.provider.getBalance(owner.address));
                rangoKOL = ethers.utils.formatEther(await token.balanceOf(rango.address));
                ownerKOL = ethers.utils.formatEther(await token.balanceOf(owner.address));
                console.log(`Rango - ETH balance: ${rangoBalance}, KOL balance: ${rangoKOL}`);
                console.log(`Owner - ETH balance: ${ownerBalance}, KOL balance: ${ownerKOL}`);

                expect(ethers.utils.formatEther(await ethers.provider.getBalance(rango.address))).to.equal(balanceBefore);

            });
        });
    });

    async function getPermitSignature(signer: any, token: any, spender: string, value: number, deadline: number): Promise<any> {

        const [nonce, name, version, chainId] = await Promise.all([
          token.nonces(signer.address),
          token.name(),
          "1",
          signer.getChainId(),
        ])

        const rango_PK = Buffer.from("59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", "hex");

        // Create the approval request
        const approve = {
            owner: signer.address,
            spender: spender,
            value: value,
        };

        // Get the EIP712 digest
        const digest = getPermitDigest(name, token.address, chainId, approve, nonce, deadline);

        // Sign it
        // NOTE: we don't want the message to be hashed again internally, so we sign manually
        const { v, r, s } = sign(digest, rango_PK);
      
        return { v, r, s };
      }
});