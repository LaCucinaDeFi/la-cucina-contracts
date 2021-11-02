require('chai').should();
const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const {time} = require('@openzeppelin/test-helpers');

const fs = require('fs');
const path = require('path');

// const backgrounds = require('../data/background');
const doughs = require('../data/dough');
const sauces = require('../data/sauce');
const cheeses = require('../data/cheese');
// const surprises = require('../data/surprise');

const papayas = require('../data/ingredients/papaya');
const caviar = require('../data/ingredients/caviar');
const leaves = require('../data/ingredients/leaves');
const venom = require('../data/ingredients/venom');
const antEggs = require('../data/ingredients/antEggs');

const DishesNFT = artifacts.require('DishesNFT');
const IngredientNFT = artifacts.require('IngredientsNFT');
const Kitchen = artifacts.require('Kitchen');

const url = 'https://token-cdn-domain/{id}.json';
const ipfsHash = 'bafybeihabfo2rluufjg22a5v33jojcamglrj4ucgcw7on6v33sc6blnxcm';

const NO_OF_DISHES = 25;
const GAS_LIMIT = 85000000;
const GAS_PRICE = 10; // 10 gwei
const gasToEth = (gascost) => {
    return (Number(gascost) * GAS_PRICE / 10**9);
}

contract('Simulation', (accounts) => {
	const owner = accounts[0];
	const minter = accounts[1];
	const user1 = accounts[2];
	const user2 = accounts[3];
	const user3 = accounts[4];
	const royaltyReceiver = accounts[8];
	const royaltyFee = '100'; // 10%

	let TotalGasCost = 0;
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

		// add owner as excepted address
		await this.Ingredient.addExceptedAddress(owner);
	});

	before('Add Dish Type and base ingredient for Pizza', async () => {
		// add dish in kitchen
		// [(205, 190), (250, 195), (270, 220), (170, 225), (210, 240), (160, 260), (120, 280)]
		const dishType = await this.Kitchen.addDishType(
			'Pizza', 
			[205, 250, 270, 170, 210, 160, 120], 
			[190, 195, 220, 225, 240, 260, 280], 
			{
			from: owner
		});
		currentDishId = await this.Kitchen.getCurrentDishTypeId();

		// add base Ingredients for dish
		const addBackground = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Background', {from: owner});
		const addDough = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Dough', {from: owner});
		const addSauce = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Sauce', {from: owner});
		const addCheese = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Cheese', {from: owner});
		const addSurprise = await this.Kitchen.addBaseIngredientForDishType(currentDishId, 'Surprise', {from: owner});

		const totalGas = Number(addBackground.receipt.cumulativeGasUsed) +
                        Number(addDough.receipt.cumulativeGasUsed) +
						Number(addSauce.receipt.cumulativeGasUsed) +
						Number(addCheese.receipt.cumulativeGasUsed) +
                        Number(addSurprise.receipt.cumulativeGasUsed);
        TotalGasCost += totalGas;

		console.log('addBackground', gasToEth(addBackground.receipt.cumulativeGasUsed));
        console.log('addDough', gasToEth(addDough.receipt.cumulativeGasUsed));
		console.log('addSauce', gasToEth(addSauce.receipt.cumulativeGasUsed));
		console.log('addCheese', gasToEth(addCheese.receipt.cumulativeGasUsed));
		console.log('addSurprise', gasToEth(addSurprise.receipt.cumulativeGasUsed));
        console.log('Total Gas for Adding Genes = ', gasToEth(totalGas), 'BNB');
	})

	// ************************** IMPORTANT ************************** //
	// add variations for base ingredients
	// here variation name should be strictly like this. variationName = IngredientName_variationName. ex. Slice_1, Cheese_2
	// NOTE: svg id and the IngredientName_variationName should be same. <g id= "Slice_One">, <g id = "Cheese_Two">
	// ************************** IMPORTANT ************************** //
	before('Add base variations for Pizza Background', async () => {
		let totalGas = 0;
		for (let bg of backgrounds) {
			const x = await this.Kitchen.addBaseIngredientVariation(1, bg.name, bg.svg, {
				from: owner,
				gas: GAS_LIMIT
			});
			totalGas += x.receipt.cumulativeGasUsed;
		
		}
		TotalGasCost += totalGas;
		console.log('Total Gas for Adding Backgrounds = ', gasToEth(totalGas), 'BNB');
	});

	before('Add base variations for Pizza Dough', async () => {
		let totalGas = 0;
		for (let dough of doughs) {
			const x = await this.Kitchen.addBaseIngredientVariation(2, dough.name, dough.svg, {
				from: owner,
				gas: GAS_LIMIT
			});
			totalGas += x.receipt.cumulativeGasUsed;
		
		}
		TotalGasCost += totalGas;
		console.log('Total Gas for Adding Dough = ', gasToEth(totalGas), 'BNB');
	});

	before('Add base variations for Pizza Sauce', async () => {
		let totalGas = 0;
		for (let sauce of sauces) {
			const x = await this.Kitchen.addBaseIngredientVariation(3, sauce.name, sauce.svg, {
				from: owner,
				gas: GAS_LIMIT
			});
			totalGas += x.receipt.cumulativeGasUsed;
		
		}
		TotalGasCost += totalGas;
		console.log('Total Gas for Adding Sauce = ', gasToEth(totalGas), 'BNB');
	});

	before('Add base variations for Pizza Cheese', async () => {
		let totalGas = 0;
		for (let cheese of cheeses) {
			const x = await this.Kitchen.addBaseIngredientVariation(4, cheese.name, cheese.svg, {
				from: owner,
				gas: GAS_LIMIT
			});
			totalGas += x.receipt.cumulativeGasUsed;
		
		}
		TotalGasCost += totalGas;
		console.log('Total Gas for Adding Cheese = ', gasToEth(totalGas), 'BNB');
	});

	before('Add base variations for Pizza Surprise', async () => {
		let totalGas = 0;
		for (let surprise of surprises) {
			const x = await this.Kitchen.addBaseIngredientVariation(5, surprise.name, surprise.svg, {
				from: owner,
				gas: GAS_LIMIT
			});
			totalGas += x.receipt.cumulativeGasUsed;
		
		}
		TotalGasCost += totalGas;
		console.log('Total Gas for Adding Surprise = ', gasToEth(totalGas), 'BNB');
	});

	before('add ingredients', async () => {
		// add ingredients
		nutritionHash = await this.Ingredient.getNutritionHash([14, 50, 20, 4, 6, 39, 25]);
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
				from: owner,
				gas: GAS_LIMIT
			}
		);

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
				from: owner,
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
				from: owner,
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
				from: owner,
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
				from: owner,
				gas: GAS_LIMIT
			}
		);
	})

	describe('serveDish()', () => {
		it('should serve the prepared dish correctly', async () => {
			// grant OVEN role to minter in Dish contract
			const OvenRole = await this.Dish.OVEN_ROLE();
			await this.Dish.grantRole(OvenRole, minter, {from: owner});
			let gasCostForGeneration = [];
			for (let i = 1; i <= NO_OF_DISHES; i++) {
				const start = new Date();
				// prepare the dish
				const x = await this.Dish.prepareDish(
					owner,
					1,
					1,
					time.duration.minutes('5'),
					[1, 2, 3, 4, 5],
					{from: minter}
				);
				gasCostForGeneration.push(gasToEth(x.receipt.cumulativeGasUsed));
				// get current dish id
				const currentDishId = await this.Dish.getCurrentTokenId();
				// get the svg of dish
				const dishSvg = await this.Dish.serveDish(currentDishId);
				const addresssPath = await path.join('generated/simulation', `pizzaDish_${i}.svg`);
				const end = new Date();
				const diffTime = Math.abs(start - end);
                console.log(`generatePicture ${i} for ${gasToEth(x.receipt.cumulativeGasUsed)} BNB in ${(diffTime / 1000)} seconds`);

				await fs.writeFile(addresssPath, dishSvg.toString(), (err) => {
					if (err) throw err;
				});
			}
			const sum = gasCostForGeneration.reduce((a, b) => a + b, 0);
            const avg = (sum / gasCostForGeneration.length) || 0;
            console.log("======== NFT GENERATION COSTS ========");
            console.log(`Total Gas Cost for generating ${NO_OF_DISHES} NFTs = ${sum} BNB`)
            console.log(`Average Gas Cost for each NFT = ${avg} BNB`)
		});
	});
});
