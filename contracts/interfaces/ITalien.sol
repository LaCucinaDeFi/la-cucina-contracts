// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import './ITalienNft.sol';

interface ITalien is ITalienNft {
	function claim(
		address _user,
		uint256 _galaxyItemId,
		uint256 _seriesId,
		bool _withAccessory
	) external returns (uint256 tokenId);

	function galaxyItems(uint256 _galaxyItemId)
		external
		view
		returns (
			uint256 galaxyItemId,
			uint256 seriesId,
			uint256 likes,
			uint8 totalTraits,
			uint256 traitVariationHash,
			uint256 totalAccessoryTypes
		);
}
