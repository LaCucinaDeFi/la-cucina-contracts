require('chai').should();
const {deployProxy} = require('@openzeppelin/truffle-upgrades');

const {bg01, bg02, bg03} = require('../../data/talien/background');
const {greenBody} = require('../../data/talien/bodies');
const {cowboy} = require('../../data/talien/clothes');
const {angryEyes, regularEyes} = require('../../data/talien/eyes');
const {cowboyHat} = require('../../data/talien/headAccessory');
const {blueHead} = require('../../data/talien/heads');
const {knife, sword} = require('../../data/talien/holdingAccessory');
const {bigMouthBlue, biteLipMouthBlue, piercedMouthBlue} = require('../../data/talien/mouth');
const {silver_badge, golden_badge, platinum_badge} = require('../../data/talien/badge');

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

		// add galaxy item
		await this.Accessories.addGalaxyItem('Talion', {from: this.operator});

		// add accessory types
		await this.addAccessoryTypes();

		// add accessories
		await this.addAccessories();

		return this.Accessories;
	};

	addAccessoryTypes = async () => {
		this.currentGalaxyItemId = await this.Accessories.getCurrentGalaxyItemId();

		await this.Accessories.addAccessoryType(this.currentGalaxyItemId, 'Head Accessories', {
			from: this.operator
		});

		await this.Accessories.addAccessoryType(this.currentGalaxyItemId, 'Holding Accessories', {
			from: this.operator
		});

		await this.Accessories.addAccessoryType(this.currentGalaxyItemId, 'Clothes Accessories', {
			from: this.operator
		});
	};

	addAccessories = async () => {
		// add HEAD accessory
		await this.Accessories.addAccessory(
			this.currentGalaxyItemId,
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
			this.currentGalaxyItemId,
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
			this.currentGalaxyItemId,
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
			this.currentGalaxyItemId,
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
