// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol';

interface ITalien is IERC721Upgradeable, IERC721EnumerableUpgradeable {
	function feeToken() external returns (address);

	function fontName() external returns (string memory);

	function isNumberedSvg(uint256 generationId) external returns (bool);

	function isProfileGenerationEnabled() external returns (bool);

	function fundReceiver() external returns (address);

	function generationFee() external returns (uint256);

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

	function userTotalLikes(address userAddress) external returns (uint256);

	function userLikedNFTs(address userAddress, uint256 nftId) external returns (bool);

	function thresholds(uint256 thrsholdId)
		external
		returns (
			uint256 max,
			string memory badgeName,
			string memory badgeSvg
		);

	function generateTalien() external returns (uint256 tokenId);

	function likeTalien(uint256 _tokenId) external;

	function unLikeTalien(uint256 _tokenId) external;

	function getPicture(uint256 _tokenId) external view returns (string memory pictureSvg);

	function getCurrentThresholdId() external view returns (uint256);

	function getTalienGenerationName(uint256 _tokenId) external view returns (string memory);

	function traitDetails() external view returns (string memory name);

	function traitVariationSvgs()
		external
		view
		returns (
			string memory name,
			string memory svg,
			uint256 probability
		);

	function generationNames(uint256 generationId) external view returns (string memory name);

	function maxNFTsPerGeneration(uint256 generationId) external view returns (uint256);

	function generationTraitVariations(uint256 generationId, uint256 traitId)
		external
		view
		returns (uint256 totalVariations);

	function getTotalTraits() external view returns (uint256);

	function getCurrentGeneration() external view returns (uint256);

	function getCurrentTraitVariationId() external view returns (uint256);

	function getTotalVariationsForGeneration(uint8 _traitId, uint256 _generation)
		external
		view
		returns (uint256 totalVariations);

	function getVariationsId(
		uint8 _traitId,
		uint256 _generation,
		uint256 _index
	) external view returns (uint256 variationId);

	function supportsInterface(bytes4 interfaceId) external view returns (bool);

	function royaltyInfo(uint256, uint256 _salePrice) external view returns (address, uint256);

	function baseURI() external view returns (string memory);

	function getCurrentTokenId() external view returns (uint256);

	function getVersionNumber()
		external
		pure
		returns (
			uint256,
			uint256,
			uint256
		);
}
