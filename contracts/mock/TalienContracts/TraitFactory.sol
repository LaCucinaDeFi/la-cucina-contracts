// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '../../interfaces/IVersionedContract.sol';
import '../../library/LaCucinaUtils.sol';

contract TraitFactory is
	Initializable,
	ContextUpgradeable,
	AccessControlEnumerableUpgradeable,
	IVersionedContract
{
	using CountersUpgradeable for CountersUpgradeable.Counter;
	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
	*/
	struct Item {
		string name;
	}
	struct Series {
		uint256 itemId;
		uint256 seriesId;
		string name;
		uint256 maxNfts;
		uint256 totalNftsMinted;
		bool isNumberedNFT;
		uint8 totalTraits;
	}
	struct TraitDetail {
		uint256 itemId;
		uint256 seriesId;
		string name;
	}
	struct TraitVariation {
		uint256 itemId;
		uint256 seriesId;
		uint256 traitId;
		string name;
		string svg;
		uint256 probability;
	}
	struct ThresholdDetail {
		uint256 max;
		string badgeName;
		string badgeSvg;
	}
	/*
   	=======================================================================
   	======================== Constants ====================================
   	=======================================================================
 	*/
	bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');
	bytes32 public constant UPDATOR_ROLE = keccak256('UPDATOR_ROLE');
	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	uint256 nonce;
	CountersUpgradeable.Counter internal itemCounter;
	CountersUpgradeable.Counter internal traitCounter;
	CountersUpgradeable.Counter internal traitVariationCounter;
	CountersUpgradeable.Counter internal thresholdCounter;
	/*
   	=======================================================================
   	======================== Public Variables =============================
   	=======================================================================
 	*/
	string public fontName;
	/// @notice price for generating new item with accessory
	uint256 public generationFeeWithAccessory;
	/// @notice price for generating new item without accessory
	uint256 public generationFeeWithoutAccessory;
	/// @notice itemId => Item
	mapping(uint256 => Item) public items;
	/// @notice itemId => seriesId => Series
	mapping(uint256 => mapping(uint256 => Series)) public seriesDetails;
	/// @notice traitId => TraitDetail
	mapping(uint256 => TraitDetail) public traitDetails;
	/// @notice traitVariationId => TraitVariation
	mapping(uint256 => TraitVariation) public traitVariations;
	/// @notice itemId => current seriesId
	mapping(uint256 => uint256) public currentSeries;
	/// @notice itemId => seriesId => traitIds
	mapping(uint256 => mapping(uint256 => uint256[])) public seriesTraitIds;
	/// @notice itemId => seriesId => traitId => totalVariations
	mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) public seriesTraitVariations;
	/// @notice itemId => seriesId => traitId => variationIds
	mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256[]))) public variationIds;
	/// @notice itemId => seriesID => bool
	mapping(uint256 => mapping(uint256 => bool)) public isNftGenerationEnabled;
	/// @notice thresholdId  => ThresholdDetail
	mapping(uint256 => ThresholdDetail) public thresholds;
	/// @notice itemId => item Hash => exists or not
	mapping(uint256 => mapping(bytes32 => bool)) public itemHash;

	/*
	=======================================================================
   	======================== Constructor/Initializer ======================
   	=======================================================================
 	*/
	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 */
	function initialize(
		string memory _fontName,
		uint256 _generationFeeWithAccessory,
		uint256 _generationFeeWithoutAccessory
	) external virtual initializer {
		__Context_init_unchained();
		__AccessControl_init_unchained();
		__AccessControlEnumerable_init_unchained();
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
		fontName = _fontName;
		generationFeeWithAccessory = _generationFeeWithAccessory;
		generationFeeWithoutAccessory = _generationFeeWithoutAccessory;
	}

	/*
   	=======================================================================
   	======================== Events =======================================
   	=======================================================================
 	*/
	event ItemAdded(uint256 itemId);
	event SeriesUpdated(uint256 itemId, uint256 seriesId);
	event TraitAdded(uint256 traitId);
	event TraitVariationAdded(uint256 traitVariationId);
	event TraitVariationUpdated(uint256 traitVariationId);

	/* 
	 =======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/
	modifier onlyOperator() {
		require(hasRole(OPERATOR_ROLE, _msgSender()), 'TraitFactory: ONLY_OPERATOR_CAN_CALL');
		_;
	}
	modifier onlyUpdator() {
		require(hasRole(UPDATOR_ROLE, _msgSender()), 'TraitFactory: ONLY_UPDATOR_CAN_CALL');
		_;
	}
	modifier onlyValidItemId(uint256 _itemId) {
		require(_itemId > 0 && _itemId <= itemCounter.current(), 'TraitFactory: INVALID_ITEM_ID');
		_;
	}
	modifier onlyValidseriesId(uint256 _itemId, uint256 _series) {
		require(_series > 0 && _series <= currentSeries[_itemId], 'TraitFactory: INVALID_SERIES_ID');
		_;
	}
	modifier onlyValidTraitId(uint256 _traitId) {
		require(_traitId > 0 && _traitId <= traitCounter.current(), 'TraitFactory: INVALID_TRAIT_ID');
		_;
	}
	modifier onlyValidName(string memory _name) {
		require(bytes(_name).length > 0, 'TraitFactory: INVALID_NAME');
		_;
	}

	/*
   	=======================================================================
   	======================== Public Methods ===============================
   	=======================================================================
 	*/

	/**
	 * @notice This method allows operator to add the item
	 * @param _itemName - indicates the name of the item. ex. Talien
	 * @return itemId - indicates the id of newly added item
	 */
	function addItem(string memory _itemName)
		external
		virtual
		onlyOperator
		onlyValidName(_itemName)
		returns (uint256 itemId)
	{
		itemCounter.increment();
		itemId = itemCounter.current();
		items[itemId].name = _itemName;
		emit ItemAdded(itemId);
	}

	/**
	 * @notice This method allows operator to add the series for the item to allow minting of nfts
	 * @param _itemId - indicates the id of item for which series to add
	 * @param _maxNFTS - indicates the maximum number of nfts to mint in the series
	 * @param _seriesName - indicates the name of the series
	 * @param _isNumbered - indicates the whether the series nfts will be numbered or not
	 */
	function updateSeries(
		uint256 _itemId,
		uint256 _maxNFTS,
		string memory _seriesName,
		bool _isNumbered
	) external virtual onlyOperator onlyValidItemId(_itemId) onlyValidName(_seriesName) {
		require(_maxNFTS > 0, 'TratiFactory: INSUFFICIENT_NFTS');
		//increament series counter for item
		currentSeries[_itemId] += 1;
		//get current series id
		uint256 seriesId = currentSeries[_itemId];
		seriesDetails[_itemId][seriesId].itemId = _itemId;
		seriesDetails[_itemId][seriesId].seriesId = seriesId;
		seriesDetails[_itemId][seriesId].name = _seriesName;
		seriesDetails[_itemId][seriesId].maxNfts = _maxNFTS;
		seriesDetails[_itemId][seriesId].isNumberedNFT = _isNumbered;
		emit SeriesUpdated(_itemId, seriesId);
	}

	/**
	 * @notice This method allows operator to add the traits for the series of particular item.
	 * @param _itemId - indicates the item id
	 * @param _seriesId - indicates the series of item for which trait to add
	 * @param _traitName - indicates the trait name
	 * @return traitId - indicates the unique trait id.
	 */
	function addTrait(
		uint256 _itemId,
		uint256 _seriesId,
		string memory _traitName
	)
		external
		virtual
		onlyOperator
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
		onlyValidName(_traitName)
		returns (uint256 traitId)
	{
		traitCounter.increment();
		traitId = traitCounter.current();
		traitDetails[traitId].itemId = _itemId;
		traitDetails[traitId].seriesId = _seriesId;
		traitDetails[traitId].name = _traitName;
		seriesDetails[_itemId][_seriesId].totalTraits = uint8(
			seriesDetails[_itemId][_seriesId].totalTraits + 1
		);
		seriesTraitIds[_itemId][_seriesId].push(traitId);
		emit TraitAdded(traitId);
	}

	/**
	 * @notice This method allows operator to add the variation for the trait
	 * @param _itemId - indicates the item id
	 * @param _seriesId - indicates the series of item
	 * @param _traitId - indicates the trait id of given series
	 * @param _variationName - indicates the variation name
	 * @param _svg - indicates the svg of variation
	 * @param _probabilty - indicates the probablity of variation to get selected
	 * @return variationId - indicatest the unique variation id
	 */
	function addTraitVariation(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _traitId,
		string memory _variationName,
		string memory _svg,
		uint256 _probabilty
	)
		external
		virtual
		onlyOperator
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
		onlyValidTraitId(_traitId)
		onlyValidName(_variationName)
		returns (uint256 variationId)
	{
		require(bytes(_svg).length > 0, 'TraitFactory: INVALID_SVG');
		traitVariationCounter.increment();
		variationId = traitVariationCounter.current();
		traitVariations[variationId] = TraitVariation(
			_itemId,
			_seriesId,
			_traitId,
			_variationName,
			_svg,
			_probabilty
		);
		// update total variations of trait
		seriesTraitVariations[_itemId][_seriesId][_traitId] += 1;
		//update variation ids of trait
		variationIds[_itemId][_seriesId][_traitId].push(variationId);
		emit TraitVariationAdded(variationId);
	}

	/**
	 * @notice This method allows operator to update the trait variation details
	 * @param _traitVariationId - indicates the trait variation id which is to update.
	 * @param _variationName - indicates the variation name
	 * @param _svg - indicates the variation svg
	 * @param _probabilty - indicates the probability
	 */
	function updateTraitVariation(
		uint256 _traitVariationId,
		string memory _variationName,
		string memory _svg,
		uint256 _probabilty
	) external virtual onlyOperator onlyValidName(_variationName) {
		require(
			_traitVariationId > 0 && _traitVariationId < traitVariationCounter.current(),
			'TraitFactory: INVALID_VARIATION_ID'
		);
		require(bytes(_svg).length > 0, 'TraitFactory: INVALID_SVG');
		traitVariations[_traitVariationId].name = _variationName;
		traitVariations[_traitVariationId].svg = _svg;
		traitVariations[_traitVariationId].probability = _probabilty;
		emit TraitVariationUpdated(_traitVariationId);
	}

	function activateNFTGeneration(uint256 _itemId, uint256 _seriesId)
		external
		onlyOperator
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
	{
		isNftGenerationEnabled[_itemId][_seriesId] = true;
	}

	function deactivateNFTGeneration(uint256 _itemId, uint256 _seriesId)
		external
		onlyOperator
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
	{
		isNftGenerationEnabled[_itemId][_seriesId] = true;
	}

	/**
	 * @notice This method allows admin to add the thresholds for the likes.
	 * If talien exceeds the max value of threshold, we show the respective badge on the talien svg.
	 * @param _maxValue - indicates the max value for threshold
	 * @param _badge - indicates the badge name for the threshold
	 * @param _badgeSvg - indicates the badge svg
	 * @return thresholdId - indicates threshold id
	 */
	function addThreshold(
		uint256 _maxValue,
		string memory _badge,
		string memory _badgeSvg
	) external onlyOperator returns (uint256 thresholdId) {
		require(bytes(_badgeSvg).length > 0, 'TraitFactory: INVALID_BADGE');
		thresholdCounter.increment();
		thresholdId = thresholdCounter.current();
		// threshold value must be greater than previous value
		if (thresholdId > 1) {
			require(_maxValue > thresholds[thresholdId - 1].max, 'TraitFactory: INVALID_VALUE');
		}
		thresholds[thresholdId] = ThresholdDetail(_maxValue, _badge, _badgeSvg);
	}

	/**
	 * @notice This method allows admin to update the threshold details.
	 * @param _thresholdId - indicates the threshold id to update
	 * @param _maxValue - indicates the max value for threshold
	 * @param _badge - indicates the badge name for the threshold
	 * @param _badgeSvg - indicates the badge svg
	 */
	function updateThreshold(
		uint256 _thresholdId,
		uint256 _maxValue,
		string memory _badge,
		string memory _badgeSvg
	) external onlyOperator {
		require(
			_thresholdId > 0 && _thresholdId <= thresholdCounter.current(),
			'TraitFactory: INVALID_THRESHOLD_ID'
		);
		require(bytes(_badgeSvg).length > 0, 'TraitFactory: INVALID_BADGE');
		thresholds[_thresholdId] = ThresholdDetail(_maxValue, _badge, _badgeSvg);
	}

	/**
	 * @notice This method allows admin to update the font name.
	 * @param _fontName - indicates the font name for the nft id text on svg
	 */
	function updateFontName(string memory _fontName)
		external
		virtual
		onlyOperator
		onlyValidName(_fontName)
	{
		fontName = _fontName;
	}

	/**
	 * @notice This method allows updater to update the total nfts minted per series.
	 * @param _itemId - indicates the item id
	 * @param _seriesId - indicates the series of item
	 * @param _amount - indicates the amount of nfts minted
	 */
	function updateTotalNftsMinted(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _amount
	) external virtual onlyUpdator onlyValidItemId(_itemId) onlyValidseriesId(_itemId, _seriesId) {
		require(_amount > 0, 'TraitFactory: INVALID_AMOUNT');
		Series storage series = seriesDetails[_itemId][_seriesId];
		series.totalNftsMinted += _amount;
	}

	/**
	 * @notice This method allows admin to update the item generation fee for with accessory
	 * @param _newFee - indicates the new fee for generating the item
	 */
	function updateItemGenerationFeeWithAccessory(uint256 _newFee) external virtual onlyOperator {
		require(_newFee > 0 && _newFee != generationFeeWithAccessory, 'TraitFactory: INVALID_FEE');
		generationFeeWithAccessory = _newFee;
	}

	/**
	 * @notice This method allows admin to update the item generation fee for without accessory
	 * @param _newFee - indicates the new fee for generating the item
	 */
	function updateItemGenerationFeeWithoutAccessory(uint256 _newFee) external virtual onlyOperator {
		require(_newFee > 0 && _newFee != generationFeeWithoutAccessory, 'TraitFactory: INVALID_FEE');
		generationFeeWithoutAccessory = _newFee;
	}

	/*
   	=======================================================================
   	======================== Getter Methods ===============================
   	=======================================================================
 	*/
	/**
		@notice This method returns the unique traitVariationHash for item generation
	 */
	function getTraitVariationHash(uint256 _itemId, uint256 _seriesId)
		external
		virtual
		onlyUpdator
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
		returns (uint256 traitVariationHash, uint256 totalTraits)
	{
		require(isNftGenerationEnabled[_itemId][_seriesId], 'TraitFactory: NFT_GENERATION_DISABLED');

		require(
			seriesDetails[_itemId][_seriesId].totalNftsMinted <=
				seriesDetails[_itemId][_seriesId].maxNfts,
			'TraitFactory: MAX_NFT_EXCEEDED'
		);

		totalTraits = seriesDetails[_itemId][_seriesId].totalTraits;

		require(totalTraits > 0, 'TraitFactory: INSUFFICIENT_TRAITS');

		traitVariationHash = _getHash(_itemId, _seriesId, totalTraits);

		bytes32 hash = keccak256(abi.encodePacked(_seriesId, uint8(totalTraits), traitVariationHash));

		// get unique hash for the trait
		while (itemHash[_itemId][hash]) {
			traitVariationHash = _getHash(_itemId, _seriesId, totalTraits);
			hash = keccak256(abi.encodePacked(_seriesId, uint8(totalTraits), traitVariationHash));
		}

		itemHash[_itemId][hash] = true;
	}

	function _getHash(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _totalTraits
	) internal virtual returns (uint256 traitVariationHash) {
		for (uint8 i = 0; i < _totalTraits; i++) {
			uint256 traitId = seriesTraitIds[_itemId][_seriesId][i];
			uint256 totalVariations = seriesTraitVariations[_itemId][_seriesId][traitId];

			require(totalVariations > 0, 'TraitFactory: INSUFFICIENT_VARIATIONS');

			uint256 variationId = _getRandomTraitVariation(_itemId, _seriesId, traitId, totalVariations);

			require(
				variationId > 0 && variationId <= traitVariationCounter.current(),
				'TraitFactory: INVALID_VARIAON_ID'
			);

			traitVariationHash += variationId * 256**i;

			//increment nonce
			nonce++;
		}
	}

	function _getRandomTraitVariation(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _traitId,
		uint256 _totalVariations
	) internal view returns (uint256) {
		uint256 initialVariationId = variationIds[_itemId][_seriesId][_traitId][0];
		if (_totalVariations == 1) {
			return initialVariationId;
		}

		// Create and fill prefix array
		uint256[] memory prefix = new uint256[](_totalVariations);

		prefix[0] = traitVariations[initialVariationId].probability;

		for (uint256 i = 1; i < _totalVariations; ++i) {
			prefix[i] =
				prefix[i - 1] +
				traitVariations[variationIds[_itemId][_seriesId][_traitId][i]].probability;
		}

		return variationIds[_itemId][_seriesId][_traitId][_getIndex(prefix, _totalVariations)];
	}

	function _getIndex(uint256[] memory prefix, uint256 n) internal view returns (uint256 index) {
		// prefix[n-1] is sum of all frequencies.
		// Generate a random number with
		// value from 1 to this sum
		uint256 r = LaCucinaUtils.getRandomVariation(nonce, prefix[n - 1]) + 1;

		// Find index of ceiling of r in prefix array
		index = LaCucinaUtils.findCeil(prefix, r, 0, n - 1);

		require(index < n, 'TraitFactory: INVALID_INDEX');
	}

	/**
	 * @notice This method returns the current item id
	 */
	function getCurrentItemId() external view virtual returns (uint256) {
		return itemCounter.current();
	}

	/**
	 * @notice This method returns the current trait id
	 */
	function getCurrentTraitId() external view virtual returns (uint256) {
		return traitCounter.current();
	}

	/**
	 * @notice This method returns the current trait variation id
	 */
	function getCurrentTraitVariationId() external view virtual returns (uint256) {
		return traitVariationCounter.current();
	}

	/**
	 * @notice This method returns the current threshold id
	 */
	function getCurrentThresholdId() external view virtual returns (uint256) {
		return thresholdCounter.current();
	}

	/**
	 * @notice This method returns the total variations of the trait for given series
	 */
	function getTotalVariationsForTrait(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _traitId
	)
		external
		view
		virtual
		onlyValidItemId(_itemId)
		onlyValidTraitId(_traitId)
		onlyValidseriesId(_itemId, _seriesId)
		returns (uint256)
	{
		return seriesTraitVariations[_itemId][_seriesId][_traitId];
	}

	/**
	 * @notice This method returns the trait id at given index of series
	 */
	function getSeriesTraitId(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _index
	)
		external
		view
		virtual
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
		returns (uint256)
	{
		require(_index < seriesDetails[_itemId][_seriesId].totalTraits, 'TraitFactory: INVALID_INDEX');
		return seriesTraitIds[_itemId][_seriesId][_index];
	}

	/**
	 * @notice This method returns the variation id at given index of trait series
	 */
	function getVariationsId(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _traitId,
		uint256 _index
	)
		external
		view
		virtual
		onlyValidItemId(_itemId)
		onlyValidseriesId(_itemId, _seriesId)
		onlyValidTraitId(_traitId)
		returns (uint256)
	{
		require(
			_index < seriesTraitVariations[_itemId][_seriesId][_traitId],
			'TraitFactory: INVALID_INDEX'
		);
		return variationIds[_itemId][_seriesId][_traitId][_index];
	}

	function getSvgNumber(uint256 _tokenId) external view returns (string memory svgNumber) {
		svgNumber = string(
			abi.encodePacked(
				'<style>@import url(https://assets.lacucina.finance/css/fonts.css);</style><text x="570" y="25" text-anchor="end" font-family="',
				fontName,
				'" fill="#ff17b9" font-size="20">',
				toString(_tokenId),
				'</text>'
			)
		);
	}

	function getSvgBadge(uint256 _totalLikes) external view returns (string memory badge) {
		uint256 threshold;
		for (threshold = 1; threshold <= thresholdCounter.current(); threshold++) {
			if (_totalLikes < thresholds[threshold].max) {
				break;
			}
			badge = thresholds[threshold].badgeSvg;
		}
	}

	function getSvgLikes(uint256 _totalLikes) external view returns (string memory svgLikes) {
		svgLikes = string(
			abi.encodePacked(
				'<style>@import url(https://assets.lacucina.finance/css/fonts.css);</style><text x="10" y="570" text-anchor="start" font-family="',
				fontName,
				'" fill="#ff17b9" font-size="20">',
				toString(_totalLikes),
				'</text>'
			)
		);
	}

	/**
	 * @dev Converts a `uint256` to its ASCII `string` decimal representation.
	 */
	function toString(uint256 value) internal pure returns (string memory) {
		// Inspired by OraclizeAPI's implementation - MIT licence
		// https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol
		if (value == 0) {
			return '0';
		}
		uint256 temp = value;
		uint256 digits;
		while (temp != 0) {
			digits++;
			temp /= 10;
		}
		bytes memory buffer = new bytes(digits);
		while (value != 0) {
			digits -= 1;
			buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
			value /= 10;
		}
		return string(buffer);
	}

	/**
	 * @notice Returns the storage, major, minor, and patch version of the contract.
	 * @return The storage, major, minor, and patch version of the contract.
	 */
	function getVersionNumber()
		external
		pure
		virtual
		override
		returns (
			uint256,
			uint256,
			uint256
		)
	{
		return (1, 0, 0);
	}
}
