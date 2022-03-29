require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN, expectEvent, time} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const {ZERO_ADDRESS} = require('@openzeppelin/test-helpers/src/constants');

const doughs = require('../data/dough');
const sauces = require('../data/sauce');
const cheeses = require('../data/cheese');

const papayas = require('../data/ingredients/papaya');
const caviar = require('../data/ingredients/caviar');
const leaves = require('../data/ingredients/leaves');
const venom = require('../data/ingredients/venom');
const antEggs = require('../data/ingredients/antEggs');

const fs = require('fs');
const path = require('path');

const DishesNFT = artifacts.require('DishesNFT');
const DishesNFTV2 = artifacts.require('DishesNFTV2');
const IngredientNFT = artifacts.require('IngredientsNFT');
const Kitchen = artifacts.require('Kitchen');

const url = 'https://token-cdn-domain/';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';
const GAS_LIMIT = 85000000;

contract('DishesNFT', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const operator = accounts[5];
	const royaltyReceiver = accounts[8];
	const royaltyFee = '100';

	let dishId = 1;
	let currentDishId;
	let nutritionHash;

	before('Deploy contracts', async () => {
		// deploy NFT token
		this.Ingredient = await deployProxy(IngredientNFT, [url, royaltyReceiver, royaltyFee], {
			initializer: 'initialize'
		});

		this.Kitchen = await deployProxy(Kitchen, [], {
			initializer: 'initialize'
		});

		this.Dish = await deployProxy(
			DishesNFT,
			['DishesNFT', 'Dish', url, this.Ingredient.address, this.Kitchen.address],
			{
				initializer: 'initialize'
			}
		);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});

		// grant updator role to talion contract
		const OPERATOR_ROLE = await this.Ingredient.OPERATOR_ROLE();
		await this.Ingredient.grantRole(OPERATOR_ROLE, operator, {from: owner});
		await this.Kitchen.grantRole(OPERATOR_ROLE, operator, {from: owner});
		await this.Dish.grantRole(OPERATOR_ROLE, operator, {from: owner});

		// add owner as excepted address
		await this.Ingredient.addExceptedAddress(owner, {from: operator});
	});

	before('Add Dish Type and base ingredient for Pizza', async () => {
		// add dish in kitchen
		// [(205, 190), (250, 195), (270, 220), (170, 225), (210, 240), (160, 260), (120, 280)]
		const dishType = await this.Kitchen.addDishType(
			'Pizza',
			[205, 250, 270, 170, 210, 160, 120],
			[190, 195, 220, 225, 240, 260, 280],
			{
				from: operator
			}
		);
		currentDishId = await this.Kitchen.getCurrentDishTypeId();

		// add base Ingredients for dish
		const addDough = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Dough', {
			from: operator
		});
		const addSauce = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Sauce', {
			from: operator
		});
		const addCheese = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Cheese', {
			from: operator
		});
	});

	// ************************** IMPORTANT ************************** //
	// add variations for base ingredients
	// here variation name should be strictly like this. variationName = IngredientName_variationName. ex. Slice_1, Cheese_2
	// NOTE: svg id and the IngredientName_variationName should be same. <g id= "Slice_One">, <g id = "Cheese_Two">
	// ************************** IMPORTANT ************************** //
	before('Add base variations for Pizza Dough', async () => {
		for (let dough of doughs) {
			await this.Kitchen.addBaseIngredientVariation(1, dough.name, dough.svg, {
				from: operator,
				gas: GAS_LIMIT
			});
		}
	});

	before('Add base variations for Pizza Sauce', async () => {
		for (let sauce of sauces) {
			await this.Kitchen.addBaseIngredientVariation(2, sauce.name, sauce.svg, {
				from: operator,
				gas: GAS_LIMIT
			});
		}
	});

	before('Add base variations for Pizza Cheese', async () => {
		for (let cheese of cheeses) {
			await this.Kitchen.addBaseIngredientVariation(3, cheese.name, cheese.svg, {
				from: operator,
				gas: GAS_LIMIT
			});
		}
	});

	before('add ingredients', async () => {
		// add ingredients
		nutritionHash = await this.Ingredient.getNutritionHash([
			14200, 24100, 22200, 42000, 63100, 39100, 75200
		]);
		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Papaya',
			nutritionHash,
			ipfsHash,
			[papayas[0].keyword, papayas[1].keyword, papayas[2].keyword],
			[papayas[0].svg, papayas[1].svg, papayas[2].svg],
			[papayas[0].name, papayas[1].name, papayas[2].name],
			{
				from: minter,
				gas: GAS_LIMIT
			}
		);

		nutritionHash = await this.Ingredient.getNutritionHash([
			24100, 34100, 32200, 32000, 33100, 59100, 65200
		]);
		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Caviar',
			nutritionHash,
			ipfsHash,
			[caviar[0].keyword, caviar[0].keyword],
			[caviar[0].svg],
			[caviar[0].name],
			{
				from: minter,
				gas: GAS_LIMIT
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Leaves',
			nutritionHash,
			ipfsHash,
			[leaves[0].keyword, leaves[1].keyword, leaves[2].keyword],
			[leaves[0].svg, leaves[1].svg, leaves[2].svg],
			[leaves[0].name, leaves[1].name, leaves[2].name],
			{
				from: minter,
				gas: GAS_LIMIT
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Venom',
			nutritionHash,
			ipfsHash,
			[venom[0].keyword, venom[1].keyword, venom[2].keyword],
			[venom[0].svg, venom[1].svg, venom[2].svg],
			[venom[0].name, venom[1].name, venom[2].name],
			{
				from: minter,
				gas: GAS_LIMIT
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Ant_Eggs',
			nutritionHash,
			ipfsHash,
			[antEggs[0].keyword, antEggs[0].keyword],
			[antEggs[0].svg],
			[antEggs[0].name],
			{
				from: minter,
				gas: GAS_LIMIT
			}
		);
	});

	describe('initialize()', () => {
		it('should initialize contracts correctly', async () => {
			const ingredientAddress = await this.Dish.ingredientNft();
			const kitchenAddress = await this.Dish.kitchen();

			expect(ingredientAddress).to.be.eq(this.Ingredient.address);
			expect(kitchenAddress).to.be.eq(this.Kitchen.address);
		});

		it('should grant the admin role to deployer', async () => {
			const adminRole = await this.Dish.DEFAULT_ADMIN_ROLE();

			const isAdmin = await this.Dish.hasRole(adminRole, owner);
			expect(isAdmin).to.be.eq(true);
		});
	});

	describe('cookDish()', async () => {
		let currentDishIdBefore;

		before('setup contract for preparing dish', async () => {
			// grant COOKER role to minter in Dish contract
			const CookerRole = await this.Dish.COOKER_ROLE();

			await this.Dish.grantRole(CookerRole, minter, {from: owner});

			// transfer ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 3, 1, '0x384', {from: owner});

			//get current dish id
			currentDishIdBefore = await this.Dish.getCurrentTokenId();

			// prepare the dish
			this.prepareDishTx = await this.Dish.cookDish(
				user1,
				1,
				1,
				time.duration.minutes('5'),
				[1, 2, 3],
				{from: minter}
			);
		});

		it('should prepare dish correctly', async () => {
			//get current dish id
			const currentDishIdAfter = await this.Dish.getCurrentTokenId();
			const dishDetails = await this.Dish.dish(currentDishIdAfter);
			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1);
			const dishOwner = await this.Dish.ownerOf(currentDishIdAfter);
			const variationIndexHash = await this.Dish.variationIndexHashes(currentDishIdAfter);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));
			expect(dishOwner).to.bignumber.be.eq(user1);
			expect(dishDetails.cooked).to.be.eq(true);
			expect(dishDetails.dishId).to.bignumber.be.eq(new BN('1'));
			expect(dishDetails.totalIngredients).to.bignumber.be.eq(new BN('3'));
			expect(dishDetails.totalBaseIngredients).to.bignumber.be.eq(new BN('3'));
			expect(dishDetails.flameType).to.bignumber.be.eq(new BN('1'));
			expect(dishDetails.creationTime).to.bignumber.be.gt(new BN('0'));
			expect(dishDetails.completionTime).to.bignumber.be.gt(dishDetails.creationTime);
			expect(dishDetails.multiplier).to.bignumber.be.eq(new BN('2897315367569879096'));
			expect(variationIndexHash).to.bignumber.be.eq(new BN('0'));

			expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
			expect(currentDishIdAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should rever when non-Chef tries to prepare a dish', async () => {
			await expectRevert(
				this.Dish.cookDish(user1, 1, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: user1
				}),
				'DishesNFT: ONLY_COOKER_CAN_CALL'
			);
		});

		it('should rever when chef wants to prepare a dish for invalid user', async () => {
			await expectRevert(
				this.Dish.cookDish(ZERO_ADDRESS, 1, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: minter
				}),
				'DishesNFT: INVALID_USER_ADDRESS'
			);
		});

		it('should rever when chef wants to prepare a dish with invalid dish id', async () => {
			await expectRevert(
				this.Dish.cookDish(user1, 5, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: minter
				}),
				'Kitchen: INVALID_DISH_ID'
			);
			await expectRevert(
				this.Dish.cookDish(user1, 0, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: minter
				}),
				'Kitchen: INVALID_DISH_ID'
			);
		});
		it('should rever when chef wants to prepare a dish with insufficient ingredients', async () => {
			await expectRevert(
				this.Dish.cookDish(user1, 1, 1, time.duration.minutes('5'), [1], {
					from: minter
				}),
				'DishesNFT: INSUFFICIENT_INGREDIENTS'
			);
		});
		it('should emit when dish is prepared', async () => {
			await expectEvent(this.prepareDishTx, 'Cook', [new BN('1')]);
		});
	});

	describe('serveDish()', () => {
		it('should serve the prepared dish correctly', async () => {
			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join('generated/dish', 'pizzaDish.svg');

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should revert when invalid dish id used to serve the dish', async () => {
			await expectRevert(this.Dish.serveDish(0), 'DishesNFT: INVALID_DISH_ID');
			await expectRevert(this.Dish.serveDish(5), 'DishesNFT: INVALID_DISH_ID');
		});
	});

	describe('uncookDish()', () => {
		let currentDishId;

		before(async () => {
			currentDishId = await this.Dish.getCurrentTokenId();

			// get user1`s dish balance
			userDishBalBefore = await this.Dish.balanceOf(user1);

			// uncook dish
			await this.Dish.uncookDish(currentDishId, {from: minter});
		});

		it('should uncook dish correctly', async () => {
			const dish = await this.Dish.dish(currentDishId);
			const userDishBalAfter = await this.Dish.balanceOf(user1);

			expect(dish.cooked).to.be.eq(false);
			expect(userDishBalBefore).to.bignumber.be.eq(new BN('1'));
			expect(userDishBalAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when chef tries to uncook the dish with invalid dish id', async () => {
			await expectRevert(this.Dish.uncookDish(0, {from: minter}), 'DishesNFT: INVALID_DISH_ID');
			await expectRevert(this.Dish.uncookDish(5, {from: minter}), 'DishesNFT: INVALID_DISH_ID');
		});

		it('should revert when user wants to get svg of uncooked dish', async () => {
			await expectRevert(
				this.Dish.serveDish(currentDishId, {from: minter}),
				'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH'
			);
		});

		it('should revert when chef tries to uncook the uncooked dish', async () => {
			await expectRevert(
				this.Dish.uncookDish(currentDishId, {from: minter}),
				'DishesNFT: ALREADY_UNCOOKED_DISH'
			);
		});

		it('should revert when non-chef wants to uncooked the dish', async () => {
			await expectRevert(
				this.Dish.uncookDish(currentDishId, {from: user1}),
				'DishesNFT: ONLY_COOKER_CAN_CALL'
			);
		});
	});

	describe('updatePreparationTime()', () => {
		let currentDishId;
		it('should update the dish preparation time correctly', async () => {
			currentDishId = await this.Dish.getCurrentTokenId();

			await this.Dish.updatePreparationTime(currentDishId, 2, time.duration.minutes('1'), {
				from: minter
			});

			const dishDetails = await this.Dish.dish(currentDishId);

			expect(dishDetails.flameType).to.bignumber.be.eq(new BN('2'));
			expect(dishDetails.completionTime).to.bignumber.be.gt(dishDetails.creationTime);
		});

		it('should revert when non cooker tries to update the preparation time', async () => {
			await expectRevert(
				this.Dish.updatePreparationTime(currentDishId, 2, time.duration.minutes('1'), {
					from: user1
				}),
				'DishesNFT: ONLY_COOKER_CAN_CALL'
			);
		});
	});

	describe('addExceptedAddress()', () => {
		it('should add the excepted address correctly', async () => {
			const isMinterExceptedBefore = await this.Dish.exceptedAddresses(minter);

			await this.Dish.addExceptedAddress(minter, {from: operator});

			const isMinterExceptedAfter = await this.Dish.exceptedAddresses(minter);

			expect(isMinterExceptedBefore).to.be.eq(false);
			expect(isMinterExceptedAfter).to.be.eq(true);
		});
		it('should revert if owner tries to except address which is already excepted', async () => {
			await expectRevert(
				this.Dish.addExceptedAddress(minter, {from: operator}),
				'DishesNFT: ALREADY_ADDED'
			);
		});

		it('should revert if non-owner tries to except address', async () => {
			await expectRevert(
				this.Dish.addExceptedAddress(user1, {from: user3}),
				'BaseERC721: ONLY_OPERATOR_CAN_CALL'
			);
		});
		it('should allow the user to transfer dish nft to excecpted address', async () => {
			const currentDishId = await this.Dish.getCurrentTokenId();
			await this.Dish.safeTransferFrom(user1, minter, currentDishId, {from: user1});
		});

		it('should not allow the user to transfer dish nft to non-excecpted address', async () => {
			const currentDishId = await this.Dish.getCurrentTokenId();
			await expectRevert(
				this.Dish.safeTransferFrom(minter, user1, currentDishId, {from: minter}),
				'DishesNFT: CANNOT_TRANSFER_DISH'
			);
		});
	});

	describe('removeExceptedAddress()', () => {
		it('should remove the excepted address correctly', async () => {
			const isMinterExceptedBefore = await this.Dish.exceptedAddresses(minter);

			await this.Dish.removeExceptedAddress(minter, {from: operator});

			const isMinterExceptedAfter = await this.Dish.exceptedAddresses(minter);

			expect(isMinterExceptedBefore).to.be.eq(true);
			expect(isMinterExceptedAfter).to.be.eq(false);
		});
		it('should revert if owner tries to remove excepted address which is already removed', async () => {
			await expectRevert(
				this.Dish.removeExceptedAddress(minter, {from: operator}),
				'DishesNFT: ALREADY_REMOVED'
			);
		});

		it('should revert if non-owner tries to except address', async () => {
			await expectRevert(
				this.Dish.removeExceptedAddress(user1, {from: user3}),
				'BaseERC721: ONLY_OPERATOR_CAN_CALL'
			);
		});
	});

	describe('updateMin()', () => {
		it('should update the min value correctly', async () => {
			await this.Dish.updateMin(20, {from: operator});

			const min = await this.Dish.min();
			expect(min).to.bignumber.be.eq('20');
		});
		it('should revert when non-owner tries to update the min', async () => {
			await expectRevert(
				this.Dish.updateMin(20, {from: minter}),
				'BaseERC721: ONLY_OPERATOR_CAN_CALL'
			);
		});

		it('should revert when owner tries to update the min with already set value', async () => {
			await expectRevert(this.Dish.updateMin('20', {from: operator}), 'DishesNFT: MIN_ALREADY_SET');
		});
	});

	describe('updateMax()', () => {
		it('should update the max value correctly', async () => {
			await this.Dish.updateMax(60, {from: operator});

			const max = await this.Dish.max();
			expect(max).to.bignumber.be.eq('60');
		});
		it('should revert when non-owner tries to update the max', async () => {
			await expectRevert(
				this.Dish.updateMax(20, {from: minter}),
				'BaseERC721: ONLY_OPERATOR_CAN_CALL'
			);
		});

		it('should revert when owner tries to update the max with already set value', async () => {
			await expectRevert(this.Dish.updateMax('60', {from: operator}), 'DishesNFT: MAX_ALREADY_SET');
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Dish.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Dish.address, DishesNFTV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Dish.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});

	describe('tokenURI()', () => {
		it('should get the tokenURI correctly', async () => {
			const tokenUri = await this.Dish.tokenURI(1);
			expect(tokenUri).to.be.eq('https://token-cdn-domain/1');
		});
	});

	describe('updateBaseUri()', () => {
		it('should get the updateBaseUri correctly', async () => {
			await this.Dish.updateBaseUri('https://token-cdn/', {from: operator});

			const tokenUri = await this.Dish.tokenURI(1);
			expect(tokenUri).to.be.eq('https://token-cdn/1');
		});
	});
});
