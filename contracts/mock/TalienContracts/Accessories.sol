// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../BaseERC1155WithRoyalties.sol';

contract Accessories is BaseERC1155WithRoyalties {
	using CountersUpgradeable for CountersUpgradeable.Counter;

	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
 	*/
	struct GalaxyItem {
		string name;
	}

	struct AccessoryTypeDetail {
		uint256 galaxyItemId;
		string accessoryTypeName;
	}

	struct AccessoryDetail {
		uint256 galaxyItemId;
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

	CountersUpgradeable.Counter private galaxyItemCounter;

	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	// userAddress => isExcepted?
	mapping(address => bool) public exceptedAddresses;
	// userAddress => isExceptedFrom?
	mapping(address => bool) public exceptedFromAddresses;

	// galaxyItemId => GalaxyItem
	mapping(uint256 => GalaxyItem) public galaxyItems;

	// galaxyItemId => accessoryTypeId => AccessoryTypeDetail
	mapping(uint256 => mapping(uint256 => AccessoryTypeDetail)) public accessoryTypes;

	// accessoryId => AccessoryDetails
	mapping(uint256 => AccessoryDetail) public accessories;

	// galaxyItemId => accessoryType
	mapping(uint256 => uint256) public totalAccessoryTypes;

	// galaxyItemId => seriesId => => AccessoryType => totalAccessories
	mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) public totalAccessories;

	// galaxyItemId => seriesId => => AccessoryType => AccessoryIds
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
	event GalaxyItemAdded(uint256 itemId);
	event AccessoryTypeAdded(uint256 typeId);
	event AccessoryAdded(uint256 accessoryId);
	event AccessoryTypeUpdated(uint256 accessoryTypeId);
	event AccessoryUpdated(uint256 accessoryId);

	/*
   	=======================================================================
   	======================== Modifiers ====================================
   	=======================================================================
 	*/

	modifier onlyValidGalaxyItemId(uint256 _galaxyItemId) {
		require(
			_galaxyItemId > 0 && _galaxyItemId <= galaxyItemCounter.current(),
			'Accessories: INVALID_ITEM_ID'
		);
		_;
	}

	modifier onlyValidAccessoryType(uint256 _galaxyItemId, uint256 _accessoryTypeId) {
		require(
			_accessoryTypeId > 0 && _accessoryTypeId <= totalAccessoryTypes[_galaxyItemId],
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
	 * @notice This method allows operator to add the galaxy item
	 * @param _itemName  - indicates the item name
	 * @return galaxyItemId - indicates the galaxy item id
	 */
	function addGalaxyItem(string memory _itemName)
		external
		virtual
		onlyOperator
		onlyValidName(_itemName)
		returns (uint256 galaxyItemId)
	{
		galaxyItemCounter.increment();
		galaxyItemId = galaxyItemCounter.current();

		galaxyItems[galaxyItemId].name = _itemName;
		emit GalaxyItemAdded(galaxyItemId);
	}

	/**
	 * @notice This method allows operator to add the type for the galaxy item
	 * @param _galaxyItemId - indicates the item id
	 * @param _typeName - indicates the accessory type name
	 * @return accessoryTypeId - indicates accessory type id for particular galaxy item
	 */
	function addAccessoryType(uint256 _galaxyItemId, string memory _typeName)
		public
		virtual
		onlyOperator
		onlyValidGalaxyItemId(_galaxyItemId)
		onlyValidName(_typeName)
		returns (uint256 accessoryTypeId)
	{
		totalAccessoryTypes[_galaxyItemId] += 1;
		accessoryTypeId = totalAccessoryTypes[_galaxyItemId];

		accessoryTypes[_galaxyItemId][accessoryTypeId].galaxyItemId = _galaxyItemId;
		accessoryTypes[_galaxyItemId][accessoryTypeId].accessoryTypeName = _typeName;

		emit AccessoryTypeAdded(accessoryTypeId);
	}

	/**
	 * @notice This method allows operator to add the accessory for the accessory type
	 * @param _galaxyItemId - indicates the galaxy item to which accessory belongs
	 * @param _accessoryTypeId - indicates the accessory type id to which accessory belongs
	 * @param _seriesId - indicates the series of galaxy item to which the accessory will be applicable
	 * @param _name - indicates the name of the accessory
	 * @param _svg - indicates the svg for the accessory
	 * @param _user - indicates the account address to which these nfts will be minted
	 * @param _amount - indicates the amount of accessory nfts to mint.
	 * @param _probability - indicates the probability of the accessory to appear
	 */
	function addAccessory(
		uint256 _galaxyItemId,
		uint256 _accessoryTypeId,
		uint256 _seriesId,
		string memory _name,
		string memory _svg,
		address _user,
		uint256 _amount,
		uint256 _probability
	) external virtual onlyMinter returns (uint256 accessoryId) {
		accessoryId = _addAccessory(
			_galaxyItemId,
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
	 * @param _galaxyItemId - indicates the galaxy item to which accessory will belong
	 * @param _seriesId - indicates the series of galaxy item to which the accessory will be applicable
	 * @param _typeName - indicates the accessory type name
	 * @param _name - indicates the name of the accessories
	 * @param _svg - indicates the svg for the accessories
	 * @param _user - indicates the account address to which these nfts will be minted
	 * @param _amount - indicates the amount of accessories nfts to mint.
	 * @param _probabilities - indicates the _probabilities of the accessories to appear
	 */
	function addAccessoriesWithType(
		uint256 _galaxyItemId,
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

		accessoryTypeId = addAccessoryType(_galaxyItemId, _typeName);

		for (uint256 i = 0; i < _name.length; i++) {
			_addAccessory(
				_galaxyItemId,
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
		require(bytes(_svg).length > 0, 'Accessories: INVALID_SVG');

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
	) external virtual onlyMinter onlyValidNftId(_accessoryId) {
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
	 * @notice This method returns the total accessories of particular accessory type, series and galaxy item
	 */
	function getTotalAccessories(
		uint256 _galaxyItemId,
		uint256 _series,
		uint256 _typeId
	)
		external
		view
		virtual
		onlyValidGalaxyItemId(_galaxyItemId)
		onlyValidAccessoryType(_galaxyItemId, _typeId)
		returns (uint256)
	{
		return totalAccessories[_galaxyItemId][_series][_typeId];
	}

	/**
	 * @notice This method returns the accessory id at given index from the list of accessory ids belonging to particular accessory type.
	 */
	function getAccessoryId(
		uint256 _galaxyItemId,
		uint256 _series,
		uint256 _typeId,
		uint256 _index
	)
		external
		view
		virtual
		onlyValidGalaxyItemId(_galaxyItemId)
		onlyValidAccessoryType(_galaxyItemId, _typeId)
		returns (uint256)
	{
		require(
			_index < totalAccessories[_galaxyItemId][_series][_typeId],
			'Accessories: INVALID_INDEX'
		);
		return accessoryIds[_galaxyItemId][_series][_typeId][_index];
	}

	/**
	 * @notice This method returns the current galaxy item id
	 */
	function getCurrentGalaxyItemId() external view virtual returns (uint256) {
		return galaxyItemCounter.current();
	}

	/*
   	=======================================================================
   	======================== Internal Methods =============================
   	=======================================================================
 	*/
	function _addAccessory(
		uint256 _galaxyItemId,
		uint256 _accessoryTypeId,
		string memory _name,
		string memory _svg,
		address _user,
		uint256 _amount,
		uint256 _series,
		uint256 _probability
	)
		internal
		onlyValidGalaxyItemId(_galaxyItemId)
		onlyValidName(_name)
		onlyValidAccessoryType(_galaxyItemId, _accessoryTypeId)
		returns (uint256 accessoryId)
	{
		require(bytes(_svg).length > 0, 'Accessories: INVALID_SVG');
		require(_user != address(0), 'Accessories: INVALID_ADDRESS');
		require(_amount > 0, 'Accessories: INVALID_AMOUNT');
		require(_series > 0, 'Accessories: INVALID_SERIES');

		// generate accessoryId
		tokenCounter.increment();
		accessoryId = tokenCounter.current();

		// add accessory supported for any series
		accessories[accessoryId] = AccessoryDetail(
			_galaxyItemId,
			accessoryId,
			_accessoryTypeId,
			_name,
			_svg,
			_series,
			_probability
		);

		totalAccessories[_galaxyItemId][_series][_accessoryTypeId] += 1;
		accessoryIds[_galaxyItemId][_series][_accessoryTypeId].push(accessoryId);

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
