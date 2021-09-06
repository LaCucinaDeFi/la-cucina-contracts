pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Chef is AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using Counters for Counters.Counter;

    /*
   =======================================================================
   ======================== Structures ===================================
   =======================================================================
 */

    struct Ingredient {
        uint256 id;
        string name;
        uint256 fat;
        string svg;
    }

    struct BaseIngredient {
        uint256 id;
        string name;
        string svg;
    }

    struct Dish {
        uint256 baseIngredientId;
        uint256 fats;
        uint256 totalIngredients;
        uint256 ingredientsHash;
    }

    /*
   =======================================================================
   ======================== Private Variables ============================
   =======================================================================
 */
    Counters.Counter private dishIdCounter;
    Counters.Counter private ingredientCounter;
    Counters.Counter private baseIngredientCounter;

    /*
   =======================================================================
   ======================== Public Variables ============================
   =======================================================================
 */
    // dishID => dish
    mapping(uint256 => Dish) public dish;

    // baseIngredientId => BaseIngredient
    mapping(uint256 => BaseIngredient) public baseIngredients;

    // ingredientId => Ingredient
    mapping(uint256 => Ingredient) public ingredients;

    /*
   =======================================================================
   ======================== Constructor/Initializer ======================
   =======================================================================
 */

    /**
     * @notice Used in place of the constructor to allow the contract to be upgradable via proxy.
     */
    function initialize() external virtual initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /*
   =======================================================================
   ======================== Events =======================================
   =======================================================================
 */
    event DishPrepared(uint256 dishId);

    /*
   =======================================================================
   ======================== Modifiers ====================================
   =======================================================================
 */
    modifier onlyAdmin() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "Market: ONLY_ADMIN_CAN_CALL"
        );
        _;
    }

    /*
   =======================================================================
   ======================== Public Methods ===============================
   =======================================================================
 */
    /**
			@notice This method allows users to prepare a dish using more than 1 ingredients.
			@param _baseIngredientId - indicates the baseIngredient Id, depending on this it creates a dish.
			@param _ingredientIds - indicates the list of ingredients that you want to include in dish
			@return dishId - indicates the new dish id
		 */
    function prepareDish(
        uint256 _baseIngredientId,
        uint256[] memory _ingredientIds
    ) external returns (uint256 dishId) {
        require(
            _baseIngredientId > 0 &&
                _baseIngredientId <= baseIngredientCounter.current(),
            "Chef: INVALID_BASE_INGREDIENT"
        );
        require(
            _ingredientIds.length > 1,
            "Chef: INVALID_NUMBER_OF_INGREDIENTS"
        );

        uint256 fats;
        uint256 ingredientsHash;
        uint256 currentIngredientId = ingredientCounter.current();

        for (uint256 i = 0; i < _ingredientIds.length; i++) {
            require(
                _ingredientIds[i] > 0 &&
                    _ingredientIds[i] <= currentIngredientId,
                "Chef: INVALID_INGREDIENT"
            );

            fats += ingredients[_ingredientIds[i]].fat;

            // combine slotted ingredients into hash
            ingredientsHash += ingredients[_ingredientIds[i]].id * 256**i;
        }

        dishIdCounter.increment();
        dishId = dishIdCounter.current();

        dish[dishId].baseIngredientId = _baseIngredientId;
        dish[dishId].fats = fats;
        dish[dishId].ingredientsHash = ingredientsHash;
        dish[dishId].totalIngredients = _ingredientIds.length;

        emit DishPrepared(dishId);
    }

    /**
			@notice This method allows admin to add the ingredient details for preparing a dish.
			@param _name - indicates the name of the ingredient
			@param _fat - indicates the fats of the ingredient
			@param _svg - indicates the svg of the ingredient
			@return ingredientId - new ingredient id
		 */
    function addIngredient(
        string memory _name,
        uint256 _fat,
        string memory _svg
    ) public onlyAdmin returns (uint256 ingredientId) {
        require(bytes(_name).length > 0, "Chef: INVALID_INGREDIENT_NAME");
        require(_fat > 0, "Chef: INVALID_FAT");
        require(bytes(_svg).length > 0, "Chef: INVALID_SVG");

        // generate ingredient Id
        ingredientCounter.increment();
        ingredientId = ingredientCounter.current();

        ingredients[ingredientId] = Ingredient(ingredientId, _name, _fat, _svg);
    }

    /**
			@notice This method allows admin to add the base ingredient details for a dish.
			@param _name - indicates the name of the ingredient
			@param _svg - indicates the svg of the ingredient
			@return baseIngredientId - new base ingredient id
		 */
    function addBaseIngredient(string memory _name, string memory _svg)
        external
        onlyAdmin
        returns (uint256 baseIngredientId)
    {
        require(bytes(_name).length > 0, "Chef: INVALID_BASE_INGREDIENT_NAME");
        require(bytes(_svg).length > 0, "Chef: INVALID_SVG");

        // generate traitId
        baseIngredientCounter.increment();
        baseIngredientId = baseIngredientCounter.current();

        baseIngredients[baseIngredientId] = BaseIngredient(
            baseIngredientId,
            _name,
            _svg
        );
    }

    /*
   =======================================================================
   ======================== Getter Methods ===============================
   =======================================================================
 */
    /**
		@notice This method allows users to get the svg of their dish
		@param dishId - indicates the dishId for which you want to get the svg
		@return svg - svg code of dish
    */
    function serveDish(uint256 dishId) public view returns (string memory svg) {
        require(
            dishId > 0 && dishId <= dishIdCounter.current(),
            "Chef: INVALID_DISH_ID"
        );

        Dish memory dishToServe = dish[dishId];

        string
            memory accumulator = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="1000" height="1000" viewBox="0, 0, 1616, 1216">';

        BaseIngredient memory baseIngredient = baseIngredients[
            dishToServe.baseIngredientId
        ];

        // add base ingredient
        accumulator = strConcat(accumulator, baseIngredient.svg);

        uint256 slotConst = 256;
        uint256 slotMask = 255;
        uint256 bitMask;
        uint256 slottedValue;
        uint256 slotMultiplier;
        uint256 variation;
        Ingredient memory ingredient;

        // Iterate Ingredient hash by Gene and assemble SVG sandwich
        for (
            uint8 slot = 0;
            slot <= uint8(dishToServe.totalIngredients);
            slot++
        ) {
            slotMultiplier = uint256(slotConst**slot); // Create slot multiplier
            bitMask = slotMask * slotMultiplier; // Create bit mask for slot
            slottedValue = dishToServe.ingredientsHash & bitMask; // Extract slotted value from hash

            if (slottedValue > 0) {
                variation = (slot > 0) // Extract IngredientID from slotted value
                    ? slottedValue / slotMultiplier
                    : slottedValue;

                require(
                    variation > 0 && variation <= ingredientCounter.current(),
                    "Chef: INVALID_INGREDIENT_VARIATION"
                );

                if (variation > 0) {
                    ingredient = ingredients[variation];
                    accumulator = strConcat(accumulator, ingredient.svg);
                }
            }
        }

        return strConcat(accumulator, "</svg>");
    }

    /**
			@notice This method returns the current dishId
		 */
    function getCurrentDishId() external view returns (uint256) {
        return dishIdCounter.current();
    }

    /**
			@notice This method returns the current ingredient Id
		 */
    function getCurrentIngredientId() external view returns (uint256) {
        return ingredientCounter.current();
    }

    /**
			@notice This method returns the current base ingredient Id
		 */
    function getCurrentBaseIngredientId() external view returns (uint256) {
        return baseIngredientCounter.current();
    }

    /*
   =======================================================================
   ======================== Internal Methods ===============================
   =======================================================================
 */
    /**
     * @notice Convert a `uint` value to a `string`
     * via OraclizeAPI - MIT licence
     * https://github.com/provable-things/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol#L896
     * @param _i the `uint` value to be converted
     * @return result the `string` representation of the given `uint` value
     */
    function uintToStr(uint256 _i)
        internal
        pure
        returns (string memory result)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        result = string(bstr);
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
}
