const {deployProxy} = require('@openzeppelin/truffle-upgrades');

const url = 'https://token-cdn-domain/{id}.json';

const TalienContract = artifacts.require('Galaxy');

const {AccessoriesContract} = require('./AccessoriesHelper');
const {TraitFactoryContract} = require('./TraitFactoryHelper');
class Talien {
	constructor(operator, owner) {
		this.operator = operator;
		this.owner = owner;
	}

	setup = async (fundReceiver, royaltyReceiver, feeToken) => {
		this.AccessoriesContract = new AccessoriesContract(this.operator, this.owner);
		this.Accessories = await this.AccessoriesContract.setup(royaltyReceiver);

		this.TraitFactoryContract = new TraitFactoryContract(this.operator, this.owner);
		this.TraitFactory = await this.TraitFactoryContract.setup();

		// deploy NFT token
		this.Talien = await deployProxy(
			TalienContract,
			[
				'La Cucina Taliens',
				'TALIEN',
				url,
				fundReceiver,
				feeToken,
				this.Accessories.address,
				this.TraitFactory.address,
				royaltyReceiver,
				'100'
			],
			{
				initializer: 'initialize'
			}
		);

		const currentGalaxyItemId = await this.TraitFactory.getCurrentGalaxyItemId();
		const currentSeriesId = await this.TraitFactory.currentSeries(currentGalaxyItemId);

		// grant updator role to talion contract
		const UPDATOR_ROLE = await this.TraitFactory.UPDATOR_ROLE();
		await this.TraitFactory.grantRole(UPDATOR_ROLE, this.Talien.address, {from: this.owner});

		// grant minter role to talion contract
		const MINTER_ROLE = await this.Accessories.MINTER_ROLE();
		await this.Accessories.grantRole(MINTER_ROLE, this.Talien.address, {from: this.owner});

		// grant updator role to talion contract
		const OPERATOR_ROLE = await this.Talien.OPERATOR_ROLE();
		await this.Talien.grantRole(OPERATOR_ROLE, this.operator, {from: this.owner});

		// add Talion as excepted address
		await this.Accessories.addExceptedAddress(this.Talien.address, {from: this.operator});

		// add Talion as excepted address
		await this.Accessories.addExceptedFromAddress(this.Talien.address, {from: this.operator});

	
		return this.Talien;
	};

	generateTalien = async (galaxyItemId, seriesId, withAccessories, user) => {
		// traitrate profile picture
		await this.Talien.generateGalaxyItem(galaxyItemId, seriesId, withAccessories, {from: user});
	};
}

module.exports = {Talien};
