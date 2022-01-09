// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import './ITalienNft.sol';

interface ITalien is ITalienNft {
	function claim(
		address _user,
		uint256 _itemId,
		uint256 _seriesId,
		bool _withAccessory
	) external returns (uint256 tokenId);

	function items(uint256 _itemId)
		external
		view
		returns (
			uint256 itemId,
			uint256 seriesId,
			uint256 likes,
			uint8 totalTraits,
			uint256 traitVariationHash,
			uint256 totalAccessoryTypes
		);
}
