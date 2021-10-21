// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol';

interface ITalien is IERC721Upgradeable, IERC721EnumerableUpgradeable {
	function taliens(uint256 talienId)
		external
		view
		returns (
			uint256 tokenId,
			uint256 generation,
			uint256 likes,
			uint8 totalTraits,
			uint256 traitVariationHash
		);
}
