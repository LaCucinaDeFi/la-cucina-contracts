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
			flames[_flameId].preparationDuration,
			_ingredientIds
		);
	}

	/**
	 * @notice This method alloes users to uncook the dish by returning the dishNFT and claim back the ingredient nfts
	 * @param _dishId - indicates the id of dish to be uncooked.
	 */
	function uncookDish(uint256 _dishId) external {
		require(_dishId > 0 && _dishId <= dishesNft.getCurrentTokenId(), 'Oven: INVALID_DISH_ID');

		// get details of dish
		(
			address dishOwner,
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
