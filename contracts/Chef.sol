pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import './interfaces/IIngredientNFT.sol';
import './interfaces/IDishesNFT.sol';
import './interfaces/IVersionedContract.sol';

contract Chef is
	AccessControlUpgradeable,
	ReentrancyGuardUpgradeable,
	IVersionedContract,
	ERC1155ReceiverUpgradeable
{
	using Counters for Counters.Counter;

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	uint256 private nonce;

	/*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
	IIngredientNFT public ingredientNft;
	IDishesNFT public dishesNft;

	uint256[] public uncookedDishIds;

	/*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

	/**
	 * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
	 */
	function initialize(address _ingredientNftAddress, address _dishesNftAddress)
		external
		virtual
		initializer
	{
		require(_ingredientNftAddress != address(0), 'Chef: INVALID_INGREDIENT_ADDRESS');
		require(_dishesNftAddress != address(0), 'Chef: INVALID_DISHES_ADDRESS');

		__AccessControl_init();
		__ReentrancyGuard_init();

		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

		ingredientNft = IIngredientNFT(_ingredientNftAddress);
		dishesNft = IDishesNFT(_dishesNftAddress);
		nonce = 1;
	}

	/*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */
	/**
	 * @notice This method allows users to prepare a dish using more than 1 ingredients.
	 * @param _ingredientIds - indicates the list of ingredients that you want to include in dish
	 * @return dishId - indicates the new dish id
	 */
	function prepareDish(uint256 _baseIngredientId, uint256[] memory _ingredientIds)
		external
		returns (uint256 dishId)
	{
		require(
			_baseIngredientId > 0 && _baseIngredientId <= ingredientNft.getCurrentBaseIngredientId(),
			'Chef: INVALID_BASE_INGREDIENT_ID'
		);
		require(_ingredientIds.length > 1, 'Chef: INSUFFICIENT_INGREDIENTS');

		uint256 fats;
		uint256 ingredientsHash;
		uint256 variationsHash;
		uint256 currentIngredientId = ingredientNft.getCurrentNftId();

		for (uint256 i = 0; i < _ingredientIds.length; i++) {
			require(
				_ingredientIds[i] > 0 && _ingredientIds[i] <= currentIngredientId,
				'Chef: INVALID_INGREDIENT_ID'
			);

			// get the Ingredient NFT from user

			ingredientNft.safeTransferFrom(msg.sender, address(this), _ingredientIds[i], 1, '');

			(, , uint256 fat, uint256 totalVariations) = ingredientNft.ingredients(_ingredientIds[i]);

			fats += fat;

			require(totalVariations > 0, 'Chef: INSUFFICIENT_VARIATIONS');

			// combine slotted ingredients into hash
			ingredientsHash += _ingredientIds[i] * 256**i;
			if (totalVariations > 1) {
				variationsHash += getRandomVariation(totalVariations) * 256**i;
			} else {
				variationsHash += 1 * 256**i;
			}
		}

		//get baseIngredient svgs
		(, , string[] memory baseIngredientsSvgs) = ingredientNft.baseIngredients(_baseIngredientId);

		uint256 baseIngredientVariation;
		if (baseIngredientsSvgs.length > 1) {
			baseIngredientVariation = getRandomVariation(baseIngredientsSvgs.length);
		} else {
			baseIngredientVariation = 0;
		}

		// prepare the dish
		dishId = dishesNft.prepareDish(
			msg.sender,
			_baseIngredientId,
			baseIngredientVariation,
			fats,
			_ingredientIds.length,
			ingredientsHash,
			variationsHash
		);
	}

	/**
	 * @notice This method alloes users to uncook the dish by returning the dishNFT and claim back the ingredient nfts
	 * @param _dishId - indicates the id of dish to be uncooked.
	 */
	function uncookDish(uint256 _dishId) external {
		require(_dishId > 0 && _dishId <= dishesNft.getCurrentNftId(), 'Chef: INVALID_DISH_ID');

		// get details of dish
		(address dishHolder, , , , uint256 totalIngredients, uint256 ingredientsHash, ) = dishesNft
			.dish(_dishId);

		require(dishHolder == msg.sender, 'Chef: ONLY_DISH_OWNER_CAN_UNCOOK');

		// get the dish nft from user
		dishesNft.safeTransferFrom(msg.sender, address(this), _dishId, 1, '');

		uncookedDishIds.push(_dishId);

		// uncook the dish
		dishesNft.uncookDish(_dishId);

		uint256 slotConst = 256;
		uint256 slotMask = 255;
		uint256 bitMask;
		uint256 slottedValue;
		uint256 slotMultiplier;
		uint256 variation;

		// Iterate Ingredient hash by Gene and assemble SVG sandwich
		for (uint8 slot = 0; slot <= uint8(totalIngredients); slot++) {
			slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
			bitMask = slotMask * slotMultiplier; // Create bit mask for slot
			slottedValue = ingredientsHash & bitMask; // Extract slotted value from hash

			if (slottedValue > 0) {
				variation = (slot > 0) // Extract IngredientID from slotted value
					? slottedValue / slotMultiplier
					: slottedValue;

				require(
					variation > 0 && variation <= ingredientNft.getCurrentNftId(),
					'Chef: INVALID_INGREDIENT_VARIATION'
				);

				// transfer the ingredient nft to user
				ingredientNft.safeTransferFrom(address(this), msg.sender, variation, 1, '');
			}
		}
	}

	function getRandomVariation(uint256 _max) internal returns (uint256 randomVariation) {
		randomVariation = random(_max);
		require(randomVariation <= _max, 'Chef: INVALID_VARIATION');
	}

	function random(uint256 _max) internal returns (uint256) {
		require(_max > 0, 'Chef: INVALID_MAX');
		uint256 randomnumber = uint256(
			keccak256(abi.encodePacked(block.timestamp, msg.sender, nonce))
		) % _max;
		randomnumber = randomnumber + 100;
		nonce++;
		return randomnumber;
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
