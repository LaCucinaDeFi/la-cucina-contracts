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
const url = 'https://token-cdn-domain/{id}.json';

class Talien {
	constructor(talienContract) {
		this.Talien = talienContract;
	}

	setup = async (owner) => {
		// add the Traits
		await this.Talien.addTrait('Background', {from: owner});
		await this.Talien.addTrait('Bodies', {from: owner});
		await this.Talien.addTrait('Head', {from: owner});
		await this.Talien.addTrait('Mouth', {from: owner});
		await this.Talien.addTrait('Eyes', {from: owner});
		await this.Talien.addTrait('HeadAccessory', {from: owner});
		await this.Talien.addTrait('HoldingAccessory', {from: owner});
		await this.Talien.addTrait('Clothes', {from: owner});

		await this.addTraitVariations(owner);
		// activate profile generation
		await this.Talien.activateProfileGeneration({from: owner});
	};

	addTraitVariations = async (owner) => {
		// add trait variations
		await this.Talien.updateGeneration(10, 'Genesis');
		const currentGeneration = await this.Talien.getCurrentGeneration();

		await this.Talien.addTraitVariation(1, currentGeneration, 'BG_04', bg01, '80', {
			from: owner
		});
		await this.Talien.addTraitVariation(1, currentGeneration, 'BG_09', bg02, '20', {
			from: owner
		});

		await this.Talien.addTraitVariation(2, currentGeneration, 'Green Body', greenBody, '100', {
			from: owner
		});

		await this.Talien.addTraitVariation(3, currentGeneration, 'Blue Head', blueHead, '100', {
			from: owner
		});

		await this.Talien.addTraitVariation(
			4,
			currentGeneration,
			'Big Blue Mouth',
			bigMouthBlue,
			'40',
			{
				from: owner
			}
		);
		await this.Talien.addTraitVariation(
			4,
			currentGeneration,
			'Pierved Blue Mouth',
			piercedMouthBlue,
			'35',
			{from: owner}
		);
		await this.Talien.addTraitVariation(
			4,
			currentGeneration,
			'Bite Lip Blue Mouth',
			biteLipMouthBlue,
			'25',
			{from: owner}
		);

		await this.Talien.addTraitVariation(5, currentGeneration, 'Angry Eyes', angryEyes, '60', {
			from: owner
		});
		await this.Talien.addTraitVariation(5, currentGeneration, 'Regular Eyes', regularEyes, '40', {
			from: owner
		});

		await this.Talien.addTraitVariation(6, currentGeneration, 'Cowboy Hat', cowboyHat, '100', {
			from: owner
		});

		await this.Talien.addTraitVariation(7, currentGeneration, 'Knife', knife, '50', {
			from: owner
		});
		await this.Talien.addTraitVariation(7, currentGeneration, 'Sword', sword, '50', {
			from: owner
		});

		await this.Talien.addTraitVariation(8, currentGeneration, 'Cowboy Top', cowboy, '100', {
			from: owner
		});
	};
	generateTalien = async (user) => {
		// traitrate profile picture
		await this.Talien.generateTalien({from: user});
	};
}

module.exports = {Talien};
