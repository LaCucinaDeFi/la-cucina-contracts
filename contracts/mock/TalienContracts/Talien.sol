// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';

import './BaseERC721WithRoyalties.sol';
import '../../library/LaCucinaUtils.sol';
import '../../interfaces/IAccessories.sol';
import '../../interfaces/ITraitFactory.sol';

contract Galaxy is BaseERC721WithRoyalties, ERC1155ReceiverUpgradeable {
	using CountersUpgradeable for CountersUpgradeable.Counter;

	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
	*/
	struct GalaxyItem {
		uint256 galaxyItemId;
		uint256 seriesId;
		uint256 likes;
		uint8 totalTraits;
		uint256 traitVariationHash;
		uint256 totalAccessoryTypes;
	}

	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	uint256 private nonce;

	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	/// @notice Fee Token
	IBEP20 public feeToken;

	/// @notice accessories nft contract
	IAccessories public accessories;

	/// @notice trati factory contract
	ITraitFactory public traitFactory;

	///  @notice address to which all the funds are transfer
	address public fundReceiver;

	/// @notice  NftId  => GalaxyItem
	mapping(uint256 => GalaxyItem) public galaxyItems;

	/// @notice  galaxyItemId  => totalNfts
	mapping(uint256 => uint256) public galaxyItemTotalNfts;

	/// @notice  galaxyItemId  => nftIds
	mapping(uint256 => uint256[]) public galaxyItemNftIds;

	// @notice tokenId => AccessoryTypeId => AccessoryId
	mapping(uint256 => mapping(uint256 => uint256)) public accessoryIds;

	/// @notice userAddress => likes
	mapping(address => uint256) public userTotalLikes;

	/// @notice userAddress => nftToken => liked/unliked
	mapping(address => mapping(uint256 => bool)) public userLikedNFTs;

	// galaxyItemId => galaxyItem Hash => exists or not
	mapping(uint256 => mapping(bytes32 => bool)) public galaxyItemHash;

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
		address _accessories,
		address _traitFactory,
		address _royaltyReceiver,
		uint8 _royaltyFee
	) external virtual initializer {
		__ReentrancyGuard_init();
		__ERC1155Receiver_init();
		initialize_BaseERC721WithRoyalties(_name, _symbol, baseTokenURI, _royaltyReceiver, _royaltyFee);

		fundReceiver = _fundReceiver;
		feeToken = IBEP20(_feeToken);
		accessories = IAccessories(_accessories);
		traitFactory = ITraitFactory(_traitFactory);
		nonce = 0;
	}

	/*
   	=======================================================================
   	======================== Events =======================================
   	=======================================================================
 	*/
	event TalienCreated(uint256 tokenId, address creator, uint256 timestamp);
	event Liked(uint256 tokenId, address user);
	event Disliked(uint256 tokenId, address user);

	/* 
		=======================================================================
   	======================== ERRORS CODES =================================
   	=======================================================================
 	*/
	/**
	 * ERR1 - Talien: ONLY_MINTER_CAN_CALL
	 * ERR2 - Talien: INVALID_TOKEN_ID'
	 * ERR3 - Talien: INVALID_CALLER'
	 * ERR4 - Talien: PROFILE_GENERATION_DISABLED'
	 * ERR5 - Talien: INVALID_ITEM_ID'
	 * ERR6 - 'Talien: INVALID_GENERATION_ID'
	 * ERR7 - 'Talien: ONLY_TALIEN_OWNER_CAN_UPDATE'
	 * ERR8 - 'Talien: INVALID_ACCESSORY_ID'
	 * ERR9 - 'Talien: INCORRECT_GENERATION_OF_ACCESSORY'
	 * ERR10 - 'Talien: INCORRECT_ITEM'
	 * ERR11 - 'Talien: ACCESSORY_ALREADY_APPLIED'
	 * ERR12 - 'Talien: INSUFFICIENT_LIKES'
	 * ERR13 - 'Talien: ALREADY_LIKED'
	 * ERR14 - 'Talien: NO_LIKE_GIVEN'
	 * ERR15 - 'Talien: INVALID_FUND_RECEIVER'
	 * ERR16 - 'Talien: INVALID_FEE'
	 * ERR17 - 'Talien: INVALID_VARIAION_ID'
	 * ERR18 - 'Talien: MAX_NFT_EXCEEDED'
	 * ERR19 - 'Talien: INSUFFICIENT_ACCESSORY_TYPES'
	 * ERR20 - 'Talien: INVALID_ITEM_FOR_ACCESSORY'
	 * ERR21 - 'Talien: INSUFFICIENT_ACCESSORIES'
	 * ERR22 - 'Talien: INVALID_ACCESSORY'
	 * ERR23 - 'Talien: INSUFFICIENT_VARIATIONS'
	 * ERR24 -	'Talien: INVALID_VARIATION_ID'
	 * ERR25 - 'Talien:INVALID_INDEX'
	 * ERR26 - 'Talien: INVALID_ACCESSORY_TYPE'
	 * ERR27 - 'Talien: NO_ACCESSORY_APPLIED'
	 */
	/* 
	=======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/

	modifier onlyMinter() {
		require(hasRole(MINTER_ROLE, msg.sender), 'ERR1');
		_;
	}
	modifier onlyValidTokenId(uint256 _tokenId) {
		require(_tokenId > 0 && _tokenId <= getCurrentTokenId(), 'ERR2');
		_;
	}

	modifier onlyValidUser() {
		require(tx.origin == msg.sender, 'ERR3');
		_;
	}

	modifier onlyTokenOWner(uint256 _tokenId) {
		require(msg.sender == ownerOf(_tokenId), 'ERR7');
		_;
	}

	/*
   	=======================================================================
   	======================== Public Methods ===============================
   	=======================================================================
 	*/

	/**
	 * @notice This method allows minter to claim the free nft
	 * @param _user - indicates the user address to whom mint the free galaxyItem
	 * @param _galaxyItemId - indicates the type of galaxyItem you want to generate ex. talion, spaceship
	 * @param _seriesId - indicates the series of galaxyItem
	 * @param _withAccessory - indicates whether to generate galaxyItem with accessory or without
	 * @return tokenId - indicates the generated token id
	 */
	function claim(
		address _user,
		uint256 _galaxyItemId,
		uint256 _seriesId,
		bool _withAccessory
	) external virtual onlyMinter returns (uint256 tokenId) {
		tokenId = _generateGalaxyItem(_galaxyItemId, _seriesId, _user, _withAccessory);
	}

	/**
	 * @notice This method allows anyone to generate a unique galaxyItem with/without accessories and mints the NFT token to user.
	 * @return tokenId returns the new galaxy item id.
	 */
	function generateGalaxyItem(
		uint256 _galaxyItemId,
		uint256 _seriesId,
		bool _withAccessory
	) external virtual onlyValidUser nonReentrant returns (uint256) {
		require(_galaxyItemId > 0 && _galaxyItemId <= traitFactory.getCurrentGalaxyItemId(), 'ERR5');
		require(_seriesId > 0 && _seriesId <= traitFactory.currentSeries(_galaxyItemId), 'ERR6');
		require(traitFactory.isNftGenerationEnabled(_galaxyItemId, _seriesId), 'ERR4');

		// get the lac tokens from the user
		require(feeToken.transferFrom(msg.sender, fundReceiver, traitFactory.generationFee()));

		return _generateGalaxyItem(_galaxyItemId, _seriesId, msg.sender, _withAccessory);
	}

	/**
	 * @notice This method allows galaxyItem owner to update the galaxyItem accessory
	 * @param _tokenId - indicates the nft token id to which user wants apply accessory
	 * @param _accessoryId - indicates the accessory to apply
	 */
	function applyAccessory(uint256 _tokenId, uint256 _accessoryId)
		external
		virtual
		onlyValidTokenId(_tokenId)
		onlyTokenOWner(_tokenId)
	{
		require(_accessoryId > 0 && _accessoryId <= accessories.getCurrentNftId(), 'ERR8');

		(uint256 galaxyItemId, , uint256 typeId, , , uint256 series, ) = accessories.accessories(
			_accessoryId
		);

		GalaxyItem storage galaxyItem = galaxyItems[_tokenId];

		require(series == galaxyItem.seriesId, 'ERR9');
		require(galaxyItemId == galaxyItem.galaxyItemId, 'ERR10');

		// add new type of accessory
		if (accessoryIds[_tokenId][typeId] == 0) {
			galaxyItem.totalAccessoryTypes = galaxyItem.totalAccessoryTypes + 1;
		} else {
			require(accessoryIds[_tokenId][typeId] != _accessoryId, 'ERR11');

			// return existing nft to user
			accessories.safeTransferFrom(
				address(this),
				msg.sender,
				accessoryIds[_tokenId][typeId],
				1,
				''
			);
		}
		// get accessory nft from user
		accessories.safeTransferFrom(msg.sender, address(this), _accessoryId, 1, '');

		// update accessory galaxyItem
		accessoryIds[_tokenId][typeId] = _accessoryId;
	}

	/**
	 * @notice This method allows galaxyItem owner to remove the galaxyItem accessory
	 * @param _tokenId - indicates the nft token id from which user wants to remove accessory
	 * @param _accessoryType - indicates the type of accessory to remove
	 */
	function removeAccessory(uint256 _tokenId, uint256 _accessoryType)
		external
		virtual
		onlyValidTokenId(_tokenId)
		onlyTokenOWner(_tokenId)
	{
		require(
			_accessoryType > 0 &&
				_accessoryType <= accessories.totalAccessoryTypes(galaxyItems[_tokenId].galaxyItemId),
			'ERR26'
		);

		uint256 accessoryId = accessoryIds[_tokenId][_accessoryType];
		require(accessoryId > 0 && accessoryId <= accessories.getCurrentNftId(), 'ERR27');

		accessoryIds[_tokenId][_accessoryType] = 0;

		// return existing nft to user
		accessories.safeTransferFrom(address(this), msg.sender, accessoryId, 1, '');
	}

	/**
	 * @notice This method allows users to like the galaxyItem. One user can have maximum 3 likes
	 * @param _tokenId - indicates the galaxyItem nft token id
	 */
	function likeGalaxyItem(uint256 _tokenId) external virtual onlyValidTokenId(_tokenId) {
		require(userTotalLikes[msg.sender] < 3, 'ERR12');
		require(!userLikedNFTs[msg.sender][_tokenId], 'ERR13');

		galaxyItems[_tokenId].likes += 1;

		userTotalLikes[msg.sender] += 1;
		userLikedNFTs[msg.sender][_tokenId] = true;

		emit Liked(_tokenId, msg.sender);
	}

	/**
	 * @notice This method allows users to dislike/unlike the galaxyItem
	 * @param _tokenId - indicates the galaxyItem nft token id
	 */
	function unLikeGalaxyItem(uint256 _tokenId) external virtual onlyValidTokenId(_tokenId) {
		require(userLikedNFTs[msg.sender][_tokenId], 'ERR14');

		galaxyItems[_tokenId].likes -= 1;

		userTotalLikes[msg.sender] -= 1;
		userLikedNFTs[msg.sender][_tokenId] = false;

		emit Disliked(_tokenId, msg.sender);
	}

	/**
	 * @notice This method allows admin to update the fund receiver address
	 * @param _fundReceiver - indicates the new fund receiver address
	 */
	function updateFundReceiver(address _fundReceiver) external virtual onlyOperator {
		require(_fundReceiver != address(0), 'ERR15');
		fundReceiver = _fundReceiver;
	}

	/*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */
	/**
	 * @notice This method allows users to get the svg for the galaxyItem .
	 * @param _tokenId - indicates the galaxyItem id
	 * @return Svg -  returns the galaxyItem  svg
	 */
	function getPicture(uint256 _tokenId)
		external
		view
		virtual
		onlyValidTokenId(_tokenId)
		returns (string memory Svg)
	{
		GalaxyItem memory galaxyItem = galaxyItems[_tokenId];

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 genSlottedValue;
		uint256 traitVariationId;
		uint256 slotMultiplier;

		Svg = '<svg xmlns="http://www.w3.org/2000/svg" width="580" height="580">';

		for (uint8 slot = 0; slot < galaxyItem.totalTraits; slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			genSlottedValue = galaxyItem.traitVariationHash & bitMask; // Extract slotted value from hash

			if (genSlottedValue > 0) {
				traitVariationId = (slot > 0) // Extract IngredientID from slotted value
					? genSlottedValue / slotMultiplier
					: genSlottedValue;

				require(
					traitVariationId > 0 && traitVariationId <= traitFactory.getCurrentTraitVariationId(),
					'ERR17'
				);
				(, , , , string memory variationSvg, ) = traitFactory.traitVariations(traitVariationId);

				Svg = LaCucinaUtils.strConcat(Svg, variationSvg);
			}
		}

		// get Accessories svgs
		if (galaxyItem.totalAccessoryTypes > 0) {
			for (
				uint256 accessorytType = 1;
				accessorytType <= galaxyItem.totalAccessoryTypes;
				accessorytType++
			) {
				if (accessoryIds[_tokenId][accessorytType] != 0) {
					(, , , , string memory _svg, , ) = accessories.accessories(
						accessoryIds[_tokenId][accessorytType]
					);

					Svg = LaCucinaUtils.strConcat(Svg, _svg);
				}
			}
		}

		(, , , , , bool isNumberedNFT, ) = traitFactory.seriesDetails(
			galaxyItem.galaxyItemId,
			galaxyItem.seriesId
		);

		// add nft number if applicable
		if (isNumberedNFT) {
			Svg = LaCucinaUtils.strConcat(Svg, traitFactory.getSvgNumber(_tokenId));
		}

		// show badge
		string memory badge = traitFactory.getSvgBadge(galaxyItem.likes);

		if (bytes(badge).length > 0) Svg = LaCucinaUtils.strConcat(Svg, badge);

		// show total likes
		if (galaxyItem.likes > 0)
			Svg = LaCucinaUtils.strConcat(Svg, traitFactory.getSvgLikes(galaxyItem.likes));

		Svg = LaCucinaUtils.strConcat(Svg, '</svg>');
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
 	*/

	/**
	 * @notice This method allows anyone to generate a unique galaxyItem and mints the NFT token to user.
	 * @return tokenId returns the new galaxyItem id.
	 */
	function _generateGalaxyItem(
		uint256 _galaxyItemId,
		uint256 _seriesId,
		address _user,
		bool _withAccessories
	) internal virtual returns (uint256 tokenId) {
		(, , , uint256 maxNfts, uint256 totalNftsMinted, , uint8 totalTraits) = traitFactory
			.seriesDetails(_galaxyItemId, _seriesId);

		require(totalNftsMinted <= maxNfts, 'ERR18');

		uint256 traitVariationHash = _getHash(_galaxyItemId, _seriesId, totalTraits);

		bytes32 hash = keccak256(abi.encodePacked(_seriesId, uint8(totalTraits), traitVariationHash));

		// get unique hash for the trait
		while (galaxyItemHash[_galaxyItemId][hash]) {
			traitVariationHash = _getHash(_galaxyItemId, _seriesId, totalTraits);
			hash = keccak256(abi.encodePacked(_seriesId, uint8(totalTraits), traitVariationHash));
		}

		galaxyItemHash[_galaxyItemId][hash] = true;

		// mint galaxyItem
		tokenId = mint(_user);

		if (_withAccessories) {
			uint256 _totalTypes = accessories.totalAccessoryTypes(_galaxyItemId);

			require(_totalTypes > 0, 'ERR19');

			// get initial accessories
			_getAccessories(_galaxyItemId, _seriesId, _totalTypes);

			galaxyItems[tokenId] = GalaxyItem(
				_galaxyItemId,
				_seriesId,
				0,
				uint8(totalTraits),
				traitVariationHash,
				_totalTypes
			);
		} else {
			// generate galaxyItem without accessories
			galaxyItems[tokenId] = GalaxyItem(
				_galaxyItemId,
				_seriesId,
				0,
				uint8(totalTraits),
				traitVariationHash,
				0
			);
		}

		//increament minted token counter for generation
		traitFactory.updateTotalNftsMinted(_galaxyItemId, _seriesId, 1);

		galaxyItemTotalNfts[_galaxyItemId] += 1;

		galaxyItemNftIds[_galaxyItemId].push(tokenId);

		emit TalienCreated(tokenId, _user, block.timestamp);
	}

	function _getAccessories(
		uint256 _galaxyItemId,
		uint256 _series,
		uint256 _totalTypes
	) internal {
		require(_galaxyItemId <= accessories.getCurrentGalaxyItemId(), 'ERR20');

		for (uint256 accessoryType = 1; accessoryType <= _totalTypes; accessoryType++) {
			uint256 totalAccessories = accessories.getTotalAccessories(
				_galaxyItemId,
				_series,
				accessoryType
			);
			require(totalAccessories > 0, 'ERR21');

			uint256 accessoryId = _getRandomAccessory(
				_galaxyItemId,
				_series,
				accessoryType,
				totalAccessories
			);

			require(accessoryId > 0 && accessoryId <= accessories.getCurrentNftId(), 'ERR22');

			accessoryIds[getCurrentTokenId()][accessoryType] = accessoryId;

			// mint accessory for user
			accessories.mint(address(this), accessoryId, 1);

			nonce++;
		}
	}

	function _getHash(
		uint256 _galaxyItemId,
		uint256 _seriesId,
		uint8 totalTraits
	) internal virtual returns (uint256 traitVariationHash) {
		for (uint8 i = 0; i < totalTraits; i++) {
			uint256 traitId = traitFactory.getSeriesTraitId(_galaxyItemId, _seriesId, i);

			uint256 totalVariations = traitFactory.getTotalVariationsForTrait(
				_galaxyItemId,
				_seriesId,
				traitId
			);

			require(totalVariations > 0, 'ERR23');

			uint256 variationId = _getRandomTraitVariation(
				_galaxyItemId,
				_seriesId,
				traitId,
				totalVariations
			);

			require(variationId > 0 && variationId <= traitFactory.getCurrentTraitVariationId(), 'ERR24');
			traitVariationHash += variationId * 256**i;

			//increment nonce
			nonce++;
		}
	}

	function _getRandomAccessory(
		uint256 _galaxyItemId,
		uint256 _seriesId,
		uint256 _accessoryTypeId,
		uint256 _totalAccessories
	) internal view returns (uint256) {
		uint256 initialAccessoryId = accessories.getAccessoryId(
			_galaxyItemId,
			_seriesId,
			_accessoryTypeId,
			0
		);

		if (_totalAccessories == 1) {
			return initialAccessoryId;
		}

		// Create and fill prefix array
		uint256[] memory prefix = new uint256[](_totalAccessories);

		(, , , , , , uint256 probability) = accessories.accessories(initialAccessoryId);

		prefix[0] = probability;

		for (uint256 i = 1; i < _totalAccessories; ++i) {
			(, , , , , , probability) = accessories.accessories(
				accessories.getAccessoryId(_galaxyItemId, _seriesId, _accessoryTypeId, i)
			);

			prefix[i] = prefix[i - 1] + probability;
		}

		return
			accessories.getAccessoryId(
				_galaxyItemId,
				_seriesId,
				_accessoryTypeId,
				_getIndex(prefix, _totalAccessories)
			);
	}

	function _getRandomTraitVariation(
		uint256 _galaxyItemId,
		uint256 _seriesId,
		uint256 _traitId,
		uint256 _totalVariations
	) internal view returns (uint256) {
		uint256 initialVariationId = traitFactory.getVariationsId(
			_galaxyItemId,
			_seriesId,
			_traitId,
			0
		);
		if (_totalVariations == 1) {
			return initialVariationId;
		}

		// Create and fill prefix array
		uint256[] memory prefix = new uint256[](_totalVariations);

		(, , , , , uint256 probability) = traitFactory.traitVariations(initialVariationId);

		prefix[0] = probability;

		for (uint256 i = 1; i < _totalVariations; ++i) {
			(, , , , , probability) = traitFactory.traitVariations(
				traitFactory.getVariationsId(_galaxyItemId, _seriesId, _traitId, i)
			);

			prefix[i] = prefix[i - 1] + probability;
		}

		return
			traitFactory.getVariationsId(
				_galaxyItemId,
				_seriesId,
				_traitId,
				_getIndex(prefix, _totalVariations)
			);
	}

	function _getIndex(uint256[] memory prefix, uint256 n) internal view returns (uint256 index) {
		// prefix[n-1] is sum of all frequencies.
		// Generate a random number with
		// value from 1 to this sum
		uint256 r = LaCucinaUtils.getRandomVariation(nonce, prefix[n - 1]) + 1;

		// Find index of ceiling of r in prefix array
		index = LaCucinaUtils.findCeil(prefix, r, 0, n - 1);

		require(index < n, 'ERR25');
	}

	function onERC1155Received(
		address,
		address,
		uint256,
		uint256,
		bytes memory
	) public virtual override returns (bytes4) {
		return this.onERC1155Received.selector;
	}

	function onERC1155BatchReceived(
		address,
		address,
		uint256[] memory,
		uint256[] memory,
		bytes memory
	) public virtual override returns (bytes4) {
		return this.onERC1155BatchReceived.selector;
	}

	/**
	 * @dev See {IERC165-supportsInterface}.
	 */
	function supportsInterface(bytes4 interfaceId)
		public
		view
		virtual
		override(BaseERC721WithRoyalties, ERC1155ReceiverUpgradeable)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}
