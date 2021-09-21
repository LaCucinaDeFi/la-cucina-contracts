require('chai').should();
const {expect} = require('chai');
const {expectRevert, BN} = require('@openzeppelin/test-helpers');
const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

//const {PizzaBase, pepper, tomato, mashroom} = require('./ingredientsData');

// const {
// 	sliceBase_1,
// 	sliceBase_2,
// 	sliceBase_3,
// 	cheese_1,
// 	cheese_2,
// 	cheese_3,
// 	caviar_1,
// 	caviar_2,
// 	caviar_3,
// 	tuna_1,
// 	tuna_2,
// 	tuna_3,
// 	gold_1,
// 	gold_2,
// 	gold_3,
// 	beef_1,
// 	beef_2,
// 	beef_3,
// 	truffle_1,
// 	truffle_2,
// 	truffle_3
// } = require('./svgs/pizzaIngredients');

const {slice_1, slice_2, slice_3} = require('./svgs/Slice');
const {cheese_1, cheese_2, cheese_3} = require('./svgs/Cheese');
const {caviar_1, caviar_2, caviar_3} = require('./svgs/Caviar');
const {tuna_1, tuna_2, tuna_3} = require('./svgs/Tuna');
const {gold_1, gold_2, gold_3} = require('./svgs/Gold');

const fs = require('fs');
const path = require('path');
const {PizzaBase} = require('./ingredientsData');

const Chef = artifacts.require('Chef');
const ChefV2 = artifacts.require('ChefV2');

const IngredientNFT = artifacts.require('IngredientsNFT');
const DishesNFT = artifacts.require('DishesNFT');
const Pantry = artifacts.require('Pantry');

const IngrdientABI = require('../build/contracts/IngredientsNFT.json');

const url = 'https://token-cdn-domain/{id}.json';

contract.only('Chef', (accounts) => {
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

		// // add pizza base ingredients
		// await this.Ingredient.addBaseIngredient('Slice', PizzaBase);

		// // add ingredients
		// await this.Ingredient.addIngredient('pepper', url, '100', pepper);
		// await this.Ingredient.addIngredient('tomato', url, '200', tomato);
		// await this.Ingredient.addIngredient('mashroom', url, '300', mashroom);

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

	// describe('prepareDish()', async () => {
	// 	let user1PepperBalance;
	// 	let user1TomatoBalance;
	// 	let user1MashroomBalance;

	// 	let chefPepperBalance;
	// 	let chef1TomatoBalance;
	// 	let chef1MashroomBalance;

	// 	let currentDishIdBefore;

	// 	before('setup contract for preparing dish', async () => {
	// 		// grant Chef role to Chef contract in Dish contract
	// 		const ChefRole = await this.Dish.CHEF_ROLE();

	// 		await this.Dish.grantRole(ChefRole, this.Chef.address, {from: owner});

	// 		// mint ingredients to the user1
	// 		await this.Ingredient.mint(user1, 1, 1, {from: minter});
	// 		await this.Ingredient.mint(user1, 2, 1, {from: minter});
	// 		await this.Ingredient.mint(user1, 3, 1, {from: minter});

	// 		user1PepperBalance = await this.Ingredient.balanceOf(user1, 1);
	// 		user1TomatoBalance = await this.Ingredient.balanceOf(user1, 2);
	// 		user1MashroomBalance = await this.Ingredient.balanceOf(user1, 3);

	// 		chefPepperBalance = await this.Ingredient.balanceOf(this.Chef.address, 1);
	// 		chef1TomatoBalance = await this.Ingredient.balanceOf(this.Chef.address, 2);
	// 		chef1MashroomBalance = await this.Ingredient.balanceOf(this.Chef.address, 3);

	// 		//get current dish id
	// 		currentDishIdBefore = await this.Dish.getCurrentNftId();
	// 	});

	// 	it('should prepare dish correctly', async () => {
	// 		// approve ingredients to ChefContract
	// 		await this.Ingredient.setApprovalForAll(this.Chef.address, true, {from: user1});

	// 		// prepare the dish
	// 		await this.Chef.prepareDish(1, [1, 2, 3], {from: user1});

	// 		// get users ingredient balance
	// 		const user1PepperBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
	// 		const user1TomatoBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
	// 		const user1MashroomBalanceAfter = await this.Ingredient.balanceOf(user1, 3);

	// 		// get Chef contract`s ingredient balance
	// 		const chefPepperBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 1);
	// 		const chef1TomatoBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 2);
	// 		const chef1MashroomBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 3);

	// 		//get current dish id
	// 		const currentDishIdAfter = await this.Dish.getCurrentNftId();

	// 		//get user1`s dish balance
	// 		const dishBalance = await this.Dish.balanceOf(user1, currentDishIdAfter);

	// 		expect(dishBalance).to.bignumber.be.eq(new BN('1'));

	// 		expect(user1PepperBalance).to.bignumber.be.eq(new BN('1'));
	// 		expect(user1TomatoBalance).to.bignumber.be.eq(new BN('1'));
	// 		expect(user1MashroomBalance).to.bignumber.be.eq(new BN('1'));

	// 		expect(user1PepperBalanceAfter).to.bignumber.be.eq(new BN('0'));
	// 		expect(user1TomatoBalanceAfter).to.bignumber.be.eq(new BN('0'));
	// 		expect(user1MashroomBalanceAfter).to.bignumber.be.eq(new BN('0'));

	// 		expect(chefPepperBalance).to.bignumber.be.eq(new BN('0'));
	// 		expect(chef1TomatoBalance).to.bignumber.be.eq(new BN('0'));
	// 		expect(chef1MashroomBalance).to.bignumber.be.eq(new BN('0'));

	// 		expect(chefPepperBalanceAfter).to.bignumber.be.eq(new BN('1'));
	// 		expect(chef1TomatoBalanceAfter).to.bignumber.be.eq(new BN('1'));
	// 		expect(chef1MashroomBalanceAfter).to.bignumber.be.eq(new BN('1'));

	// 		expect(currentDishIdBefore).to.bignumber.be.eq(new BN('0'));
	// 		expect(currentDishIdAfter).to.bignumber.be.eq(new BN('1'));
	// 	});

	// 	it('should serve the prepared dish correctly', async () => {
	// 		//get current dish id
	// 		const currentDishId = await this.Dish.getCurrentNftId();

	// 		//get the svg of dish
	// 		const dishSvg = await this.Dish.serveDish(currentDishId);

	// 		const addresssPath = await path.join('dishes', 'pizza' + currentDishId.toString() + '.svg');
	// 		dishId++;

	// 		await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
	// 			if (err) throw err;
	// 		});
	// 	});

	// 	it('should revert when invalid baseIngredientId is used to prepare dish', async () => {
	// 		await expectRevert(
	// 			this.Chef.prepareDish(4, [1, 2, 3], {from: user1}),
	// 			'Chef: INVALID_BASE_INGREDIENT_ID'
	// 		);
	// 	});

	// 	it('should revert when no ingredient ids are used to prepare dish', async () => {
	// 		await expectRevert(
	// 			this.Chef.prepareDish(1, [], {from: user1}),
	// 			'DishesNFT: INSUFFICIENT_INGREDIENTS'
	// 		);
	// 	});

	// 	it('should revert when invalid ingredient id is used to prepare dish', async () => {
	// 		await expectRevert(
	// 			this.Chef.prepareDish(1, [5, 1, 3], {from: user1}),
	// 			'Chef: INVALID_INGREDIENT_ID'
	// 		);
	// 	});
	// });

	// describe('uncookDish()', async () => {
	// 	let userDishBalBefore;
	// 	let user1PepperBalance;
	// 	let user1TomatoBalance;

	// 	let chefPepperBalance;
	// 	let chef1TomatoBalance;
	// 	let chef1MashroomBalance;

	// 	let user1MashroomBalance;
	// 	let currentDishId;

	// 	before(async () => {
	// 		currentDishId = await this.Dish.getCurrentNftId();

	// 		// get user1`s dish balance
	// 		userDishBalBefore = await this.Dish.balanceOf(user1, currentDishId);

	// 		// get user1`s ingredient balance

	// 		user1PepperBalance = await this.Ingredient.balanceOf(user1, 1);
	// 		user1TomatoBalance = await this.Ingredient.balanceOf(user1, 2);
	// 		user1MashroomBalance = await this.Ingredient.balanceOf(user1, 3);

	// 		// get chef contract`s ingredient balance
	// 		chefPepperBalance = await this.Ingredient.balanceOf(this.Chef.address, 1);
	// 		chef1TomatoBalance = await this.Ingredient.balanceOf(this.Chef.address, 2);
	// 		chef1MashroomBalance = await this.Ingredient.balanceOf(this.Chef.address, 3);

	// 		// approve dish to ChefContract
	// 		await this.Dish.setApprovalForAll(this.Chef.address, true, {from: user1});

	// 		// uncook dish
	// 		await this.Chef.uncookDish(currentDishId, {from: user1});
	// 	});

	// 	it('should uncook dish correctly', async () => {
	// 		// get user1`s dish balance
	// 		const userDishBalAfter = await this.Dish.balanceOf(user1, currentDishId);

	// 		// get Chef contract`s dish balance
	// 		const ChefContractBal = await this.Dish.balanceOf(this.Chef.address, currentDishId);

	// 		// get users ingredient balance
	// 		const user1PepperBalanceAfter = await this.Ingredient.balanceOf(user1, 1);
	// 		const user1TomatoBalanceAfter = await this.Ingredient.balanceOf(user1, 2);
	// 		const user1MashroomBalanceAfter = await this.Ingredient.balanceOf(user1, 3);

	// 		// get Chef contract`s ingredient balance
	// 		const chefPepperBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 1);
	// 		const chef1TomatoBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 2);
	// 		const chef1MashroomBalanceAfter = await this.Ingredient.balanceOf(this.Chef.address, 3);

	// 		expect(userDishBalBefore).to.bignumber.be.eq(new BN('1'));
	// 		expect(userDishBalAfter).to.bignumber.be.eq(new BN('0'));

	// 		expect(ChefContractBal).to.bignumber.be.eq(new BN('1'));

	// 		expect(user1PepperBalance).to.bignumber.be.eq(new BN('0'));
	// 		expect(user1TomatoBalance).to.bignumber.be.eq(new BN('0'));
	// 		expect(user1MashroomBalance).to.bignumber.be.eq(new BN('0'));

	// 		expect(user1PepperBalanceAfter).to.bignumber.be.eq(new BN('1'));
	// 		expect(user1TomatoBalanceAfter).to.bignumber.be.eq(new BN('1'));
	// 		expect(user1MashroomBalanceAfter).to.bignumber.be.eq(new BN('1'));

	// 		expect(chefPepperBalance).to.bignumber.be.eq(new BN('1'));
	// 		expect(chef1TomatoBalance).to.bignumber.be.eq(new BN('1'));
	// 		expect(chef1MashroomBalance).to.bignumber.be.eq(new BN('1'));

	// 		expect(chefPepperBalanceAfter).to.bignumber.be.eq(new BN('0'));
	// 		expect(chef1TomatoBalanceAfter).to.bignumber.be.eq(new BN('0'));
	// 		expect(chef1MashroomBalanceAfter).to.bignumber.be.eq(new BN('0'));
	// 	});

	// 	it('should add the dish id uncooked dish ids list in Chef contract', async () => {
	// 		const uncookedDishIds = await this.Chef.uncookedDishIds(0);

	// 		expect(uncookedDishIds).to.bignumber.be.eq(currentDishId);
	// 	});

	// 	it('should revert when non-dishOwner tries to uncook the dish', async () => {
	// 		await expectRevert(
	// 			this.Chef.uncookDish(currentDishId, {from: user2}),
	// 			'Chef: ONLY_DISH_OWNER_CAN_UNCOOK'
	// 		);
	// 	});

	// 	it('should revert when dishOwner tries to uncook the dish with invalid dish id', async () => {
	// 		await expectRevert(this.Chef.uncookDish(0, {from: user1}), 'Chef: INVALID_DISH_ID');
	// 		await expectRevert(this.Chef.uncookDish(5, {from: user1}), 'Chef: INVALID_DISH_ID');
	// 	});

	// 	it('should revert when user wants to get svg of uncooked dish', async () => {
	// 		await expectRevert(
	// 			this.Dish.serveDish(currentDishId, {from: user1}),
	// 			'DishesNFT: CANNOT_SERVE_UNCOOKED_DISH'
	// 		);
	// 	});
	// });

	// describe('upgradeProxy()', () => {
	// 	let versionBeforeUpgrade;
	// 	before('upgradeProxy', async () => {
	// 		versionBeforeUpgrade = await this.Chef.getVersionNumber();

	// 		// upgrade contract
	// 		await upgradeProxy(this.Chef.address, ChefV2);
	// 	});

	// 	it('should upgrade contract correctly', async () => {
	// 		const versionAfterUpgrade = await this.Chef.getVersionNumber();

	// 		expect(versionBeforeUpgrade['0']).to.bignumber.be.eq(new BN('1'));
	// 		expect(versionBeforeUpgrade['1']).to.bignumber.be.eq(new BN('0'));
	// 		expect(versionBeforeUpgrade['2']).to.bignumber.be.eq(new BN('0'));

	// 		expect(versionAfterUpgrade['0']).to.bignumber.be.eq(new BN('2'));
	// 		expect(versionAfterUpgrade['1']).to.bignumber.be.eq(new BN('0'));
	// 		expect(versionAfterUpgrade['2']).to.bignumber.be.eq(new BN('0'));
	// 	});
	// });

	it.skip('should give random number', async () => {
		let randomNumber = await this.Chef.getRandomVariation(5); // 0-4
		console.log('randomNumber5: ', randomNumber.toString());

		randomNumber = await this.Chef.getRandomVariation(4); //0-3
		console.log('randomNumber4: ', randomNumber.toString());

		randomNumber = await this.Chef.getRandomVariation(3); // 0-2
		console.log('randomNumber3: ', randomNumber.toString());

		randomNumber = await this.Chef.getRandomVariation(2); // 0-1
		console.log('randomNumber2: ', randomNumber.toString());

		randomNumber = await this.Chef.getRandomVariation(1); // 0
		console.log('randomNumber1: ', randomNumber.toString());
	});

	describe('New Pizza Dish', () => {
		let currentDishId;
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
			// await this.Ingredient.addIngredient('Beef', url, '1500');
			// await this.Ingredient.addIngredient('Truffle', url, '500');

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

			// await this.Ingredient.addIngredientVariation(4, beef_1);
			// await this.Ingredient.addIngredientVariation(4, beef_2);
			// await this.Ingredient.addIngredientVariation(4, beef_3);

			// this.add3Tx = await this.Ingredient.addIngredientVariation(5, truffle_1);
			// await this.Ingredient.addIngredientVariation(5, truffle_2);
			// await this.Ingredient.addIngredientVariation(5, truffle_3);
		});

		it.only('should make pizza with all ingredients', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 2, 1, {from: minter});
			await this.Ingredient.mint(user1, 3, 1, {from: minter});
			// await this.Ingredient.mint(user1, 4, 1, {from: minter});
			// await this.Ingredient.mint(user1, 5, 1, {from: minter});

			// prepare the dish
			await this.Chef.prepareDish(1, [1, 2, 3], {from: user1});

			//get current dish id
			const preparedDishId = await this.Dish.getCurrentNftId();

			//get user1`s dish balance
			const dishBalance = await this.Dish.balanceOf(user1, preparedDishId);

			expect(dishBalance).to.bignumber.be.eq(new BN('1'));

			//get the svg of dish
			const dishSvg = await this.Dish.serveDish(1);

			// const addresssPath = await path.join(
			// 	'dishes',
			// 	'newPizza' + preparedDishId.toString() + '.svg'
			// );
			// dishId++;

			// await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
			// 	if (err) throw err;
			// });
		});

		it('should prepare pizza using cheese and caviar only', async () => {
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

		it('should prepare pizza using cheese and tuna only', async () => {
			// mint ingredients to the user1
			await this.Ingredient.mint(user1, 1, 1, {from: minter});
			await this.Ingredient.mint(user1, 3, 1, {from: minter});

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
		it('should prepare pizza using cheese and gold only', async () => {
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
			await this.Chef.prepareDish(1, [1, 2, 5], {from: user1});

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
			await this.Chef.prepareDish(1, [2, 3, 4, 5], {from: user1});

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
	});
});
