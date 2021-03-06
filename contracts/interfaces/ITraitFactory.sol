pragma solidity ^0.8.0;

interface ITraitFactory {
	function items(uint256 _itemId) external view returns (string memory name);

	function seriesDetails(uint256 _itemId, uint256 _seriesId)
		external
		view
		returns (
			uint256 itemId,
			uint256 seriesId,
			string memory name,
			uint256 maxNfts,
			uint256 totalNftsMinted,
			bool isNumberedNFT,
			uint8 totalTraits
		);

	function traitDetails(uint256 _traitId)
		external
		view
		returns (
			uint256 itemId,
			uint256 seriesId,
			string memory name
		);

	function traitVariations(uint256 _traitVariationId)
		external
		view
		returns (
			uint256 itemId,
			uint256 seriesId,
			uint256 traitId,
			string memory name,
			string memory svg,
			uint256 probability
		);

	function currentSeries(uint256 _itemId) external view returns (uint256 _currentSeriesId);

	function getCurrentItemId() external view returns (uint256);

	function getCurrentTraitId() external view returns (uint256);

	function getTotalVariationsForTrait(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _traitId
	) external view returns (uint256 totalVariations);

	function getSeriesTraitId(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _index
	) external view returns (uint256 traitId);

	function getVariationsId(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _traitId,
		uint256 _index
	) external view returns (uint256 variationId);

	function getCurrentTraitVariationId() external view returns (uint256);

	function getCurrentThresholdId() external view returns (uint256);

	function updateTotalNftsMinted(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _amount
	) external;

	function isNftGenerationEnabled(uint256 _itemId, uint256 _seriesId) external view returns (bool);

	function fontName() external view returns (string memory);

	function thresholds(uint256 _thresholdId)
		external
		view
		returns (
			uint256 max,
			string memory badgeName,
			string memory badgeSvg
		);

	function getSvgNumber(uint256 _tokenId) external view returns (string memory svgNumber);

	function getSvgBadge(uint256 _totalLikes) external view returns (string memory badge);

	function getSvgLikes(uint256 _totalLikes) external view returns (string memory svgLikes);

	function generationFeeWithAccessory() external view returns (uint256 generationFee);

	function generationFeeWithoutAccessory() external view returns (uint256 generationFee);

	function getTraitVariationHash(uint256 _itemId, uint256 _seriesId)
		external
		returns (uint256 traitVariationHash, uint256 totalTraits);
}
