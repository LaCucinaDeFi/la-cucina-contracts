require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN, expectEvent} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const {ZERO_ADDRESS} = require('@openzeppelin/test-helpers/src/constants');
const {PizzaBase, pepper, tomato, mashroom} = require('./ingredientsData');

const fs = require('fs');
const path = require('path');

const DishesNFT = artifacts.require('DishesNFT');
const DishesNFTV2 = artifacts.require('DishesNFTV2');
const IngredientNFT = artifacts.require('IngredientsNFT');

const url = 'https://token-cdn-domain/{id}.json';

contract('DishesNFT', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	let dishId = 1;

	before(async () => {
		this.Ingredient = await deployProxy(IngredientNFT, [url], {initializer: 'initialize'});

		this.Dish = await deployProxy(DishesNFT, [url, this.Ingredient.address], {
			initializer: 'initialize'
		});

		// add pizza base ingredients
		await this.Ingredient.addBaseIngredient('PizzaBase', PizzaBase);

		const currentBaseIngredientID = await this.Ingredient.getCurrentBaseIngredientId();

		// add ingredients
		await this.Ingredient.addIngredient('pepper', url, '100', currentBaseIngredientID, pepper);
		await this.Ingredient.addIngredient('tomato', url, '200', currentBaseIngredientID, tomato);
		await this.Ingredient.addIngredient('mashroom', url, '300', currentBaseIngredientID, mashroom);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});
	});

	describe('initialize()', () => {
		it('should initialize contracts correctly', async () => {
			const ingredientAddress = await this.Dish.ingredientNft();

			expect(ingredientAddress).to.be.eq(this.Ingredient.address);
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
			this.prepareDishTx = await this.Dish.prepareDish(user1, 1, 1000, 3, 197121, {from: minter});
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
			expect(dishDetails.baseIngredientId).to.bignumber.be.eq(new BN('1'));
			expect(dishDetails.fats).to.bignumber.be.eq(new BN('1000'));
			expect(dishDetails.totalIngredients).to.bignumber.be.eq(new BN('3'));
			expect(dishDetails.ingredientsHash).to.bignumber.be.eq(new BN('197121'));

			expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
			expect(currentDishIdAfter).to.bignumber.be.eq(new BN('1'));
		});

		it('should rever when non-Chef tries to prepare a dish', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 1000, 3, 197121, {from: user1}),
				'DishesNFT: ONLY_CHEF_CAN_CALL'
			);
		});

		it('should rever when chef wants to prepare a dish for invalid user', async () => {
			await expectRevert(
				this.Dish.prepareDish(ZERO_ADDRESS, 1, 1000, 3, 197121, {from: minter}),
				'DishesNFT: INVALID_USER_ADDRESS'
			);
		});

		it('should rever when chef wants to prepare a dish with invalid fats', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 0, 3, 197121, {from: minter}),
				'DishesNFT: INVALID_FATS'
			);
		});

		it('should rever when chef wants to prepare a dish with invalid ingredient hash', async () => {
			await expectRevert(
				this.Dish.prepareDish(user1, 1, 1000, 3, 0, {from: minter}),
				'DishesNFT: INVALID_INGREDIENT_HASH'
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
			// get user1`s dish balance
			const userDishBalAfter = await this.Dish.balanceOf(user1, currentDishId);

			const dish = await this.Dish.dish(userDishBalAfter);

			expect(userDishBalBefore).to.bignumber.be.eq(new BN('1'));
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
