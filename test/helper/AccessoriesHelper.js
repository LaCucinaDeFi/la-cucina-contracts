require('chai').should();
const {deployProxy} = require('@openzeppelin/truffle-upgrades');

const {cowboy} = require('../../data/talien/clothes');
const {cowboyHat} = require('../../data/talien/headAccessory');
const {knife, sword} = require('../../data/talien/holdingAccessory');
const Accessories = artifacts.require('Accessories');

const url = 'https://token-cdn-domain/{id}.json';

class AccessoriesContract {
	constructor(operator, owner) {
		this.operator = operator;
		this.owner = owner;
	}

	setup = async (royaltyReceiver) => {
		// deploy accessories contract
		this.Accessories = await deployProxy(Accessories, [url, royaltyReceiver, '100'], {
			initializer: 'initialize'
		});

		// grant operator role
		const OPERATOR_ROLE = await this.Accessories.OPERATOR_ROLE();
		await this.Accessories.grantRole(OPERATOR_ROLE, this.operator, {from: this.owner});

		// grant minter role to minter account
		const MINTER_ROLE = await this.Accessories.MINTER_ROLE();
		await this.Accessories.grantRole(MINTER_ROLE, this.operator, {from: this.owner});

		// add  item
		await this.Accessories.addItem('Talion', {from: this.operator});

		// add accessory types
		await this.addAccessoryTypes();

		// add accessories
		await this.addAccessories();

		return this.Accessories;
	};

	addAccessoryTypes = async () => {
		this.currentLaCucinaNftsItemId = await this.Accessories.getCurrentItemId();

		await this.Accessories.addAccessoryType(this.currentLaCucinaNftsItemId, 'Head Accessories', {
			from: this.operator
		});

		await this.Accessories.addAccessoryType(this.currentLaCucinaNftsItemId, 'Holding Accessories', {
			from: this.operator
		});

		await this.Accessories.addAccessoryType(this.currentLaCucinaNftsItemId, 'Clothes Accessories', {
			from: this.operator
		});
	};

	addAccessories = async () => {
		// add HEAD accessory
		await this.Accessories.addAccessory(
			this.currentLaCucinaNftsItemId,
			1, // HEAD TYPE
			1, // series
			'CowboyHat',
			cowboyHat,
			this.operator,
			1,
			100, // 100%
			{
				from: this.operator
			}
		);

		// add Holding accessory
		await this.Accessories.addAccessory(
			this.currentLaCucinaNftsItemId,
			2, // Holding TYPE
			1, // series
			'Knife',
			knife,
			this.operator,
			1,
			80, // 80%
			{
				from: this.operator
			}
		);

		await this.Accessories.addAccessory(
			this.currentLaCucinaNftsItemId,
			2, // Holding TYPE
			1, // series
			'Sword',
			sword,
			this.operator,
			1,
			20, // 20%
			{
				from: this.operator
			}
		);

		// add Clothes accessory
		await this.Accessories.addAccessory(
			this.currentLaCucinaNftsItemId,
			3, // Holding TYPE
			1, // series
			'Cowboy',
			cowboy,
			this.operator,
			1,
			80, // 80%
			{
				from: this.operator
			}
		);
	};
}

module.exports = {AccessoriesContract};
