require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const {slice_1, slice_2, slice_3} = require('./svgs/Slice');
const {cheese_1, cheese_2, cheese_3} = require('./svgs/Cheese');
const {caviar_1, caviar_2, caviar_3} = require('./svgs/Caviar');
const {tuna_1, tuna_2, tuna_3} = require('./svgs/Tuna');
const {gold_1, gold_2, gold_3} = require('./svgs/Gold');
const {beef_1, beef_2, beef_3} = require('./svgs/Beef');
const {truffle_1, truffle_2, truffle_3} = require('./svgs/Truffle');

const fs = require('fs');
const path = require('path');

const Chef = artifacts.require('Chef');
const ChefV2 = artifacts.require('ChefV2');

const IngredientNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const Pantry = artifacts.require('Pantry');

const url = 'https://token-cdn-domain/{id}.json';

contract('Chef', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	let dishId = 1;

	before(async () => {
		this.Ingredient = await deployProxy(IngredientNFT, [url], {initializer: 'initialize'});

		this.Pantry = await deployProxy(Pantry, [], {
			initializer: 'initialize'
		});

		this.Dish = await deployProxy(DishesNFT, [url, this.Ingredient.address, this.Pantry.address], {
			initializer: 'initialize'
		});

		this.Chef = await deployProxy(
			Chef,
			[this.Ingredient.address, this.Dish.address, this.Pantry.address],
			{
				initializer: 'initialize'
			}
		);

		// add minter in ingredient contract
		const minterRole = await this.Ingredient.MINTER_ROLE();
		await this.Ingredient.grantRole(minterRole, minter, {from: owner});

		// add Chef contract as exceptedFrom address in ingredient
		await this.Ingredient.addExceptedFromAddress(this.Chef.address, {from: owner});

		// add Chef contract as excepted address in ingredient
		await this.Ingredient.addExceptedAddress(this.Chef.address, {from: owner});
	});

	describe('initialize()', () => {
		it('should initialize contracts correctly', async () => {
			const ingredientAddress = await this.Chef.ingredientNft();
			const dishesAddress = await this.Chef.dishesNft();

			expect(ingredientAddress).to.be.eq(this.Ingredient.address);
			expect(dishesAddress).to.be.eq(this.Dish.address);
		});

		it('should grant the admin role to deployer', async () => {
			const adminRole = await this.Chef.DEFAULT_ADMIN_ROLE();

			const isAdmin = await this.Chef.hasRole(adminRole, owner);
			expect(isAdmin).to.be.eq(true);
		});
	});

	describe('New Pizza Dish', () => {
		let user1CaviarBalance;
		let user1TunaBalance;
		let user1GoldBalance;
		let user1BeefBalance;
		let user1TruffleBalance;

		let chefCaviarBalance;
		let chefTunaBalance;
		let chefGoldBalance;
		let chefBeefBalance;
		let chefTruffleBalance;

		let currentDishIdBefore;
		before('add pizza base and ingredients', async () => {
			// grant Chef role to Chef contract in Dish contract
			const ChefRole = await this.Dish.CHEF_ROLE();

			await this.Dish.grantRole(ChefRole, this.Chef.address, {from: owner});

			// approve ingredients to ChefContract
			await this.Ingredient.setApprovalForAll(this.Chef.address, true, {from: user1});

			// ****************************************************************************

			// add dish in pantry
			await this.Pantry.addDish('Pizza', {from: owner});
			currentDishId = await this.Pantry.getCurrentDishId();

			// add base Ingredients for dish
			await this.Pantry.addBaseIngredientForDish(currentDishId, 'Slice', {from: owner});
			await this.Pantry.addBaseIngredientForDish(currentDishId, 'Cheese', {from: owner});

			// add variations for base ingredients
			// here variation name should be strictly like this. variationName = name_variationId. ex. Slice_1, Cheese_2
			// NOTE: svg id and the name_variationId should be same. <g id= "Slice_1">, <g id = "Cheese_2">
			await this.Pantry.addBaseIngredientVariation(1, 'Slice', slice_1, {from: owner});
			await this.Pantry.addBaseIngredientVariation(1, 'Slice', slice_2, {from: owner});
			await this.Pantry.addBaseIngredientVariation(1, 'Slice', slice_3, {from: owner});

			await this.Pantry.addBaseIngredientVariation(2, 'Cheese', cheese_1, {from: owner});
			await this.Pantry.addBaseIngredientVariation(2, 'Cheese', cheese_2, {from: owner});
			await this.Pantry.addBaseIngredientVariation(2, 'Cheese', cheese_3, {from: owner});

			// add ingredients
			// here ingredient name should be strictly like this. variationName = name_variationId. ex. Caviar_1, Tuna_2
			// NOTE: svg id and the name_variationId should be same. <g id= "Caviar_1">, <g id = "Tuna_2">

			await this.Ingredient.addIngredient('Caviar', url, '200');
			await this.Ingredient.addIngredient('Tuna', url, '300');
			await this.Ingredient.addIngredient('Gold', url, '2000');
			await this.Ingredient.addIngredient('Beef', url, '1500');
			await this.Ingredient.addIngredient('Truffle', url, '500');

			// add ingredient variations

			this.add2Tx = await this.Ingredient.addIngredientVariation(1, caviar_1);
			await this.Ingredient.addIngredientVariation(1, caviar_2);
			await this.Ingredient.addIngredientVariation(1, caviar_3);

			await this.Ingredient.addIngredientVariation(2, tuna_1);
			await this.Ingredient.addIngredientVariation(2, tuna_2);
			await this.Ingredient.addIngredientVariation(2, tuna_3);

			await this.Ingredient.addIngredientVariation(3, gold_1);
			await this.Ingredient.addIngredientVariation(3, gold_2);
			await this.Ingredient.addIngredientVariation(3, gold_3);

			await this.Ingredient.addIngredientVariation(4, beef_1);
			await this.Ingredient.addIngredientVariation(4, beef_2);
			await this.Ingredient.addIngredientVariation(4, beef_3);

			this.add3Tx = await this.Ingredient.addIngredientVariation(5, truffle_1);
			await this.Ingredient.addIngredientVariation(5, truffle_2);
			await this.Ingredient.addIngredientVariation(5, truffle_3);
		});

		it('should make pizza with all ingredients', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 2, 1, {from: minter});
			await this.Ingredient.mint(user1, 3, 1, {from: minter});
			await this.Ingredient.mint(user1, 4, 1, {from: minter});
			await this.Ingredient.mint(user1, 5, 1, {from: minter});

			user1CaviarBalance = await this.Ingredient.balanceOf(user1, 1);
			user1TunaBalance = await this.Ingredient.balanceOf(user1, 2);
			user1GoldBalance = await this.Ingredient.balanceOf(user1, 3);
			user1BeefBalance = await this.Ingredient.balanceOf(user1, 4);
			user1TruffleBalance = await this.Ingredient.balanceOf(user1, 5);

			chefCaviarBalance = await this.Ingredient.balanceOf(this.Chef.address, 1);
			chefTunaBalance = await this.Ingredient.balanceOf(this.Chef.address, 2);
			chefGoldBalance = await this.Ingredient.balanceOf(this.Chef.address, 3);
			chefBeefBalance = await this.Ingredient.balanceOf(this.Chef.address, 4);
			chefTruffleBalance = await this.Ingredient.balanceOf(this.Chef.address, 5);

			//get current dish id
			currentDishIdBefore = await this.Dish.getCurrentNftId();

			// prepare the dish
			this.prepareDish1Tx = await this.Chef.prepareDish(1, [1, 2, 3, 4, 5], {from: user1});
			//	console.log('prepareDish1: ', this.prepareDish1Tx);

			// get users ingredient balance
			const user1CaviarBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
			const user1TunaBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
			const user1GoldBalanceAfter = await this.Ingredient.balanceOf(user1, 3);
			const user1BeefBalanceAfter = await this.Ingredient.balanceOf(user1, 4);
			const user1TruffleBalanceAfter = await this.Ingredient.balanceOf(user1, 5);

			// get Chef contract`s ingredient balance
			const chefCaviarBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 1);
			const chefTunaBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 2);
			const chefGoldBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 3);
			const chefBeefBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 4);
			const chefTruffleBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 5);

			expect(user1CaviarBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1TunaBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1GoldBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1BeefBalance).to.bignumber.be.eq(new BN('1'));
			expect(user1TruffleBalance).to.bignumber.be.eq(new BN('1'));

			expect(user1CaviarBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1TunaBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1GoldBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1BeefBalanceAfter).to.bignumber.be.eq(new BN('0'));
			expect(user1TruffleBalanceAfter).to.bignumber.be.eq(new BN('0'));

			expect(chefCaviarBalance).to.bignumber.be.eq(new BN('0'));
			expect(chefTunaBalance).to.bignumber.be.eq(new BN('0'));
			expect(chefGoldBalance).to.bignumber.be.eq(new BN('0'));
			expect(chefBeefBalance).to.bignumber.be.eq(new BN('0'));
			expect(chefTruffleBalance).to.bignumber.be.eq(new BN('0'));

			expect(chefCaviarBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(chefTunaBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(chefGoldBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(chefBeefBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(chefTruffleBalanceAfter).to.bignumber.be.eq(new BN('1'));

			//get current dish id
			const preparedDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, preparedDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));
			expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
			expect(preparedDishId).to.bignumber.be.eq(new BN('1'));
		});

		it('should serve the prepared dish correctly', async () => {
			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join('dishes', 'pizza' + currentDishId.toString() + '.svg');
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should prepare pizza using cheese and caviar only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 2, 1, {from: minter});

			// prepare the dish
			this.prepareDish2Tx = await this.Chef.prepareDish(1, [1, 2], {from: user1});
			//	console.log('prepareDish2: ', this.prepareDish2Tx);

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should prepare pizza using caviar and tuna only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 2, 1, {from: minter});

			// prepare the dish
			await this.Chef.prepareDish(1, [1, 2], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 4, 1, {from: minter});

			// prepare the dish
			await this.Chef.prepareDish(1, [1, 4], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 5, 1, {from: minter});

			// prepare the dish
			await this.Chef.prepareDish(1, [1, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and Truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 5, 1, {from: minter});

			// prepare the dish
			await this.Chef.prepareDish(1, [1, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using cheese and tuna and beef only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 2, 1, {from: minter});
			await this.Ingredient.mint(user1, 5, 1, {from: minter});

			// prepare the dish
			this.prepareDish3Tx = await this.Chef.prepareDish(1, [1, 2, 5], {from: user1});
			//	console.log('prepareDish3: ', this.prepareDish3Tx);

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using tuna, gold, beef and truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 2, 1, {from: minter});
			await this.Ingredient.mint(user1, 3, 1, {from: minter});
			await this.Ingredient.mint(user1, 4, 1, {from: minter});
			await this.Ingredient.mint(user1, 5, 1, {from: minter});

			// prepare the dish
			this.prepareDish4Tx = await this.Chef.prepareDish(1, [2, 3, 4, 5], {from: user1});
			//	console.log('prepareDish4: ', this.prepareDish4Tx);

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});
		it('should prepare pizza using caviar, gold,and truffle only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 2, 1, {from: minter});
			await this.Ingredient.mint(user1, 4, 1, {from: minter});
			await this.Ingredient.mint(user1, 5, 1, {from: minter});

			// prepare the dish
			await this.Chef.prepareDish(1, [2, 4, 5], {from: user1});

			//get current dish id
			const currentDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, currentDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(currentDishId);

			const addresssPath = await path.join(
				'dishes',
				'newPizza' + currentDishId.toString() + '.svg'
			);
			dishId++;

			await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
				if (err) throw err;
			});
		});

		it('should revert when invalid baseIngredientId is used to prepare dish', async () => {
			await expectRevert(
				this.Chef.prepareDish(4, [1, 2, 3], {from: user1}),
				'Chef: INVALID_DISH_ID'
			);
		});

		it('should revert when no ingredient ids are used to prepare dish', async () => {
			await expectRevert(
				this.Chef.prepareDish(1, [], {from: user1}),
				'Chef: INSUFFICIENT_INGREDIENTS'
			);
		});

		it('should revert when invalid ingredient id is used to prepare dish', async () => {
			await expectRevert(
				this.Chef.prepareDish(1, [7, 1, 3], {from: user1}),
				'Chef: INVALID_INGREDIENT_ID'
			);
		});
	});

	describe('uncookDish()', async () => {
		let user1CaviarBalance;
		let user1TunaBalance;
		let user1GoldBalance;
		let user1BeefBalance;
		let user1TruffleBalance;

		let chefCaviarBalance;
		let chefTunaBalance;
		let chefGoldBalance;
		let chefBeefBalance;
		let chefTruffleBalance;

		let currentDishId;

		before(async () => {
			currentDishId = await this.Dish.getCurrentNftId();

			// get user1`s dish balance
			userDishBalBefore = await this.Dish.balanceOf(user1, 1);

			// get user1`s ingredient balance

			user1CaviarBalance = await this.Ingredient.balanceOf(user1, 1);
			user1TunaBalance = await this.Ingredient.balanceOf(user1, 2);
			user1GoldBalance = await this.Ingredient.balanceOf(user1, 3);
			user1BeefBalance = await this.Ingredient.balanceOf(user1, 4);
			user1TruffleBalance = await this.Ingredient.balanceOf(user1, 5);

			// get chef contract`s ingredient balance
			chefCaviarBalance = await this.Ingredient.balanceOf(this.Chef.address, 1);
			chefTunaBalance = await this.Ingredient.balanceOf(this.Chef.address, 2);
			chefGoldBalance = await this.Ingredient.balanceOf(this.Chef.address, 3);
			chefBeefBalance = await this.Ingredient.balanceOf(this.Chef.address, 4);
			chefTruffleBalance = await this.Ingredient.balanceOf(this.Chef.address, 5);

			// approve dish to ChefContract
			await this.Dish.setApprovalForAll(this.Chef.address, true, {from: user1});

			// uncook dish
			this.uncookTx = await this.Chef.uncookDish(1, {from: user1});
			//console.log('uncookDish: ', this.uncookTx);
		});

		it('should uncook dish correctly', async () => {
			// get user1`s dish balance
			const userDishBalAfter = await this.Dish.balanceOf(user1, 1);

			// get Chef contract`s dish balance
			const ChefContractBal = await this.Dish.balanceOf(this.Chef.address, 1);

			// get users ingredient balance
			const user1CaviarBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
			const user1TunaBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
			const user1GoldBalanceAfter = await this.Ingredient.balanceOf(user1, 3);
			const user1BeefBalanceAfter = await this.Ingredient.balanceOf(user1, 4);
			const user1TruffleBalanceAfter = await this.Ingredient.balanceOf(user1, 5);

			// get Chef contract`s ingredient balance
			const chefCaviarBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 1);
			const chefTunaBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 2);
			const chefGoldBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 3);
			const chefBeefBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 4);
			const chefTruffleBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 5);

			expect(userDishBalBefore).to.bignumber.be.eq(new BN('1'));
			expect(userDishBalAfter).to.bignumber.be.eq(new BN('0'));

			expect(ChefContractBal).to.bignumber.be.eq(new BN('1'));

			expect(user1CaviarBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1TunaBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1GoldBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1BeefBalance).to.bignumber.be.eq(new BN('0'));
			expect(user1TruffleBalance).to.bignumber.be.eq(new BN('0'));

			expect(user1CaviarBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1TunaBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1GoldBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1BeefBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(user1TruffleBalanceAfter).to.bignumber.be.eq(new BN('1'));

			expect(chefCaviarBalance).to.bignumber.be.eq(new BN('7'));
			expect(chefTunaBalance).to.bignumber.be.eq(new BN('6'));
			expect(chefGoldBalance).to.bignumber.be.eq(new BN('2'));
			expect(chefBeefBalance).to.bignumber.be.eq(new BN('4'));
			expect(chefTruffleBalance).to.bignumber.be.eq(new BN('6'));

			expect(chefCaviarBalanceAfter).to.bignumber.be.eq(new BN('6'));
			expect(chefTunaBalanceAfter).to.bignumber.be.eq(new BN('5'));
			expect(chefGoldBalanceAfter).to.bignumber.be.eq(new BN('1'));
			expect(chefBeefBalanceAfter).to.bignumber.be.eq(new BN('3'));
			expect(chefTruffleBalanceAfter).to.bignumber.be.eq(new BN('5'));
		});

		it('should add the dish id uncooked dish ids list in Chef contract', async () => {
			const uncookedDishIds = await this.Chef.uncookedDishIds(0);

			expect(uncookedDishIds).to.bignumber.be.eq(new BN('1'));
		});

		it('should revert when non-dishOwner tries to uncook the dish', async () => {
			await expectRevert(
				this.Chef.uncookDish(currentDishId, {from: user2}),
				'Chef: ONLY_DISH_OWNER_CAN_UNCOOK'
			);
		});

		it('should revert when dishOwner tries to uncook the dish with invalid dish id', async () => {
			await expectRevert(this.Chef.uncookDish(0, {from: user1}), 'Chef: INVALID_DISH_ID');
			await expectRevert(this.Chef.uncookDish(11, {from: user1}), 'Chef: INVALID_DISH_ID');
		});

		it('should revert when user wants to get svg of uncooked dish', async () => {
			await expectRevert(
				this.Dish.serveDish(1, {from: user1}),
				'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH'
			);
		});
	});

	describe('upgradeProxy()', () => {
		let versionBeforeUpgrade;
		before('upgradeProxy', async () => {
			versionBeforeUpgrade = await this.Chef.getVersionNumber();

			// upgrade contract
			await upgradeProxy(this.Chef.address, ChefV2);
		});

		it('should upgrade contract correctly', async () => {
			const versionAfterUpgrade = await this.Chef.getVersionNumber();

			expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
			expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

			expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
			expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
			expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
		});
	});
});
