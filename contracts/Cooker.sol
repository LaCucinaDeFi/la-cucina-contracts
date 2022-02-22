// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';

import './interfaces/IIngredientNFT.sol';
import './interfaces/IDishesNFT.sol';
import './interfaces/IVersionedContract.sol';
import './interfaces/IBEP20.sol';
import './interfaces/ITalien.sol';

contract Cooker is
	AccessControlUpgradeable,
	ReentrancyGuardUpgradeable,
	IVersionedContract,
	ERC1155ReceiverUpgradeable,
	ERC721HolderUpgradeable
{
	using CountersUpgradeable for CountersUpgradeable.Counter;

	/*
   	=======================================================================
   	======================== Structures ===================================
   	=======================================================================
 	*/

	struct FlameDetail {
		string flameType;
		uint256 preparationDuration;
		uint256 lacCharge;
	}
	/*
   	=======================================================================
   	======================== Private Variables ============================
   	=======================================================================
 	*/
	bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

	CountersUpgradeable.Counter private flamesCounter;

	/*
   	=======================================================================
   	======================== Public Variables ============================
   	=======================================================================
 	*/
	IIngredientNFT public ingredientNft;
	IDishesNFT public dishesNft;
	IBEP20 public lacToken;
	ITalien public talien;

	// @notie uncooking fees charged to non-genesis talien holders
	uint256 public uncookingFee;

	// @notice user without talien can prepare dish with maxIngredients number of ingredients
	uint256 public maxIngredients;

	// @notice user with talien can prepare dish with maxIngredients + additionalIngredients number of ingredients
	uint256 public additionalIngredients;

	// flameId => FlameDetails
	mapping(uint256 => FlameDetail) public flames;

	// @notice indicates the address which receives the LAC fees
	address public fundReceiver;

	/*
   	=======================================================================
   	======================== Constructor/Initializer ======================
   	=======================================================================
 	*/

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 */
	function initialize(
		address _ingredientNft,
		address _dishesNft,
		address _lacToken,
		address _talien,
		uint256 _uncookingFee,
		uint256 _maxIngredients,
		uint256 _additionalIngredients,
		address _fundReceiver
	) external virtual initializer {
		require(_ingredientNft != address(0), 'Cooker: INVALID_INGREDIENT_ADDRESS');
		require(_dishesNft != address(0), 'Cooker: INVALID_DISHES_ADDRESS');
		require(_lacToken != address(0), 'Cooker: INVALID_LAC_ADDRESS');
		require(_talien != address(0), 'Cooker: INVALID_TALIEN_ADDRESS');
		require(_maxIngredients > 1 && _maxIngredients <= 32, 'Cooker: INSUFFICIENT_INGREDIENTS');

		__AccessControl_init();
		__ReentrancyGuard_init();
		__ERC1155Receiver_init();
		__ERC721Holder_init();

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

		ingredientNft = IIngredientNFT(_ingredientNft);
		dishesNft = IDishesNFT(_dishesNft);
		lacToken = IBEP20(_lacToken);
		talien = ITalien(_talien);
		uncookingFee = _uncookingFee;
		maxIngredients = _maxIngredients;
		additionalIngredients = _additionalIngredients;
		fundReceiver = _fundReceiver;
	}

	/*
   	=======================================================================
   	======================== Modifiers ====================================
 	=======================================================================
 	*/
	modifier onlyOperator() {
		require(hasRole(OPERATOR_ROLE, _msgSender()), 'Cooker: ONLY_OPERATOR_CAN_CALL');
		_;
	}

	modifier onlyValidFlameId(uint256 _flameId) {
		require(_flameId > 0 && _flameId <= flamesCounter.current(), 'Cooker: INVALID_FLAME');
		_;
	}

	modifier onlyValidDishNFTId(uint256 _dishNFTId) {
		require(
			_dishNFTId > 0 && _dishNFTId <= dishesNft.getCurrentTokenId(),
			'Cooker: INVALID_DISH_ID'
		);
		_;
	}

	/*
   	=======================================================================
   	======================== Public Methods ===============================
   	=======================================================================
 	*/
	/**
	 * @notice This method allows users to prepare a dish using more than 1 ingredients.
	 * @param _dishId - indicates base dish id
	 * @param _flameId - indicates the flame id which will indicate the preparation time for dish
	 * @param _ingredientIds - indicates the list of ingredients that you want to include in dish
	 * @return dishId - indicates the new dish id
	 */
	function cookDish(
		uint256 _dishId,
		uint256 _flameId,
		uint256[] memory _ingredientIds
	) external virtual onlyValidFlameId(_flameId) nonReentrant returns (uint256 dishId) {
		FlameDetail memory flame = flames[_flameId];
		uint256 currentIngredientId = ingredientNft.getCurrentNftId();
		uint256 maxAllowedIngredients = maxIngredients + additionalIngredients;
		uint256 totalIngredients = _ingredientIds.length;

		require(
			totalIngredients > 1 && totalIngredients <= maxAllowedIngredients,
			'Cooker: INVALID_NUMBER_OF_INGREDIENTS'
		);

		(bool hasTalien, ) = doesUserHasTalien(msg.sender);

		if (!hasTalien) {
			require(totalIngredients <= maxIngredients, 'Cooker: USER_DONT_HAVE_TALIEN');
		}

		if (flame.lacCharge > 0) // get the LAC tokens from user
		{
			require(lacToken.transferFrom(msg.sender, fundReceiver, flame.lacCharge));
		}

		// get Ingredient NFTs from user
		for (uint256 i = 0; i < totalIngredients; i++) {
			require(
				_ingredientIds[i] > 0 && _ingredientIds[i] <= currentIngredientId,
				'Cooker: INVALID_INGREDIENT_ID'
			);

			// get the Ingredient NFT from user
			ingredientNft.safeTransferFrom(msg.sender, address(this), _ingredientIds[i], 1, '');
		}

		// prepare the dish
		dishId = dishesNft.cookDish(
			msg.sender,
			_dishId,
			_flameId,
			flames[_flameId].preparationDuration,
			_ingredientIds
		);
	}

	/**
	 * @notice This method alloes users to uncook the dish by returning the dishNFT and claim back the ingredient nfts
	 * @param _dishId - indicates the id of dish to be uncooked.
	 */
	function uncookDish(uint256 _dishId) external virtual nonReentrant {
		require(isDishReadyToUncook(_dishId), 'Cooker: CANNOT_UNCOOK_WHILE_PREPARING');

		// get details of dish
		(, , uint256 totalIngredients, uint256 ingredientVariationHash, , , , , , , ) = dishesNft.dish(
			_dishId
		);

		require(dishesNft.ownerOf(_dishId) == msg.sender, 'Cooker: ONLY_DISH_OWNER_CAN_UNCOOK');

		(, bool hasGenesisTalien) = doesUserHasTalien(msg.sender);

		// get fees for uncooking if user don`t have genesis talien
		if (!hasGenesisTalien) {
			require(lacToken.transferFrom(msg.sender, fundReceiver, uncookingFee));
		}

		// get the dish nft from user
		dishesNft.transferFrom(msg.sender, address(this), _dishId);

		// uncook the dish
		dishesNft.uncookDish(_dishId);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slottedValue;
		uint256 slotMultiplier;
		uint256 siId;

		// Iterate Ingredient si hash and assemble SVG sandwich
		for (uint8 slot = 0; slot <= uint8(totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			slottedValue = ingredientVariationHash & bitMask; // Extract slotted value from hash
			if (slottedValue > 0) {
				siId = (slot > 0) // Extract siId from slotted value
					? slottedValue / slotMultiplier
					: slottedValue;

				assert(siId > 0 && siId <= ingredientNft.getCurrentNftId());

				// transfer the ingredient nft to user
				ingredientNft.safeTransferFrom(address(this), msg.sender, siId, 1, '');
			}
		}
	}

	/**
	 * @notice This method allows admin to add the flames for preparing the dish.
	 * @param _flameType - indicates the flame type name. i.e Normal, High, Radiation, Blaser
	 * @param _preparationTime - indicates the preparation time in seconds for the dish. after the preparation time dish is ready to uncook.
	 * @param _lacCharge - indicates the LAC tokens to charge for the flame
	 * @return flameId - indicates the flame id which is used while preparing a dish
	 */
	function addFlame(
		string memory _flameType,
		uint256 _preparationTime,
		uint256 _lacCharge
	) external virtual onlyOperator returns (uint256 flameId) {
		require(bytes(_flameType).length > 0, 'Cooker: INVALID_FLAME_TYPE');

		// increase flame counter
		flamesCounter.increment();
		flameId = flamesCounter.current();

		flames[flameId] = FlameDetail(_flameType, _preparationTime, _lacCharge);
	}

	/**
	 * @notice This method allows admin to update the flame details.
	 * @param _flameId - indicates the flame id to update
	 * @param _flameType - indicates the flame type name. i.e Normal, High, Radiation, Blaser
	 * @param _preparationTime - indicates the preparation time in seconds for the dish. after the preparation time dish is ready to uncook.
	 * @param _lacCharge - indicates the LAC tokens to charge for the flame
	 */
	function updateFlameDetail(
		uint256 _flameId,
		string memory _flameType,
		uint256 _preparationTime,
		uint256 _lacCharge
	) external virtual onlyOperator onlyValidFlameId(_flameId) {
		require(bytes(_flameType).length > 0, 'Cooker: INVALID_FLAME_TYPE');

		flames[_flameId] = FlameDetail(_flameType, _preparationTime, _lacCharge);
	}

	/**
	 * @notice This method allows dish holder to update the flame for preparing a dish to increase or decrease the dish preparation time.
	 * When user wants to increase the flame, he needs to pay extra LAC tokens.
	 * When user wants to decrease the flame, he receives the extra LAC tokens that he paid.
	 * User cannot update flame for the prepared dish
	 * @param _dishNFTId - indicates the dishId for which flame to udpate
	 * @param _flameId - indicates the new flame for preparing a dish
	 */
	function updateFlame(uint256 _dishNFTId, uint256 _flameId)
		external
		virtual
		onlyValidDishNFTId(_dishNFTId)
		onlyValidFlameId(_flameId)
	{
		require(!isDishReadyToUncook(_dishNFTId), 'Cooker: CANNOT_UPDATE_FLAME');

		// get details of dish
		(, , , , , , , uint256 oldFlameId, , , ) = dishesNft.dish(_dishNFTId);

		require(
			dishesNft.ownerOf(_dishNFTId) == msg.sender,
			'Cooker: ONLY_DISH_OWNER_CAN_UPDATE_FLAME'
		);
		require(_flameId != oldFlameId, 'Cooker: FLAME_ALREADY_SET');

		FlameDetail storage oldFlame = flames[oldFlameId];
		FlameDetail storage newFlame = flames[_flameId];

		// faster flame
		if (newFlame.lacCharge > oldFlame.lacCharge) {
			// get the LAC tokens from user
			require(
				lacToken.transferFrom(msg.sender, fundReceiver, newFlame.lacCharge - oldFlame.lacCharge),
				'Cooker: TRANSFER_FAILED'
			);
		}

		dishesNft.updatePreparationTime(_dishNFTId, _flameId, newFlame.preparationDuration);
	}

	/**
	 * @notice This method allows admin to update the uncooking fee
	 * @param _newFee - indicates the new uncooking fee to set
	 */
	function updateUncookingFee(uint256 _newFee) external virtual onlyOperator {
		require(_newFee != uncookingFee, 'Cooker: INVALID_FEE');
		uncookingFee = _newFee;
	}

	/**
	 * @notice This method allows admin to update the max number of ingredients for preparing a dish
	 * @param _maxIngredients - indicates the new uncooking fee to set
	 */
	function updateMaxIngredients(uint256 _maxIngredients) external virtual onlyOperator {
		require(
			_maxIngredients > 1 && _maxIngredients != maxIngredients && _maxIngredients <= 32,
			'Cooker: INVALID_INGREDIENTS'
		);
		maxIngredients = _maxIngredients;
	}

	/**
	 * @notice This method allows admin to update the max number of ingredients for preparing a dish
	 * @param _additionalIngredients - indicates the additional number of ingrediens that vip user can prepare a dish with
	 */
	function updateAdditionalIngredients(uint256 _additionalIngredients)
		external
		virtual
		onlyOperator
	{
		require(_additionalIngredients != additionalIngredients, 'Cooker: ALREADY_SET');
		additionalIngredients = _additionalIngredients;
	}

	/**
	 * @notice This method allows admin to claim all the tokens of specified address to given address
	 */
	function claimAllTokens(address _user, address _tokenAddress)
		external
		virtual
		onlyOperator
		nonReentrant
	{
		require(_user != address(0), 'Cooker: INVALID_USER_ADDRESS');
		require(_tokenAddress != address(0), 'Cooker: INVALID_TOKEN_ADDRESS');

		uint256 tokenAmount = IBEP20(_tokenAddress).balanceOf(address(this));

		require(IBEP20(_tokenAddress).transfer(_user, tokenAmount));
	}

	/**
	 * @notice This method allows admin to transfer specified amount of the tokens of specified address to given address
	 */
	function claimTokens(
		address _user,
		address _tokenAddress,
		uint256 _amount
	) external virtual onlyOperator nonReentrant {
		require(_user != address(0), 'Cooker: INVALID_USER_ADDRESS');
		require(_tokenAddress != address(0), 'Cooker: INVALID_TOKEN_ADDRESS');

		uint256 tokenAmount = IBEP20(_tokenAddress).balanceOf(address(this));
		require(_amount > 0 && tokenAmount >= _amount, 'Cooker: INSUFFICIENT_BALANCE');

		require(IBEP20(_tokenAddress).transfer(_user, _amount));
	}

	/**
	 * @notice This method allows operator to update the fund receivers address
	 * @param _newFundReceiver - indicates the address of new fund receiver
	 */
	function updateFundReceiver(address _newFundReceiver) external virtual onlyOperator {
		require(
			_newFundReceiver != fundReceiver && _newFundReceiver != address(0),
			'Cooker: INVALID_ADDRESS'
		);
		fundReceiver = _newFundReceiver;
	}

	/*
   	=======================================================================
   	======================== Getter Methods ===============================
   	=======================================================================
 	*/

	/**
	 * @notice This method tells whether dish is ready to uncook or not.
	 * @param _dishNFTId - indicates the dish id
	 * @return true if dish is ready to uncook otherwise returns false.
	 */
	function isDishReadyToUncook(uint256 _dishNFTId)
		public
		view
		virtual
		onlyValidDishNFTId(_dishNFTId)
		returns (bool)
	{
		(, , , , , , , , , uint256 completionTime, ) = dishesNft.dish(_dishNFTId);

		if (block.timestamp > completionTime) {
			return true;
		}
		return false;
	}

	/**
	 * @notice This method tells if user has any talien. also it tells if user has any genesis talien or not
	 * @return hasTalien - indicates if user have any talien
	 * @return isGenesis - indicates if the talien is genesis or not
	 */
	function doesUserHasTalien(address _user)
		public
		view
		virtual
		returns (bool hasTalien, bool isGenesis)
	{
		uint256 userTalienBal = talien.balanceOf(_user);

		if (userTalienBal > 0) {
			hasTalien = true;
			for (uint256 index = 0; index < userTalienBal; index++) {
				uint256 talienId = talien.tokenOfOwnerByIndex(_user, index);

				(uint256 itemId, uint256 seriesId, , , , ) = talien.items(talienId);

				// check if talien series is genesis series
				if (itemId == 1 && seriesId == 1) {
					isGenesis = true;
					break;
				}
			}
		}
	}

	/**
	 * @notice This method tells the time after which dish is ready to uncook.
	 * @param _dishNFTId - indicates the dish id
	 * @return remaining time in seconds otherwise returns 0.
	 */
	function getRemainingTime(uint256 _dishNFTId)
		external
		view
		virtual
		onlyValidDishNFTId(_dishNFTId)
		returns (uint256)
	{
		(, , , , , , , , , uint256 completionTime, ) = dishesNft.dish(_dishNFTId);

		if (completionTime > block.timestamp) {
			return completionTime - block.timestamp;
		}
		return 0;
	}

	/**
	 * @notice This method returns the current flame id
	 */
	function getCurrentFlameId() public view returns (uint256) {
		return flamesCounter.current();
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
	 * @dev See {IERC721Receiver-onERC721Received}.
	 *
	 * Always returns `IERC721Receiver.onERC721Received.selector`.
	 */
	function onERC721Received(
		address,
		address,
		uint256,
		bytes memory
	) public virtual override returns (bytes4) {
		return this.onERC721Received.selector;
	}

	/**
	 * @dev See {IERC165-supportsInterface}.
	 */
	function supportsInterface(bytes4 interfaceId)
		public
		view
		virtual
		override(ERC1155ReceiverUpgradeable, AccessControlUpgradeable)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}
