import dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";

const privateKey: string = process.env.PRIVATE_KEY!;
const alchemyApiKey: string = process.env.ALCHEMY_API_KEY!;
const etherscanApiKey: string = process.env.ETHERSCAN_API_KEY!;
const polygonApiKey: string = process.env.POLYGON_API_KEY!;
const bscApiKey: string = process.env.BSCSCAN_API_KEY!;

const config: HardhatUserConfig = {
  defaultNetwork: "bsc_testnet",

  networks: {
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [`${privateKey}`],
      chainId: 5
    },
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s3.binance.org:8545",
      accounts: [`${privateKey}`],
      chainId: 97
    },
    polygon: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/NZt5O1ADxcAmpn1iNdSuH1nPJdfqcalY`,
      accounts: [`${privateKey}`],
      chainId: 80001
    }
  },
  etherscan: {
    apiKey: bscApiKey
  },
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};

export default config;
