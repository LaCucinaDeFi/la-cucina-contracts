require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN, expectEvent, time} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const {ZERO_ADDRESS} = require('@openzeppelin/test-helpers/src/constants');

const {slice_1, slice_2, slice_3} = require('./svgs/Slice');
const {cheese_1, cheese_2, cheese_3} = require('./svgs/Cheese');
const {caviar_1, caviar_2, caviar_3} = require('./svgs/Caviar');
const {tuna_1, tuna_2, tuna_3} = require('./svgs/Tuna');
const {gold_1, gold_2, gold_3} = require('./svgs/Gold');
const {beef_1, beef_2, beef_3} = require('./svgs/Beef');
const {truffle_1, truffle_2, truffle_3} = require('./svgs/Truffle');

const fs = require('fs');
const path = require('path');

const DishesNFT = artifacts.require('DishesNFT');
const DishesNFTV2 = artifacts.require('DishesNFTV2');
const IngredientNFT = artifacts.require('IngredientsNFT');
const Kitchen = artifacts.require('Kitchen');

const url = 'https://token-cdn-domain/{id}.json';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';

contract('DishesNFT', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const royaltyReceiver = accounts[8];
	const royaltyFee = '100';

	let dishId = 1;
	let currentDishId;
	let nutritionHash;

	before(async () => {
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

		// add dish in kitchen
		await this.Kitchen.addDishType('Pizza', {from: owner});
		currentDishId = await this.Kitchen.getCurrentDishTypeId();

		// add base Ingredients for dish
		await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Slice', {from: owner});
		await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Cheese', {from: owner});

		// add variations for base ingredients
		// here variation name should be strictly like this. variationName = IngredientName_variationName. ex. Slice_1, Cheese_2
		// NOTE: svg id and the IngredientName_variationName should be same. <g id= "Slice_One">, <g id = "Cheese_Two">
		await this.Kitchen.addBaseIngredientVariation(1, 'One', slice_1, {from: owner});
		await this.Kitchen.addBaseIngredientVariation(1, 'Two', slice_2, {from: owner});
		await this.Kitchen.addBaseIngredientVariation(1, 'Three', slice_3, {from: owner});

		await this.Kitchen.addBaseIngredientVariation(2, 'One', cheese_1, {from: owner});
		await this.Kitchen.addBaseIngredientVariation(2, 'Two', cheese_2, {from: owner});
		await this.Kitchen.addBaseIngredientVariation(2, 'Three', cheese_3, {from: owner});

		// add ingredients

		// add owner as excepted address
		await this.Ingredient.addExceptedAddress(owner);

		nutritionHash = await this.Ingredient.getNutritionHash([14, 50, 20, 4, 6, 39, 25]);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Caviar',
			nutritionHash,
			ipfsHash,
			['Red', 'Yellow', 'Green'],
			[caviar_1, caviar_2, caviar_3],
			['One', 'Two', 'Three'],
			{
				from: owner
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Tuna',
			nutritionHash,
			ipfsHash,
			['Red', 'Yellow', 'Green'],
			[tuna_1, tuna_2, tuna_3],
			['One', 'Two', 'Three'],
			{
				from: owner,
				gas: 10000000000
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Gold',
			nutritionHash,
			ipfsHash,
			['Red', 'Yellow', 'Green'],
			[gold_1, gold_2, gold_3],
			['One', 'Two', 'Three'],
			{
				from: owner,
				gas: 10000000000
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Beef',
			nutritionHash,
			ipfsHash,
			['Red', 'Yellow', 'Green'],
			[beef_1, beef_2, beef_3],
			['One', 'Two', 'Three'],
			{
				from: owner,
				gas: 10000000000
			}
		);

		// add ingredient with variation
		await this.Ingredient.addIngredientWithVariations(
			owner,
			10,
			'Truffle',
			nutritionHash,
			ipfsHash,
			['Red', 'Yellow', 'Green'],
			[truffle_1, truffle_2, truffle_3],
			['One', 'Two', 'Three'],
			{
				from: owner,
				gas: 10000000000
			}
		);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});
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

	describe('prepareDish()', async () => {
		let currentDishIdBefore;

		before('setup contract for preparing dish', async () => {
			// grant OVEN role to minter in Dish contract
			const OvenRole = await this.Dish.OVEN_ROLE();

			await this.Dish.grantRole(OvenRole, minter, {from: owner});

			// transfer ingredients to the user1
			await this.Ingredient.safeTransferFrom(owner, user1, 1, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 2, 1, '0x384', {from: owner});
			await this.Ingredient.safeTransferFrom(owner, user1, 3, 1, '0x384', {from: owner});

			//get current dish id
			currentDishIdBefore = await this.Dish.getCurrentTokenId();

			// prepare the dish
			this.prepareDishTx = await this.Dish.prepareDish(
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

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			expect(dishDetails.dishOwner).to.bignumber.be.eq(user1);
			expect(dishDetails.cooked).to.be.eq(true);
			expect(dishDetails.dishId).to.bignumber.be.eq(new BN('1'));
			expect(dishDetails.totalIngredients).to.bignumber.be.eq(new BN('3'));
			expect(dishDetails.variationIdHash).to.bignumber.be.gt(new BN('0'));
			expect(dishDetails.totalBaseIngredients).to.bignumber.be.eq(new BN('2'));
			expect(dishDetails.flameType).to.bignumber.be.eq(new BN('1'));
			expect(dishDetails.creationTime).to.bignumber.be.gt(new BN('0'));
			expect(dishDetails.completionTime).to.bignumber.be.gt(dishDetails.creationTime);
			expect(dishDetails.multiplier).to.bignumber.be.gt(new BN('0'));

			expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
			expect(currentDishIdAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should rever when non-Chef tries to prepare a dish', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: user1
				}),
				'DishesNFT: ONLY_OVEN_CAN_CALL'
			);
		});

		it('should rever when chef wants to prepare a dish for invalid user', async () => {
			await expectRevert(
				this.Dish.prepareDish(ZERO_ADDRESS, 1, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: minter
				}),
				'DishesNFT: INVALID_USER_ADDRESS'
			);
		});

		it('should rever when chef wants to prepare a dish with invalid dish id', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 5, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: minter
				}),
				'Oven: INVALID_DISH_ID'
			);
			await expectRevert(
				this.Dish.prepareDish(user1, 0, 1, time.duration.minutes('5'), [1, 2, 3, 4, 5], {
					from: minter
				}),
				'Oven: INVALID_DISH_ID'
			);
		});
		it('should rever when chef wants to prepare a dish with insufficient ingredients', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 1, time.duration.minutes('5'), [1], {
					from: minter
				}),
				'Oven: INSUFFICIENT_INGREDIENTS'
			);
		});
		it('should emit when dish is prepared', async () => {
			await expectEvent(this.prepareDishTx, 'DishPrepared', [new BN('1')]);
		});
	});

	describe('serveDish()', () => {
		it('should serve the prepared dish correctly', async () => {
			//get current dish id
			const currentDishId = await this.Dish.getCurrentTokenId();

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join('dishes', 'pizzaDish.svg');

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
				'DishesNFT: ONLY_OVEN_CAN_CALL'
			);
		});
	});

	describe('updatePrepartionTime()', () => {
		let currentDishId;
		it('should update the dish preparation time correctly', async () => {
			currentDishId = await this.Dish.getCurrentTokenId();

			await this.Dish.updatePrepartionTime(currentDishId, 2, time.duration.minutes('1'), {
				from: minter
			});

			const dishDetails = await this.Dish.dish(currentDishId);

			expect(dishDetails.flameType).to.bignumber.be.eq(new BN('2'));
			expect(dishDetails.completionTime).to.bignumber.be.gt(dishDetails.creationTime);
		});

		it('should revert when non oven tries to update the preparation time', async () => {
			await expectRevert(
				this.Dish.updatePrepartionTime(currentDishId, 2, time.duration.minutes('1'), {from: user1}),
				'DishesNFT: ONLY_OVEN_CAN_CALL'
			);
		});
	});

	describe('addExceptedAddress()', () => {
		it('should add the excepted address correctly', async () => {
			const isMinterExceptedBefore = await this.Dish.exceptedAddresses(minter);

			await this.Dish.addExceptedAddress(minter, {from: owner});

			const isMinterExceptedAfter = await this.Dish.exceptedAddresses(minter);

			expect(isMinterExceptedBefore).to.be.eq(false);
			expect(isMinterExceptedAfter).to.be.eq(true);
		});
		it('should revert if owner tries to except address which is already excepted', async () => {
			await expectRevert(
				this.Dish.addExceptedAddress(minter, {from: owner}),
				'DishesNFT: ALREADY_ADDED'
			);
		});

		it('should revert if non-owner tries to except address', async () => {
			await expectRevert(
				this.Dish.addExceptedAddress(user1, {from: user3}),
				'BaseERC721: ONLY_ADMIN_CAN_CALL'
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

			await this.Dish.removeExceptedAddress(minter, {from: owner});

			const isMinterExceptedAfter = await this.Dish.exceptedAddresses(minter);

			expect(isMinterExceptedBefore).to.be.eq(true);
			expect(isMinterExceptedAfter).to.be.eq(false);
		});
		it('should revert if owner tries to remove excepted address which is already removed', async () => {
			await expectRevert(
				this.Dish.removeExceptedAddress(minter, {from: owner}),
				'DishesNFT: ALREADY_REMOVED'
			);
		});

		it('should revert if non-owner tries to except address', async () => {
			await expectRevert(
				this.Dish.removeExceptedAddress(user1, {from: user3}),
				'BaseERC721: ONLY_ADMIN_CAN_CALL'
			);
		});
	});

	describe('updateMin()', () => {
		it('should update the min value correctly', async () => {
			await this.Dish.updateMin(20, {from: owner});

			const min = await this.Dish.min();
			expect(min).to.bignumber.be.eq(new BN('20'));
		});
		it('should revert when non-owner tries to update the min', async () => {
			await expectRevert(
				this.Dish.updateMin(20, {from: minter}),
				'BaseERC721: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when owner tries to update the min with already set value', async () => {
			await expectRevert(this.Dish.updateMin(20, {from: owner}), 'DishesNFT: MIN_ALREADY_SET');
		});
	});

	describe('updateMax()', () => {
		it('should update the max value correctly', async () => {
			await this.Dish.updateMax(60, {from: owner});

			const max = await this.Dish.max();
			expect(max).to.bignumber.be.eq(new BN('60'));
		});
		it('should revert when non-owner tries to update the max', async () => {
			await expectRevert(
				this.Dish.updateMax(20, {from: minter}),
				'BaseERC721: ONLY_ADMIN_CAN_CALL'
			);
		});

		it('should revert when owner tries to update the max with already set value', async () => {
			await expectRevert(this.Dish.updateMax(60, {from: owner}), 'DishesNFT: MAX_ALREADY_SET');
		});
	});

	describe('getMultiplier()', () => {
		it('should return multiplier correctly', async () => {
			const multiplier = await this.Dish.getMultiplier(nutritionHash.toString());

			expect(multiplier[0]).to.bignumber.be.eq(new BN('50'));

			expect(multiplier[1]).to.bignumber.be.eq(new BN('25'));
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
});
