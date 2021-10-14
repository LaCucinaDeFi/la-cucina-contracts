require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN, expectEvent} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const {ZERO_ADDRESS} = require('@openzeppelin/test-helpers/src/constants');

const {slice_1, slice_2, slice_3} = require('./svgs/Slice');
const {cheese_1, cheese_2, cheese_3} = require('./svgs/Cheese');
const {caviar_1, caviar_2, caviar_3} = require('./svgs/Caviar');
const {tuna_1, tuna_2, tuna_3} = require('./svgs/Tuna');
const {gold_1, gold_2, gold_3} = require('./svgs/Gold');
const {beef_1, beef_2, beef_3} = require('./svgs/Beef');
const {truffle_1, truffle_2, truffle_3} = require('./svgs/Truffle');
const {getNutritionsHash} = require('./helper/NutrisionHash');

const fs = require('fs');
const path = require('path');

const DishesNFT = artifacts.require('DishesNFT');
const DishesNFTV2 = artifacts.require('DishesNFTV2');
const IngredientNFT = artifacts.require('IngredientsNFT');
const Pantry = artifacts.require('Pantry');

const url = 'https://token-cdn-domain/{id}.json';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';

contract.skip('DishesNFT', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const royaltyReceiver = accounts[8];
	const royaltyFee = '100';

	let dishId = 1;
	let currentDishId;

	before(async () => {
		// deploy NFT token
		this.Ingredient = await deployProxy(IngredientNFT, [url, royaltyReceiver, royaltyFee], {
			initializer: 'initialize'
		});

		this.Pantry = await deployProxy(Pantry, [], {
			initializer: 'initialize'
		});

		this.Dish = await deployProxy(
			DishesNFT,
			['DishesNFT', 'Dish', url, this.Ingredient.address, this.Pantry.address],
			{
				initializer: 'initialize'
			}
		);

		// add dish in pantry
		await this.Pantry.addDish('Pizza', {from: owner});
		currentDishId = await this.Pantry.getCurrentDishId();

		// add base Ingredients for dish
		await this.Pantry.addBaseIngredientForDish(currentDishId, 'Slice', {from: owner});
		await this.Pantry.addBaseIngredientForDish(currentDishId, 'Cheese', {from: owner});

		// add variations for base ingredients
		// here variation name should be strictly like this. variationName = IngredientName_variationName. ex. Slice_1, Cheese_2
		// NOTE: svg id and the IngredientName_variationName should be same. <g id= "Slice_One">, <g id = "Cheese_Two">
		await this.Pantry.addBaseIngredientVariation(1, 'One', slice_1, {from: owner});
		await this.Pantry.addBaseIngredientVariation(1, 'Two', slice_2, {from: owner});
		await this.Pantry.addBaseIngredientVariation(1, 'Three', slice_3, {from: owner});

		await this.Pantry.addBaseIngredientVariation(2, 'One', cheese_1, {from: owner});
		await this.Pantry.addBaseIngredientVariation(2, 'Two', cheese_2, {from: owner});
		await this.Pantry.addBaseIngredientVariation(2, 'Three', cheese_3, {from: owner});

		// add ingredients
		// here ingredient name should be strictly like this. variationName = name_variationId. ex. Caviar_1, Tuna_2
		// NOTE: svg id and the name_variationId should be same. <g id= "Caviar_1">, <g id = "Tuna_2">

		const CaviarNutrisionHash = await getNutritionsHash([14, 50, 20, 4, 6, 39, 25, 8]);

		await this.Ingredient.addIngredient('Caviar', CaviarNutrisionHash, ipfsHash);
		await this.Ingredient.addIngredient('Tuna', CaviarNutrisionHash, ipfsHash);
		await this.Ingredient.addIngredient('Gold', CaviarNutrisionHash, ipfsHash);
		await this.Ingredient.addIngredient('Beef', CaviarNutrisionHash, ipfsHash);
		await this.Ingredient.addIngredient('Truffle', CaviarNutrisionHash, ipfsHash);

		// add ingredient variations

		this.add2Tx = await this.Ingredient.addIngredientVariation(1, 'One', caviar_1);
		await this.Ingredient.addIngredientVariation(1, 'Two', caviar_2);
		await this.Ingredient.addIngredientVariation(1, 'Three', caviar_3);

		await this.Ingredient.addIngredientVariation(2, 'One', tuna_1);
		await this.Ingredient.addIngredientVariation(2, 'Two', tuna_2);
		await this.Ingredient.addIngredientVariation(2, 'Three', tuna_3);

		await this.Ingredient.addIngredientVariation(3, 'One', gold_1);
		await this.Ingredient.addIngredientVariation(3, 'Two', gold_2);
		await this.Ingredient.addIngredientVariation(3, 'Three', gold_3);

		await this.Ingredient.addIngredientVariation(4, 'One', beef_1);
		await this.Ingredient.addIngredientVariation(4, 'Two', beef_2);
		await this.Ingredient.addIngredientVariation(4, 'Three', beef_3);

		this.add3Tx = await this.Ingredient.addIngredientVariation(5, 'One', truffle_1);
		await this.Ingredient.addIngredientVariation(5, 'Two', truffle_2);
		await this.Ingredient.addIngredientVariation(5, 'Three', truffle_3);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});
	});

	describe('initialize()', () => {
		it('should initialize contracts correctly', async () => {
			const ingredientAddress = await this.Dish.ingredientNft();
			const pantryAddress = await this.Dish.pantry();

			expect(ingredientAddress).to.be.eq(this.Ingredient.address);
			expect(pantryAddress).to.be.eq(this.Pantry.address);
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
			// grant Chef role to minter in Dish contract
			const ChefRole = await this.Dish.CHEF_ROLE();

			await this.Dish.grantRole(ChefRole, minter, {from: owner});

			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 2, 1, {from: minter});
			await this.Ingredient.mint(user1, 3, 1, {from: minter});

			//get current dish id
			currentDishIdBefore = await this.Dish.getCurrentNftId();

			// prepare the dish
			this.prepareDishTx = await this.Dish.prepareDish(
				user1,
				1,
				1000,
				2,
				3,
				197121,
				33620225,
				1537,
				{from: minter}
			);
		});

		it('should prepare dish correctly', async () => {
			//get current dish id
			const currentDishIdAfter = await this.Dish.getCurrentNftId();

			const dishDetails = await this.Dish.dish(currentDishIdAfter);

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishIdAfter);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			expect(dishDetails.dishOwner).to.bignumber.be.eq(user1);
			expect(dishDetails.cooked).to.be.eq(true);
			expect(dishDetails.dishId).to.bignumber.be.eq(new BN('1'));
			expect(dishDetails.fats).to.bignumber.be.eq(new BN('1000'));
			expect(dishDetails.totalIngredients).to.bignumber.be.eq(new BN('3'));
			expect(dishDetails.ingredientsHash).to.bignumber.be.eq(new BN('197121'));
			expect(dishDetails.totalBaseIngredients).to.bignumber.be.eq(new BN('2'));
			expect(dishDetails.ingredientVariationHash).to.bignumber.be.eq(new BN('33620225'));
			expect(dishDetails.baseVariationHash).to.bignumber.be.eq(new BN('1537'));

			expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
			expect(currentDishIdAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should rever when non-Chef tries to prepare a dish', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 1000, 2, 3, 197121, 33620225, 1537, {from: user1}),
				'DishesNFT: ONLY_CHEF_CAN_CALL'
			);
		});

		it('should rever when chef wants to prepare a dish for invalid user', async () => {
			await expectRevert(
				this.Dish.prepareDish(ZERO_ADDRESS, 1, 1000, 2, 3, 197121, 33620225, 1537, {from: minter}),
				'DishesNFT: INVALID_USER_ADDRESS'
			);
		});

		it('should rever when chef wants to prepare a dish with invalid fats', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 0, 2, 3, 197121, 33620225, 1537, {from: minter}),
				'DishesNFT: INVALID_FATS'
			);
		});

		it('should revert when invalid ingredient id is used to prepare dish', async () => {
			await expectEvent(this.prepareDishTx, 'DishPrepared', [new BN('1')]);
		});
	});

	describe('serveDish()', () => {
		it('should serve the prepared dish correctly', async () => {
			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

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

	describe('uncookDish()', async () => {
		let currentDishId;

		before(async () => {
			currentDishId = await this.Dish.getCurrentNftId();

			// get user1`s dish balance
			userDishBalBefore = await this.Dish.balanceOf(user1, currentDishId);

			// uncook dish
			await this.Dish.uncookDish(currentDishId, {from: minter});
		});

		it('should uncook dish correctly', async () => {
			const dish = await this.Dish.dish(currentDishId);

			expect(dish.cooked).to.be.eq(false);
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
				'DishesNFT: ONLY_CHEF_CAN_CALL'
			);
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
