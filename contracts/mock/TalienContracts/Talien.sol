// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import './BaseERC721WithRoyalties.sol';
import '../../library/LaCucinaUtils.sol';
import './TraitFactory.sol';

contract Talien is BaseERC721WithRoyalties, TraitFactory, ReentrancyGuardUpgradeable {
	using Counters for Counters.Counter;

	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
	*/
	struct TalienDetail {
		uint256 tokenId;
		uint256 generation;
		uint256 likes;
		uint8 totalTraits;
		uint256 traitVariationHash;
	}

	struct ThresholdDetail {
		uint256 max;
		string badgeName;
		string badgeSvg;
	}

	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	uint256 private nonce;

	Counters.Counter private thresholdCounter;

	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	/// @notice Fee Token
	IBEP20 public feeToken;

	string public fontName;
	bool public isNumberedNft;
	bool public isProfileGenerationEnabled;

	///  @notice address to which all the funds are transfer
	address public fundReceiver;
	/// @notice price for generating new profile picture
	uint256 public generationFee;

	/// @notice  NftId  => TalienDetaild
	mapping(uint256 => TalienDetail) public taliens;

	/// @notice userAddress => likes
	mapping(address => uint256) public userTotalLikes;

	/// @notice userAddress => nftToken => liked/unliked
	mapping(address => mapping(uint256 => bool)) public userLikedNFTs;

	/// @notice  NftId  => TalienDetail
	mapping(uint256 => ThresholdDetail) public thresholds;

	/*
		=======================================================================
   	======================== Constructor/Initializer ======================
   	=======================================================================
 	*/
	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 */
	function initialize(
		string memory _name,
		string memory _symbol,
		string memory baseTokenURI,
		address _fundReceiver,
		address _feeToken,
		uint256 _generationFee,
		address _royaltyReceiver,
		uint8 _royaltyFee,
		string memory _fontName
	) external virtual initializer {
		initialize_BaseERC721WithRoyalties(_name, _symbol, baseTokenURI, _royaltyReceiver, _royaltyFee);

		fundReceiver = _fundReceiver;
		feeToken = IBEP20(_feeToken);
		generationFee = _generationFee;
		fontName = _fontName;
		isNumberedNft = true;
		nonce = 0;
	}

	/*
   	=======================================================================
   	======================== Events =======================================
   	=======================================================================
 	*/
	event TalienCreated(uint256 tokenId, address creator, uint256 timestamp);
	event Claimed(uint256 tokenId, address user, uint256 timestamp);
	event Liked(uint256 tokenId, address user);
	event Disliked(uint256 tokenId, address user);

	/* 
	=======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/

	modifier onlyMinter() {
		require(hasRole(MINTER_ROLE, msg.sender), 'Talien: ONLY_MINTER_CAN_CALL');
		_;
	}
	modifier onlyValidTokenId(uint256 _tokenId) {
		require(_tokenId > 0 && _tokenId <= getCurrentTokenId(), 'Talien: INVALID_TOKEN_ID');
		_;
	}

	/*
   	=======================================================================
   	======================== Public Methods ===============================
   	=======================================================================
 	*/

	/**
	 * @notice This method allows minter to claim the free nft
	 * @param _user - indicates the user address to whom mint the free talien
	 * @return tokenId - indicates the generated token id
	 */
	function claim(address _user) external virtual onlyMinter returns (uint256 tokenId) {
		tokenId = _generateTalien(_user);
		emit Claimed(tokenId, _user, block.timestamp);
	}

	/**
	 * @notice This method allows anyone to generate a unique profile picture and mints the NFT token to user.
	 * @return tokenId returns the new profile picture id.
	 */
	function generateTalien() external virtual nonReentrant returns (uint256 tokenId) {
		require(isProfileGenerationEnabled, 'Talien: PROFILE_GENERATION_DISABLED');

		// get the lac tokens from the user
		require(feeToken.transferFrom(msg.sender, fundReceiver, generationFee));

		return _generateTalien(msg.sender);
	}

	/**
	 * @notice This method allows users to like the talien. One user can have maximum 3 likes
	 * @param _tokenId - indicates the talien nft token id
	 */
	function likeTalien(uint256 _tokenId) external virtual onlyValidTokenId(_tokenId) {
		require(userTotalLikes[msg.sender] < 3, 'Talien: INSUFFICIENT_LIKES');
		require(!userLikedNFTs[msg.sender][_tokenId], 'Talien: ALREADY_LIKED');

		TalienDetail storage profile = taliens[_tokenId];
		profile.likes += 1;

		userTotalLikes[msg.sender] += 1;
		userLikedNFTs[msg.sender][_tokenId] = true;

		emit Liked(_tokenId, msg.sender);
	}

	/**
	 * @notice This method allows users to dislike/unlike the talien
	 * @param _tokenId - indicates the talien nft token id
	 */
	function unLikeTalien(uint256 _tokenId) external virtual onlyValidTokenId(_tokenId) {
		require(userLikedNFTs[msg.sender][_tokenId], 'Talien: NO_LIKE_GIVEN');

		TalienDetail storage profile = taliens[_tokenId];
		profile.likes -= 1;

		userTotalLikes[msg.sender] -= 1;
		userLikedNFTs[msg.sender][_tokenId] = false;

		emit Disliked(_tokenId, msg.sender);
	}

	/**
	 * @notice This method allows admin to add the trait for the Talien.
	 * @param _traitName - indicates the trait name
	 * @return returns the traitId
	 */
	function addTrait(string memory _traitName) external virtual onlyAdmin returns (uint256) {
		return _addTrait(_traitName);
	}

	/**
	 * @notice This method allows admin to update the generation for the Taliens.
	 * @param _maxNFTS - indicates the maximum number of nfts to mint for the generation
	 * @param _generationName - indicates the name of the generation
	 */
	function updateGeneration(uint256 _maxNFTS, string memory _generationName)
		external
		virtual
		onlyAdmin
	{
		_updateGeneration(_maxNFTS, _generationName);
	}

	/**
	 * @notice This method allows admin to update the font name.
	 * @param _fontName - indicates the font name for the nft id text on svg
	 */
	function updateFontName(string memory _fontName) external virtual onlyAdmin {
		require(bytes(_fontName).length > 0, 'Talien: INVALID_FONT_NAME');
		fontName = _fontName;
	}

	/**
	 * @notice This method allows admin to specify if the nft is numbered or not.
	 * @param _isNumberedNft - indicates the font name for the nft id text on svg
	 */
	function updateIsNumberedNft(bool _isNumberedNft) external virtual onlyAdmin {
		require(isNumberedNft != _isNumberedNft, 'Talien: ALREADY_SET');
		isNumberedNft = _isNumberedNft;
	}

	/**
	 * @notice This method allows admin to add the variation for the trait.
	 * @param _traitId - indicates the gene id
	 * @param _generation - indicates the generation for variation
	 * @param _variationName - indicates the variation name
	 * @param _svg - indicates the svg of variation
	 * @return returns the gene variation id
	 */
	function addTraitVariation(
		uint256 _traitId,
		uint256 _generation,
		string memory _variationName,
		string memory _svg,
		uint256 _probabilty
	) external virtual onlyAdmin returns (uint256) {
		return _addTraitVariation(_traitId, _generation, _variationName, _svg, _probabilty);
	}

	/**
	 * @notice This method allows admin to update the trait variation.
	 * @param _traitVariationId - indicates the trait variation id
	 * @param _variationName - indicates the variation name
	 * @param _svg - indicates the svg of variation
	 */
	function updateTraitVariation(
		uint256 _traitVariationId,
		string memory _variationName,
		string memory _svg,
		uint256 _probabilty
	) external virtual onlyAdmin {
		_updateTraitVariation(_traitVariationId, _variationName, _svg, _probabilty);
	}

	/**
	 * @notice This method allows admin to update the fund receiver address
	 * @param _fundReceiver - indicates the new fund receiver address
	 */
	function updateFundReceiver(address _fundReceiver) external virtual onlyAdmin {
		require(_fundReceiver != address(0), 'Talien: INVALID_FUND_RECEIVER');
		fundReceiver = _fundReceiver;
	}

	/**
	 * @notice This method allows admin to update the fund receiver address
	 * @param _newFee - indicates the new fee for generating the profile pictures
	 */
	function updateProfileGenerationFee(uint256 _newFee) external virtual onlyAdmin {
		require(_newFee > 0 && _newFee != generationFee, 'Talien: INVALID_FEE');
		generationFee = _newFee;
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
	) external onlyAdmin returns (uint256 thresholdId) {
		require(bytes(_badgeSvg).length > 0, 'Talien: INVALID_BADGE');

		thresholdCounter.increment();
		thresholdId = thresholdCounter.current();

		// threshold value must be greater than previous value
		if (thresholdId > 1) {
			require(_maxValue > thresholds[thresholdId - 1].max, 'Talien: INVALID_VALUE');
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
	) external onlyAdmin {
		require(
			_thresholdId > 0 && _thresholdId <= thresholdCounter.current(),
			'Talien: INVALID_THRESHOLD_ID'
		);
		require(bytes(_badgeSvg).length > 0, 'Talien: INVALID_BADGE');

		thresholds[_thresholdId] = ThresholdDetail(_maxValue, _badge, _badgeSvg);
	}

	function activateProfileGeneration() external onlyAdmin {
		isProfileGenerationEnabled = true;
	}

	function deactivateProfileGeneration() external onlyAdmin {
		isProfileGenerationEnabled = false;
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */
	/**
	 * @notice This method allows users to get the svg for the profile picture.
	 * @param _tokenId - indicates the profile picture id
	 * @return pictureSvg -  returns the profile picture svg
	 */
	function getPicture(uint256 _tokenId) external view virtual returns (string memory pictureSvg) {
		require(_tokenId > 0 && _tokenId <= getCurrentTokenId(), 'ProfilePictures: INVALID_PROFIlE_ID');

		TalienDetail memory profile = taliens[_tokenId];

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 genSlottedValue;
		uint256 traitVariationId;
		uint256 slotMultiplier;
		uint8 totalVariations = profile.totalTraits;

		pictureSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="580" height="580">';

		for (uint8 slot = 0; slot < totalVariations; slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			genSlottedValue = profile.traitVariationHash & bitMask; // Extract slotted value from hash

			if (genSlottedValue > 0) {
				traitVariationId = (slot > 0) // Extract IngredientID from slotted value
					? genSlottedValue / slotMultiplier
					: genSlottedValue;

				require(
					traitVariationId > 0 && traitVariationId <= traitVariationCounter.current(),
					'Talien: INVALID_VARIAION_ID'
				);

				pictureSvg = LaCucinaUtils.strConcat(pictureSvg, traitVariationSvgs[traitVariationId].svg);
			}
		}
		if (isNumberedNft) {
			pictureSvg = LaCucinaUtils.strConcat(pictureSvg, _getSvgNumber(_tokenId));
		}

		string memory badge = _getSvgBadge(profile.likes);

		if (bytes(badge).length > 0) pictureSvg = LaCucinaUtils.strConcat(pictureSvg, badge);

		if (profile.likes > 0)
			pictureSvg = LaCucinaUtils.strConcat(pictureSvg, _getSvgLikes(profile.likes));

		pictureSvg = LaCucinaUtils.strConcat(pictureSvg, '</svg>');
	}

	/**
	 * @notice This method returns the current threshold id
	 */
	function getCurrentThresholdId() external view returns (uint256) {
		return thresholdCounter.current();
	}

	/**
	 * @notice This method returns the generation name of give talien nft
	 */
	function getTalienGenerationName(uint256 _tokenId)
		external
		view
		onlyValidTokenId(_tokenId)
		returns (string memory)
	{
		return generationNames[taliens[_tokenId].generation];
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
 	*/

	/**
	 * @notice This method allows anyone to generate a unique talion and mints the NFT token to user.
	 * @return talionId returns the new profile picture id.
	 */
	function _generateTalien(address _user) internal virtual returns (uint256 talionId) {
		uint256 traitCount = traitCounter.current();
		uint256 currentGeneration = generationCounter.current();

		require(
			generationNftsCounter.current() <= maxNFTsPerGeneration[currentGeneration],
			'_generateTalion: MAX_NFT_EXCEEDED'
		);

		uint256 traitVariationHash;

		uint8 traitIndex = 1;
		for (uint256 i = 0; i < traitCount; i++) {
			TraitDetail storage gene = traitDetails[traitIndex];
			traitIndex++;

			require(
				gene.generationTotalVariations[currentGeneration] > 0,
				'_generateTalion: INSUFFICIENT_VARIATIONS'
			);

			uint256 variationId = _getRandomTraitVariation(gene.variationIds[currentGeneration]);

			require(
				variationId > 0 && variationId <= traitVariationCounter.current(),
				'_generateTalion: INVALID_VARIATION_ID'
			);
			traitVariationHash += variationId * 256**i;
		}

		// mint profile
		talionId = mint(_user);

		taliens[talionId] = TalienDetail(
			talionId,
			currentGeneration,
			0,
			uint8(traitCount),
			traitVariationHash
		);

		//increament minted token counter for generation
		generationNftsCounter.increment();

		//increment nonce
		nonce++;

		emit TalienCreated(talionId, _user, block.timestamp);
	}

	function _getSvgNumber(uint256 _tokenId) internal view returns (string memory svgNumber) {
		svgNumber = string(
			abi.encodePacked(
				'<style>@import url(https://assets.lacucina.finance/css/fonts.css);</style><text x="570" y="25" text-anchor="end" font-family="',
				fontName,
				'" fill="#ff17b9" font-size="20">',
				LaCucinaUtils.toString(_tokenId),
				'</text>'
			)
		);
	}

	function _getSvgBadge(uint256 _totalLikes) internal view returns (string memory badge) {
		uint256 threshold;
		for (threshold = 1; threshold <= thresholdCounter.current(); threshold++) {
			if (_totalLikes < thresholds[threshold].max) {
				break;
			}
			badge = thresholds[threshold].badgeSvg;
		}
	}

	function _getSvgLikes(uint256 _totalLikes) internal view returns (string memory svgLikes) {
		svgLikes = string(
			abi.encodePacked(
				'<style>@import url(https://assets.lacucina.finance/css/fonts.css);</style><text x="10" y="570" text-anchor="start" font-family="',
				fontName,
				'" fill="#ff17b9" font-size="20">',
				LaCucinaUtils.toString(_totalLikes),
				'</text>'
			)
		);
	}

	function _getRandomTraitVariation(uint256[] memory variationIds) internal view returns (uint256) {
		uint256 n = variationIds.length;

		if (n == 1) {
			return variationIds[0];
		}

		// Create and fill prefix array
		uint256[] memory prefix = new uint256[](n);

		prefix[0] = traitVariationSvgs[variationIds[0]].probability;

		for (uint256 i = 1; i < n; ++i)
			prefix[i] = prefix[i - 1] + traitVariationSvgs[variationIds[i]].probability;

		// prefix[n-1] is sum of all frequencies.
		// Generate a random number with
		// value from 1 to this sum
		uint256 r = LaCucinaUtils.random(nonce, prefix[n - 1]) + 1;

		// Find index of ceiling of r in prefix array
		uint256 index = LaCucinaUtils.findCeil(prefix, r, 0, n - 1);

		require(index < n, 'Talien:INVALID_VARIATION_INDEX');

		return variationIds[index];
	}
}
