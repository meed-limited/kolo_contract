import dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";

const privateKey: string = process.env.PRIVATE_KEY_TEST!;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  networks: {
    main: {
      url: `${process.env.API_NODE_ETH}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 1,
    },
    goerli: {
      url: `${process.env.API_NODE_GOERLI!}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 5,
    },
    // Polygon networks
    polygon: {
      url: `${process.env.API_NODE_POLYGON}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 137,
    },
    mumbai: {
      url: `${process.env.API_NODE_POLYGON_MUMBAI}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 80001,
    },
    // BNB Chain networks
    bnb_chain: {
      url: `${process.env.API_NODE_BSC}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 56,
    },
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 97,
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY!,
  },
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

export default config;
