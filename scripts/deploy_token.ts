import hre, { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const Token = await ethers.getContractFactory("KoloToken");
  const token = await Token.deploy();
  await token.deployed();

  console.log(`Kolo token contract deploy at ${token.address}`);

  // Get Token ABI
  let abiFile = JSON.parse(fs.readFileSync("./artifacts/contracts/Token.sol/KoloToken.json", "utf8"));
  let abi = JSON.stringify(abiFile.abi);
  console.log(`ABI: ${abi}`);

  await token.deployTransaction.wait(7);

  /** VERIFICATION:
   *****************/
  await hre.run("verify:verify", {
    address: token.address,
    constructorArguments: []
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
