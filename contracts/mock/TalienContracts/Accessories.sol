// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../BaseERC1155WithRoyalties.sol';
import '../../library/LaCucinaUtils.sol';

contract Accessories is BaseERC1155WithRoyalties {
	using CountersUpgradeable for CountersUpgradeable.Counter;
	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
 	*/
	struct Item {
		string name;
	}
	struct AccessoryTypeDetail {
		uint256 itemId;
		string accessoryTypeName;
	}
	struct AccessoryDetail {
		uint256 itemId;
		uint256 accessoryId;
		uint256 typeId; // ex. head / body / holding accessories
		string name;
		string svg;
		uint256 series; //  1 to n -> series number
		uint256 probability;
	}
	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	uint256 nonce;
	CountersUpgradeable.Counter private itemCounter;
	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	// userAddress => isExcepted?
	mapping(address => bool) public exceptedAddresses;
	// userAddress => isExceptedFrom?
	mapping(address => bool) public exceptedFromAddresses;
	// itemId => Item
	mapping(uint256 => Item) public items;
	// itemId => accessoryTypeId => AccessoryTypeDetail
	mapping(uint256 => mapping(uint256 => AccessoryTypeDetail)) public accessoryTypes;
	// accessoryId => AccessoryDetails
	mapping(uint256 => AccessoryDetail) public accessories;
	// itemId => accessoryType
	mapping(uint256 => uint256) public totalAccessoryTypes;
	// itemId => seriesId => => AccessoryType => totalAccessories
	mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) public totalAccessories;
	// itemId => seriesId => => AccessoryType => AccessoryIds
	mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256[]))) public accessoryIds;

	/*
   	=======================================================================
   	======================== Constructor/Initializer ======================
   	=======================================================================
 	*/
	function initialize(
		string memory _baseTokenURI,
		address _royaltyReceiver,
		uint8 _royaltyFee
	) public virtual initializer {
		initialize_BaseERC1155WithRoyalties(_baseTokenURI, _royaltyReceiver, _royaltyFee);
	}

	/*
   	=======================================================================
   	======================== Events =======================================
   	=======================================================================
 	*/
	event ItemAdded(uint256 itemId);
	event AccessoryTypeAdded(uint256 typeId);
	event AccessoryAdded(uint256 accessoryId);
	event AccessoryTypeUpdated(uint256 accessoryTypeId);
	event AccessoryUpdated(uint256 accessoryId);

	/*
   	=======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/
	modifier onlyValidItemId(uint256 _itemId) {
		require(_itemId > 0 && _itemId <= itemCounter.current(), 'Accessories: INVALID_ITEM_ID');
		_;
	}
	modifier onlyValidAccessoryType(uint256 _itemId, uint256 _accessoryTypeId) {
		require(
			_accessoryTypeId > 0 && _accessoryTypeId <= totalAccessoryTypes[_itemId],
			'Accessories: INVALID_TYPE_ID'
		);
		_;
	}
	modifier onlyValidName(string memory _name) {
		require(bytes(_name).length > 0, 'Accessories: INVALID_NAME');
		_;
	}

	/*
   	=======================================================================
   	======================== Public Methods ===============================
   	=======================================================================
 	*/
	/**
	 * @notice This method allows operator to add the item
	 * @param _itemName  - indicates the item name
	 * @return itemId - indicates the item id
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
	 * @notice This method allows operator to add the type for the item
	 * @param _itemId - indicates the item id
	 * @param _typeName - indicates the accessory type name
	 * @return accessoryTypeId - indicates accessory type id for particular item
	 */
	function addAccessoryType(uint256 _itemId, string memory _typeName)
		public
		virtual
		onlyOperator
		onlyValidItemId(_itemId)
		onlyValidName(_typeName)
		returns (uint256 accessoryTypeId)
	{
		totalAccessoryTypes[_itemId] += 1;
		accessoryTypeId = totalAccessoryTypes[_itemId];
		accessoryTypes[_itemId][accessoryTypeId].itemId = _itemId;
		accessoryTypes[_itemId][accessoryTypeId].accessoryTypeName = _typeName;
		emit AccessoryTypeAdded(accessoryTypeId);
	}

	/**
	 * @notice This method allows operator to add the accessory for the accessory type
	 * @param _itemId - indicates the item to which accessory belongs
	 * @param _accessoryTypeId - indicates the accessory type id to which accessory belongs
	 * @param _seriesId - indicates the series of item item to which the accessory will be applicable
	 * @param _name - indicates the name of the accessory
	 * @param _svg - indicates the svg for the accessory
	 * @param _user - indicates the account address to which these nfts will be minted
	 * @param _amount - indicates the amount of accessory nfts to mint.
	 * @param _probability - indicates the probability of the accessory to appear
	 */
	function addAccessory(
		uint256 _itemId,
		uint256 _accessoryTypeId,
		uint256 _seriesId,
		string memory _name,
		string memory _svg,
		address _user,
		uint256 _amount,
		uint256 _probability
	) external virtual onlyMinter returns (uint256 accessoryId) {
		accessoryId = _addAccessory(
			_itemId,
			_accessoryTypeId,
			_name,
			_svg,
			_user,
			_amount,
			_seriesId,
			_probability
		);
	}

	/**
	 * @notice This method allows operator to add the multiple accessories with the accessory type
	 * @param _itemId - indicates the item to which accessory will belong
	 * @param _seriesId - indicates the series of item item to which the accessory will be applicable
	 * @param _typeName - indicates the accessory type name
	 * @param _name - indicates the name of the accessories
	 * @param _svg - indicates the svg for the accessories
	 * @param _user - indicates the account address to which these nfts will be minted
	 * @param _amount - indicates the amount of accessories nfts to mint.
	 * @param _probabilities - indicates the _probabilities of the accessories to appear
	 */
	function addAccessoriesWithType(
		uint256 _itemId,
		uint256 _seriesId,
		string memory _typeName,
		string[] memory _name,
		string[] memory _svg,
		address _user,
		uint256[] memory _amount,
		uint256[] memory _probabilities
	) external virtual onlyOperator returns (uint256 accessoryTypeId) {
		require(
			_name.length > 0 &&
				_name.length == _svg.length &&
				_name.length == _amount.length &&
				_name.length == _probabilities.length,
			'Accessories: INVALID_ACCESSORY_DETAILS'
		);
		accessoryTypeId = addAccessoryType(_itemId, _typeName);
		for (uint256 i = 0; i < _name.length; i++) {
			_addAccessory(
				_itemId,
				accessoryTypeId,
				_name[i],
				_svg[i],
				_user,
				_amount[i],
				_seriesId,
				_probabilities[i]
			);
		}
	}

	/**
	 * @notice This method allows operator to update the accessory details
	 * @param _accessoryId - indicates the accessory id
	 * @param _name - indicates the name of the accessory
	 * @param _svg - indicates the svg for accessory
	 * @param _probability - indicates the probability of the accessory to appear
	 */
	function updateAccessory(
		uint256 _accessoryId,
		string memory _name,
		string memory _svg,
		uint256 _probability
	) external virtual onlyOperator onlyValidNftId(_accessoryId) onlyValidName(_name) {
		accessories[_accessoryId].name = _name;
		accessories[_accessoryId].svg = _svg;
		accessories[_accessoryId].probability = _probability;
		emit AccessoryUpdated(_accessoryId);
	}

	/**
	 * @notice This method allows admin to except the addresses to have multiple tokens of same NFT.
	 * @param _account indicates the address to add.
	 */
	function addExceptedAddress(address _account) external virtual onlyOperator {
		require(!exceptedAddresses[_account], 'Accessories: ALREADY_ADDED');
		exceptedAddresses[_account] = true;
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses from having multiple tokens of same NFT.
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedAddress(address _account) external virtual onlyOperator {
		require(exceptedAddresses[_account], 'Accessories: ALREADY_REMOVED');
		exceptedAddresses[_account] = false;
	}

	/**
	 * @notice This method allows admin to except the from addresses so that user can receive the multiple same nft tokens.
	 * @param _account indicates the address to add.
	 */
	function addExceptedFromAddress(address _account) external virtual onlyOperator {
		require(!exceptedFromAddresses[_account], 'Accessories: ALREADY_ADDED');
		exceptedFromAddresses[_account] = true;
	}

	/**
	 * @notice This method allows admin to remove the excepted addresses .
	 * @param _account indicates the address to remove.
	 */
	function removeExceptedFromAddress(address _account) external virtual onlyOperator {
		require(exceptedFromAddresses[_account], 'Accessories: ALREADY_REMOVED');
		exceptedFromAddresses[_account] = false;
	}

	/**
	 * @notice This method allows minter to mint the accessories to given account
	 * @param _account - indicates the account to which accessories will be minted
	 * @param _accessoryId - indicates the id of accessory to mint
	 * @param  _amount - indicates the amount of nfts to mint
	 */
	function mint(
		address _account,
		uint256 _accessoryId,
		uint256 _amount
	) external virtual override onlyMinter onlyValidNftId(_accessoryId) {
		require(_account != address(0), 'Accessories: INVALID_ACCOUNT');
		require(_amount > 0, 'Accessories: INVALID_AMOUNT');
		_mint(_account, _accessoryId, _amount, '');
	}

	/*
   	=======================================================================
   	======================== Getter Methods ===============================
   	=======================================================================
 	*/
	/**
	 * @notice This method returns the
	 */
	function getAccessories(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _accessoryTypeId
	)
		external
		virtual
		onlyMinter
		onlyValidItemId(_itemId)
		onlyValidAccessoryType(_itemId, _accessoryTypeId)
		returns (uint256 accessoryId, string memory svg)
	{
		uint256 _totalAccessories = totalAccessories[_itemId][_seriesId][_accessoryTypeId];
		require(_totalAccessories > 0, 'Accessories: INSUFFICIENT_ACCESSORIES');

		accessoryId = _getRandomAccessory(_itemId, _seriesId, _accessoryTypeId, _totalAccessories);

		require(
			accessoryId > 0 && accessoryId <= tokenCounter.current(),
			'Accessories: INVALID_ACCESSORY_ID'
		);

		svg = accessories[accessoryId].svg;
	}

	function _getRandomAccessory(
		uint256 _itemId,
		uint256 _seriesId,
		uint256 _accessoryTypeId,
		uint256 _totalAccessories
	) internal view returns (uint256 accessoryId) {
		uint256 initialAccessoryId = accessoryIds[_itemId][_seriesId][_accessoryTypeId][0];

		if (_totalAccessories == 1) {
			return initialAccessoryId;
		}

		// Create and fill prefix array
		uint256[] memory prefix = new uint256[](_totalAccessories);

		prefix[0] = accessories[initialAccessoryId].probability;

		for (uint256 i = 1; i < _totalAccessories; ++i) {
			prefix[i] =
				prefix[i - 1] +
				accessories[accessoryIds[_itemId][_seriesId][_accessoryTypeId][i]].probability;
		}

		return accessoryIds[_itemId][_seriesId][_accessoryTypeId][_getIndex(prefix, _totalAccessories)];
	}

	function _getIndex(uint256[] memory prefix, uint256 n) internal view returns (uint256 index) {
		// prefix[n-1] is sum of all frequencies.
		// Generate a random number with
		// value from 1 to this sum
		uint256 r = LaCucinaUtils.getRandomVariation(nonce, prefix[n - 1]) + 1;

		// Find index of ceiling of r in prefix array
		index = LaCucinaUtils.findCeil(prefix, r, 0, n - 1);

		require(index < n, 'Accessories: INVALID_INDEX');
	}

	/**
	 * @notice This method returns the total accessories of particular accessory type, series and item
	 */
	function getTotalAccessories(
		uint256 _itemId,
		uint256 _series,
		uint256 _typeId
	)
		external
		view
		virtual
		onlyValidItemId(_itemId)
		onlyValidAccessoryType(_itemId, _typeId)
		returns (uint256)
	{
		return totalAccessories[_itemId][_series][_typeId];
	}

	/**
	 * @notice This method returns the accessory id at given index from the list of accessory ids belonging to particular accessory type.
	 */
	function getAccessoryId(
		uint256 _itemId,
		uint256 _series,
		uint256 _typeId,
		uint256 _index
	)
		external
		view
		virtual
		onlyValidItemId(_itemId)
		onlyValidAccessoryType(_itemId, _typeId)
		returns (uint256)
	{
		require(_index < totalAccessories[_itemId][_series][_typeId], 'Accessories: INVALID_INDEX');
		return accessoryIds[_itemId][_series][_typeId][_index];
	}

	/**
	 * @notice This method returns the current item id
	 */
	function getCurrentItemId() external view virtual returns (uint256) {
		return itemCounter.current();
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
 	*/
	function _addAccessory(
		uint256 _itemId,
		uint256 _accessoryTypeId,
		string memory _name,
		string memory _svg,
		address _user,
		uint256 _amount,
		uint256 _series,
		uint256 _probability
	)
		internal
		onlyValidItemId(_itemId)
		onlyValidName(_name)
		onlyValidAccessoryType(_itemId, _accessoryTypeId)
		returns (uint256 accessoryId)
	{
		require(_user != address(0), 'Accessories: INVALID_ADDRESS');
		require(_amount > 0, 'Accessories: INVALID_AMOUNT');
		require(_series > 0, 'Accessories: INVALID_SERIES');
		// generate accessoryId
		tokenCounter.increment();
		accessoryId = tokenCounter.current();
		// add accessory supported for any series
		accessories[accessoryId] = AccessoryDetail(
			_itemId,
			accessoryId,
			_accessoryTypeId,
			_name,
			_svg,
			_series,
			_probability
		);
		totalAccessories[_itemId][_series][_accessoryTypeId] += 1;
		accessoryIds[_itemId][_series][_accessoryTypeId].push(accessoryId);
		_mint(_user, accessoryId, _amount, '');
		emit AccessoryAdded(accessoryId);
	}

	/**
	 * @dev See {IERC165-_beforeTokenTransfer}.
	 */
	function _beforeTokenTransfer(
		address operator,
		address from,
		address to,
		uint256[] memory ids,
		uint256[] memory amounts,
		bytes memory data
	) internal virtual override(BaseERC1155) {
		if (!exceptedAddresses[to] && to != address(0)) {
			if (!exceptedFromAddresses[from]) {
				for (uint256 i = 0; i < ids.length; i++) {
					require(balanceOf(to, ids[i]) == 0, 'ERC1155NFT: TOKEN_ALREADY_EXIST');
				}
			}
			for (uint256 i = 0; i < amounts.length; i++) {
				require(amounts[i] == 1, 'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN');
			}
		}
		super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
	}

	uint256[50] private __gap;
}
