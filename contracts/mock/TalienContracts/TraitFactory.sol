// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/Counters.sol';

contract TraitFactory {
	using Counters for Counters.Counter;

	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
	*/
	struct TraitDetail {
		string name;
		// generationId => TotalVariations
		mapping(uint256 => uint256) generationTotalVariations;
		// generationId => variationIds
		mapping(uint256 => uint256[]) variationIds;
	}

	struct TraitVariation {
		string name;
		string svg;
		uint256 probability;
	}

	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	Counters.Counter internal traitCounter;
	Counters.Counter internal generationCounter;
	Counters.Counter internal traitVariationCounter;
	// counter for counting the number of NFTs created in current generation
	Counters.Counter internal generationNftsCounter;

	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	// @notice  TraitId => GeneDetail
	mapping(uint8 => TraitDetail) public traitDetails;
	// @notice  geneVariationId => GeneDetail
	mapping(uint256 => TraitVariation) public traitVariationSvgs;
	// @notice  generationId => name
	mapping(uint256 => string) public generationNames;
	// @notice generation => maxNFTs
	mapping(uint256 => uint256) public maxNFTsPerGeneration;
	// @notice generation => traitId => totalVariations
	mapping(uint256 => mapping(uint256 => uint256)) public generationTraitVariations;

	/*
   	=======================================================================
   	======================== Events =======================================
   	=======================================================================
 	*/
	event TraitAdded(uint256 traitId);
	event TraitVariationAdded(uint256 traitVariationId);
	event TraitVariationUpdated(uint256 traitVariationId);

	/* 
	 =======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/

	modifier onlyValidTraitId(uint256 _traitId) {
		require(_traitId > 0 && _traitId <= traitCounter.current(), 'TraitFactory: INVALID_TRAIT_ID');
		_;
	}

	modifier onlyValidGenerationId(uint256 _generation) {
		require(
			_generation > 0 && _generation <= generationCounter.current(),
			'TraitFactory: INVALID_GENERATION_ID'
		);
		_;
	}

	/*
   	=======================================================================
   	======================== Getter Methods ===============================
   	=======================================================================
 	*/

	/**
	 * @notice This method returns the total amounts of traits added for the Profile generation
	 */
	function getTotalTraits() external view virtual returns (uint256) {
		return traitCounter.current();
	}

	/**
	 * @notice This method returns the current generation
	 */
	function getCurrentGeneration() external view virtual returns (uint256) {
		return generationCounter.current();
	}

	/**
	 * @notice This method returns the current trait variation id
	 */
	function getCurrentTraitVariationId() external view virtual returns (uint256) {
		return traitVariationCounter.current();
	}

	/**
	 * @notice This method returns the total variations of the trait for given generation
	 */
	function getTotalVariationsForGeneration(uint8 _traitId, uint256 _generation)
		external
		view
		virtual
		onlyValidTraitId(_traitId)
		onlyValidGenerationId(_generation)
		returns (uint256)
	{
		return traitDetails[_traitId].generationTotalVariations[_generation];
	}

	/**
	 * @notice This method returns the variation id at given index of trait generation
	 */
	function getVariationsId(
		uint8 _traitId,
		uint256 _generation,
		uint256 _index
	)
		external
		view
		virtual
		onlyValidTraitId(_traitId)
		onlyValidGenerationId(_generation)
		returns (uint256)
	{
		return traitDetails[_traitId].variationIds[_generation][_index];
	}

	/*
   	=======================================================================
   	======================== Internal Methods ===============================
   	=======================================================================
 	*/

	function _addTrait(string memory _genName) internal virtual returns (uint256 traitId) {
		require(bytes(_genName).length > 0, '_addTrait: INVALID_TRAIT_NAME');

		traitCounter.increment();
		traitId = traitCounter.current();

		traitDetails[uint8(traitId)].name = _genName;
		emit TraitAdded(traitId);
	}

	function _updateGeneration(uint256 _maxNFTS, string memory _generationName) internal {
		require(_maxNFTS > 0, '_updateGeneration: INSUFFICIENT_NFTS');
		require(bytes(_generationName).length > 0, '_updateGeneration: INVALID_NAME');

		/// reset generation NFTs counter
		generationNftsCounter.reset();
		generationCounter.increment();
		maxNFTsPerGeneration[generationCounter.current()] = _maxNFTS;
		generationNames[generationCounter.current()] = _generationName;
	}

	function _addTraitVariation(
		uint256 _traitId,
		uint256 _generation,
		string memory _variationName,
		string memory _svg,
		uint256 _probabilty
	)
		internal
		virtual
		onlyValidTraitId(_traitId)
		onlyValidGenerationId(_generation)
		returns (uint256 variationId)
	{
		require(bytes(_variationName).length > 0, '_addTraitVariation: INVALID_VARIATION_NAME');
		require(bytes(_svg).length > 0, '_addTraitVariation: INVALID_SVG');

		traitVariationCounter.increment();
		variationId = traitVariationCounter.current();

		traitVariationSvgs[variationId] = TraitVariation(_variationName, _svg, _probabilty);

		traitDetails[uint8(_traitId)].generationTotalVariations[_generation] += 1;

		traitDetails[uint8(_traitId)].variationIds[_generation].push(variationId);

		emit TraitVariationAdded(variationId);
	}

	function _updateTraitVariation(
		uint256 _traitVariationId,
		string memory _variationName,
		string memory _svg,
		uint256 _probabilty
	) internal virtual {
		require(
			_traitVariationId > 0 && _traitVariationId < traitVariationCounter.current(),
			'_updateTraitVariation: INVALID_VARIATION_ID'
		);
		require(bytes(_variationName).length > 0, '_updateTraitVariation: INVALID_VARIATION_NAME');
		require(bytes(_svg).length > 0, '_updateTraitVariation: INVALID_SVG');

		traitVariationSvgs[_traitVariationId] = TraitVariation(_variationName, _svg, _probabilty);
		emit TraitVariationUpdated(_traitVariationId);
	}
}
