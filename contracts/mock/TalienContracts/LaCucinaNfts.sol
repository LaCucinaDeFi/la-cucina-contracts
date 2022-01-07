// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';

import './BaseERC721WithRoyalties.sol';
import '../../interfaces/IAccessories.sol';
import '../../interfaces/ITraitFactory.sol';

contract LaCucinaNfts is BaseERC721WithRoyalties, ERC1155ReceiverUpgradeable {
	using CountersUpgradeable for CountersUpgradeable.Counter;
	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
	*/
	struct Item {
		uint256 itemId;
		uint256 seriesId;
		uint256 likes;
		uint8 totalTraits;
		uint256 traitVariationHash;
		uint256 totalAccessoryTypes;
	}
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
	/// @notice address to which all the funds are transfer
	address public fundReceiver;
	/// @notice  NftId  => Item
	mapping(uint256 => Item) public items;
	/// @notice  itemId  => totalNfts
	mapping(uint256 => uint256) public itemTotalNfts;
	/// @notice  itemId  => nftIds
	mapping(uint256 => uint256[]) public itemNftIds;
	/// @notice tokenId => AccessoryTypeId => AccessoryId
	mapping(uint256 => mapping(uint256 => uint256)) public accessoryIds;
	/// @notice userAddress => likes
	mapping(address => uint256) public userTotalLikes;
	/// @notice userAddress => nftToken => liked/unliked
	mapping(address => mapping(uint256 => bool)) public userLikedNFTs;

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
	 * ERR19 - 'Talien: INSUFFICIENT_ACCESSORY_TYPES'
	 * ERR20 - 'Talien: INVALID_ITEM_FOR_ACCESSORY'
	 * ERR21 - 'Talien: INSUFFICIENT_ACCESSORIES'
	 * ERR22 - 'Talien: INVALID_ACCESSORY'
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
	 * @param _user - indicates the user address to whom mint the free item
	 * @param _itemId - indicates the type of item you want to generate ex. talion, spaceship
	 * @param _seriesId - indicates the series of item
	 * @param _withAccessory - indicates whether to generate item with accessory or without
	 * @return tokenId - indicates the generated token id
	 */
	function claim(
		address _user,
		uint256 _itemId,
		uint256 _seriesId,
		bool _withAccessory
	) external virtual onlyMinter returns (uint256 tokenId) {
		tokenId = _generateItem(_itemId, _seriesId, _user, _withAccessory);
	}

	/**
	 * @notice This method allows anyone to generate a unique item with/without accessories and mints the NFT token to user.
	 * @return tokenId returns the new item id.
	 */
	function generateItem(
		uint256 _itemId,
		uint256 _seriesId,
		bool _withAccessory
	) external virtual onlyValidUser nonReentrant returns (uint256) {
		if (_withAccessory) {
			// get the lac tokens from the user
			require(
				feeToken.transferFrom(msg.sender, fundReceiver, traitFactory.generationFeeWithAccessory())
			);
		} else {
			// get the lac tokens from the user
			require(
				feeToken.transferFrom(
					msg.sender,
					fundReceiver,
					traitFactory.generationFeeWithoutAccessory()
				)
			);
		}
		return _generateItem(_itemId, _seriesId, msg.sender, _withAccessory);
	}

	/**
	 * @notice This method allows item owner to update the item accessory
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
		(uint256 itemId, , uint256 typeId, , , uint256 series, ) = accessories.accessories(
			_accessoryId
		);
		Item storage item = items[_tokenId];
		require(series == item.seriesId, 'ERR9');
		require(itemId == item.itemId, 'ERR10');
		// add new type of accessory
		if (accessoryIds[_tokenId][typeId] == 0) {
			item.totalAccessoryTypes = item.totalAccessoryTypes + 1;
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
		// update accessory item
		accessoryIds[_tokenId][typeId] = _accessoryId;
	}

	/**
	 * @notice This method allows item owner to remove the item accessory
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
				_accessoryType <= accessories.totalAccessoryTypes(items[_tokenId].itemId),
			'ERR26'
		);
		uint256 accessoryId = accessoryIds[_tokenId][_accessoryType];
		require(accessoryId > 0 && accessoryId <= accessories.getCurrentNftId(), 'ERR27');
		accessoryIds[_tokenId][_accessoryType] = 0;
		// return existing nft to user
		accessories.safeTransferFrom(address(this), msg.sender, accessoryId, 1, '');
	}

	/**
	 * @notice This method allows users to like the item. One user can have maximum 3 likes
	 * @param _tokenId - indicates the item nft token id
	 */
	function likeItem(uint256 _tokenId) external virtual onlyValidTokenId(_tokenId) {
		require(userTotalLikes[msg.sender] < 3, 'ERR12');
		require(!userLikedNFTs[msg.sender][_tokenId], 'ERR13');
		items[_tokenId].likes += 1;
		userTotalLikes[msg.sender] += 1;
		userLikedNFTs[msg.sender][_tokenId] = true;
		emit Liked(_tokenId, msg.sender);
	}

	/**
	 * @notice This method allows users to dislike/unlike the item
	 * @param _tokenId - indicates the item nft token id
	 */
	function unLikeItem(uint256 _tokenId) external virtual onlyValidTokenId(_tokenId) {
		require(userLikedNFTs[msg.sender][_tokenId], 'ERR14');
		items[_tokenId].likes -= 1;
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
	 * This method tells the name of the item for given token id
	 */
	function whatAmI(uint256 _tokenId)
		external
		view
		virtual
		onlyValidTokenId(_tokenId)
		returns (
			string memory itemName,
			string memory seriesName,
			uint256 maxNfts,
			uint256 totalNftsMinted,
			uint256 totalTraits,
			uint256 totalAccessoryTypes,
			uint256 likes
		)
	{
		itemName = traitFactory.items(items[_tokenId].itemId);
		(, , seriesName, maxNfts, totalNftsMinted, , ) = traitFactory.seriesDetails(
			items[_tokenId].itemId,
			items[_tokenId].seriesId
		);
		totalTraits = items[_tokenId].totalTraits;
		totalAccessoryTypes = items[_tokenId].totalAccessoryTypes;
		likes = items[_tokenId].likes;
	}

	/**
	 * @notice This method allows users to get the svg for the item .
	 * @param _tokenId - indicates the item id
	 * @return Svg -  returns the item  svg
	 */
	function getPicture(uint256 _tokenId)
		external
		view
		virtual
		onlyValidTokenId(_tokenId)
		returns (string memory Svg)
	{
		Item memory item = items[_tokenId];
		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 genSlottedValue;
		uint256 traitVariationId;
		uint256 slotMultiplier;
		Svg = '<svg xmlns="http://www.w3.org/2000/svg" width="580" height="580">';
		for (uint8 slot = 0; slot < item.totalTraits; slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			genSlottedValue = item.traitVariationHash & bitMask; // Extract slotted value from hash
			if (genSlottedValue > 0) {
				traitVariationId = (slot > 0) // Extract IngredientID from slotted value
					? genSlottedValue / slotMultiplier
					: genSlottedValue;
				require(
					traitVariationId > 0 && traitVariationId <= traitFactory.getCurrentTraitVariationId(),
					'ERR17'
				);
				(, , , , string memory variationSvg, ) = traitFactory.traitVariations(traitVariationId);
				Svg = strConcat(Svg, variationSvg);
			}
		}
		// get Accessories svgs
		if (item.totalAccessoryTypes > 0) {
			for (
				uint256 accessorytType = 1;
				accessorytType <= item.totalAccessoryTypes;
				accessorytType++
			) {
				if (accessoryIds[_tokenId][accessorytType] != 0) {
					(, , , , string memory _svg, , ) = accessories.accessories(
						accessoryIds[_tokenId][accessorytType]
					);
					Svg = strConcat(Svg, _svg);
				}
			}
		}
		(, , , , , bool isNumberedNFT, ) = traitFactory.seriesDetails(item.itemId, item.seriesId);
		// add nft number if applicable
		if (isNumberedNFT) {
			Svg = strConcat(Svg, traitFactory.getSvgNumber(_tokenId));
		}
		// show badge
		string memory badge = traitFactory.getSvgBadge(item.likes);
		if (bytes(badge).length > 0) Svg = strConcat(Svg, badge);
		// show total likes
		if (item.likes > 0) Svg = strConcat(Svg, traitFactory.getSvgLikes(item.likes));
		Svg = strConcat(Svg, '</svg>');
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
 	*/

	/**
	 * @notice This method allows anyone to generate a unique item and mints the NFT token to user.
	 * @return tokenId returns the new item id.
	 */
	function _generateItem(
		uint256 _itemId,
		uint256 _seriesId,
		address _user,
		bool _withAccessories
	) internal virtual returns (uint256 tokenId) {
		(uint256 traitVariationHash, uint256 totalTraits) = traitFactory.getTraitVariationHash(
			_itemId,
			_seriesId
		);
		// mint item
		tokenId = mint(_user);
		if (_withAccessories) {
			uint256 _totalTypes = accessories.totalAccessoryTypes(_itemId);
			require(_totalTypes > 0, 'ERR19');
			// get initial accessories
			_getAccessories(_itemId, _seriesId, _totalTypes);
			items[tokenId] = Item(
				_itemId,
				_seriesId,
				0,
				uint8(totalTraits),
				traitVariationHash,
				_totalTypes
			);
		} else {
			// generate item without accessories
			items[tokenId] = Item(_itemId, _seriesId, 0, uint8(totalTraits), traitVariationHash, 0);
		}
		//increament minted token counter for generation
		traitFactory.updateTotalNftsMinted(_itemId, _seriesId, 1);
		itemTotalNfts[_itemId] += 1;
		itemNftIds[_itemId].push(tokenId);
		emit TalienCreated(tokenId, _user, block.timestamp);
	}

	function _getAccessories(
		uint256 _itemId,
		uint256 _series,
		uint256 _totalTypes
	) internal {
		for (uint256 accessoryType = 1; accessoryType <= _totalTypes; accessoryType++) {
			(uint256 accessoryId, string memory svg) = accessories.getAccessories(
				_itemId,
				_series,
				accessoryType
			);
			// mint accessory only if it is non empty
			if (bytes(svg).length > 0) {
				accessoryIds[getCurrentTokenId()][accessoryType] = accessoryId;
				// mint accessory for user
				accessories.mint(address(this), accessoryId, 1);
			}
		}
	}

	/**
	 * @notice Concatenate two strings
	 * @param _a the first string
	 * @param _b the second string
	 * @return result the concatenation of `_a` and `_b`
	 */
	function strConcat(string memory _a, string memory _b)
		internal
		pure
		returns (string memory result)
	{
		result = string(abi.encodePacked(bytes(_a), bytes(_b)));
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
