// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IERC721WithRoyalties.sol';

interface ITalienNft is IERC721WithRoyalties {
	function getCurrentTokenId() external view returns (uint256);
}