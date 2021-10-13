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

contract Oven is
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
	CountersUpgradeable.Counter private flamesCounter;

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	IIngredientNFT public ingredientNft;
	IDishesNFT public dishesNft;
	IBEP20 public lacToken;

	/// @notice Stores the uncooked dishNFT ids
	uint256[] public uncookedDishIds;

	// flameId => FlameDetails
	mapping(uint256 => FlameDetail) public flames;

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
		address _lacToken
	) external virtual initializer {
		require(_ingredientNft != address(0), 'Oven: INVALID_INGREDIENT_ADDRESS');
		require(_dishesNft != address(0), 'Oven: INVALID_DISHES_ADDRESS');
		require(_lacToken != address(0), 'Oven: INVALID_LAC_ADDRESS');

		__AccessControl_init();
		__ReentrancyGuard_init();

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

		ingredientNft = IIngredientNFT(_ingredientNft);
		dishesNft = IDishesNFT(_dishesNft);
		lacToken = IBEP20(_lacToken);
	}

	/*
   	=======================================================================
   	======================== Modifiers ====================================
 	=======================================================================
 	*/
	modifier onlyAdmin() {
		require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), 'Oven: ONLY_ADMIN_CAN_CALL');
		_;
	}

	modifier onlyValidFlameId(uint256 _flameId) {
		require(_flameId > 0 && _flameId <= flamesCounter.current(), 'Oven: INVALID_FLAME');
		_;
	}

	modifier onlyValidDishNFTId(uint256 _dishNFTId) {
		require(_dishNFTId > 0 && _dishNFTId <= dishesNft.getCurrentTokenId(), 'Oven: INVALID_DISH_ID');
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
	function prepareDish(
		uint256 _dishId,
		uint256 _flameId,
		uint256[] memory _ingredientIds
	) external onlyValidFlameId(_flameId) returns (uint256 dishId) {
		FlameDetail memory flame = flames[_flameId];
		uint256 currentIngredientId = ingredientNft.getCurrentNftId();

		// get the LAC tokens from user
		if (flame.lacCharge > 0) {
			require(lacToken.transferFrom(msg.sender, address(this), flame.lacCharge));
		}

		// get Ingredient NFTs from user
		for (uint256 i = 0; i < _ingredientIds.length; i++) {
			require(
				_ingredientIds[i] > 0 && _ingredientIds[i] <= currentIngredientId,
				'Oven: INVALID_INGREDIENT_ID'
			);

			// get the Ingredient NFT from user
			ingredientNft.safeTransferFrom(msg.sender, address(this), _ingredientIds[i], 1, '');
		}

		// prepare the dish
		dishId = dishesNft.prepareDish(
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
	function uncookDish(uint256 _dishId) external {
		require(isDishReadyToUncook(_dishId), 'Oven: CANNOT_UNCOOK_WHILE_PREPARING');

		// get details of dish
		(
			address dishOwner,
			,
			,
			,
			uint256 totalIngredients,
			uint256 ingredientVariationHash,
			,
			,
			,

		) = dishesNft.dish(_dishId);

		require(dishOwner == msg.sender, 'Oven: ONLY_DISH_OWNER_CAN_UNCOOK');

		// get the dish nft from user
		dishesNft.safeTransferFrom(msg.sender, address(this), _dishId);

		uncookedDishIds.push(_dishId);

		// uncook the dish
		dishesNft.uncookDish(_dishId);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slottedValue;
		uint256 slotMultiplier;
		uint256 variation;

		// Iterate Ingredient hash and assemble SVG sandwich
		for (uint8 slot = 0; slot <= uint8(totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			slottedValue = ingredientVariationHash & bitMask; // Extract slotted value from hash

			if (slottedValue > 0) {
				variation = (slot > 0) // Extract IngredientID from slotted value
					? slottedValue / slotMultiplier
					: slottedValue;

				require(
					variation > 0 && variation <= ingredientNft.getCurrentDefs(),
					'Oven: INVALID_INGREDIENT_VARIATION'
				);
				(uint256 ingredientId, , ) = ingredientNft.defs(variation);

				// transfer the ingredient nft to user
				ingredientNft.safeTransferFrom(address(this), msg.sender, ingredientId, 1, '');
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
	) external onlyAdmin returns (uint256 flameId) {
		require(bytes(_flameType).length > 0, 'Oven: INVALID_FLAME_TYPE');

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
	) external onlyAdmin onlyValidFlameId(_flameId) {
		require(bytes(_flameType).length > 0, 'Oven: INVALID_FLAME_TYPE');

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
		onlyValidDishNFTId(_dishNFTId)
		onlyValidFlameId(_flameId)
	{
		require(!isDishReadyToUncook(_dishNFTId), 'Oven: CANNOT_UPDATE_FLAME');

		// get details of dish
		(address dishOwner, , , uint256 oldFlameId, , , , , , ) = dishesNft.dish(_dishNFTId);

		require(msg.sender == dishOwner, 'Oven: ONLY_DISH_OWNER_CAN_UPDATE_FLAME');
		require(_flameId != oldFlameId, 'Oven: FLAME_ALREADY_SET');

		FlameDetail storage oldFlame = flames[oldFlameId];
		FlameDetail storage newFlame = flames[_flameId];

		// faster flame
		if (newFlame.lacCharge > oldFlame.lacCharge) {
			// get the LAC tokens from user
			if (newFlame.lacCharge > 0) {
				require(
					lacToken.transferFrom(msg.sender, address(this), newFlame.lacCharge - oldFlame.lacCharge),
					'Oven: TRANSFER_FAILED'
				);
			}
		} else if (newFlame.lacCharge < oldFlame.lacCharge) {
			// slower flame
			// return the extra LAC tokens to user
			require(
				lacToken.transfer(msg.sender, oldFlame.lacCharge - newFlame.lacCharge),
				'Oven: TRANSFER_FAILED'
			);
		}

		dishesNft.updatePrepartionTime(_dishNFTId, _flameId, newFlame.preparationDuration);
	}

	/**
	 * @notice This method tells whether dish is ready to uncook or not.
	 * @param _dishNFTId - indicates the dish id
	 * @return true if dish is ready to uncook otherwise returns false.
	 */
	function isDishReadyToUncook(uint256 _dishNFTId)
		public
		view
		onlyValidDishNFTId(_dishNFTId)
		returns (bool)
	{
		(, , , , , , , , , uint256 completionTime) = dishesNft.dish(_dishNFTId);

		if (block.timestamp > completionTime) {
			return true;
		}
		return false;
	}

	/**
	 * @notice This method tells the time after which dish is ready to uncook.
	 * @param _dishNFTId - indicates the dish id
	 * @return remaining time in seconds otherwise returns 0.
	 */
	function getRemainingTime(uint256 _dishNFTId)
		external
		view
		onlyValidDishNFTId(_dishNFTId)
		returns (uint256)
	{
		(, , , , , , , , , uint256 completionTime) = dishesNft.dish(_dishNFTId);

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
