// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./abstract/ERC20Permit.sol";
import "./abstract/Ownable.sol";

contract KoloToken is Ownable, ERC20Permit {
    constructor() ERC20Permit("Kolo Token") ERC20("Kolo Token", "KOL") {
        _mint(msg.sender, 100000000 * 10**decimals());
    }
}