const { expect } = require('chai');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { deployProxy, admin } = require('@openzeppelin/truffle-upgrades');

require('chai').should();

const ERC1155NFT = artifacts.require('ERC1155NFT');
const url = 'https://token-cdn-domain/{id}.json';

contract('ERC1155NFT', accounts => {
  const owner = accounts[0];
  const minter = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];

  beforeEach(async () => {
    this.ERC1155NFT = await deployProxy(ERC1155NFT, [url], { initializer: 'initialize' });
  });

  it('should initialize the contract correctly', async () => {
    const uri = await this.ERC1155NFT.uri(1);
    expect(uri).to.be.eq(url);
  });

  it('should give the deployer the minter role', async () => {
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    const isMinter = await this.ERC1155NFT.hasRole(minterRole, owner);

    expect(isMinter).to.be.eq(true);
  });

  it('should assign the minter role correctly', async () => {
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();

    const isMinterBefore = await this.ERC1155NFT.hasRole(minterRole, minter);

    // grant minter role
    await this.ERC1155NFT.grantRole(minterRole, minter);

    const isMinterAfter = await this.ERC1155NFT.hasRole(minterRole, minter);

    expect(isMinterBefore).to.be.eq(false);
    expect(isMinterAfter).to.be.eq(true);
  });

  it('should NOT allow a non minter address to mint', async () => {
    await expectRevert(
      this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 10, { from: minter }),
      'ERC1155NFT: MUST_HAVE_MINTER_ROLE_TO_MINT',
    );
  });

  it('should allow a  minter address to mint', async () => {
    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, minter);

    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 1, { from: minter });

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();
    const user1Balance = await this.ERC1155NFT.balanceOf(user1, currentNftId);

    expect(currentNftId).to.bignumber.be.eq(new BN('1'));
    expect(user1Balance).to.bignumber.be.eq(new BN('1'));
  });

  it('should allow a minter to mint multiple NFT tokens for excepted address', async () => {
    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, minter);

    await expectRevert(
      this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 10, { from: minter }),
      'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN',
    );

    // add excepted address to receive multiple tokens
    await this.ERC1155NFT.addExceptedAddress(user1);

    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 10, { from: minter });

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();
    const user1Balance = await this.ERC1155NFT.balanceOf(user1, currentNftId);

    expect(currentNftId).to.bignumber.be.eq(new BN('1'));
    expect(user1Balance).to.bignumber.be.eq(new BN('10'));
  });

  it('should mint single NFT tokens', async () => {
    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, minter);

    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 1, { from: minter });
    await this.ERC1155NFT.mint(user2, 'https://token-cdn-domain/{2}.json', 1, { from: minter });

    await expectRevert(
      this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 10, { from: minter }),
      'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN',
    );

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();
    expect(currentNftId).to.bignumber.be.eq(new BN('2'));

    const user1Balance = await this.ERC1155NFT.balanceOf(user1, '1');
    expect(user1Balance).to.bignumber.be.eq(new BN('1'));

    const user2Balance = await this.ERC1155NFT.balanceOf(user2, '2');
    expect(user2Balance).to.bignumber.be.eq(new BN('1'));
  });

  it('should burn tokens correctly', async () => {
    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, minter);

    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(user1);
    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 10, { from: minter });

    const currentNftId = await this.ERC1155NFT.getCurrentNftId();

    const user1BalanceBefore = await this.ERC1155NFT.balanceOf(user1, currentNftId);

    // a non minter cannot burn
    await expectRevert(
      this.ERC1155NFT.burn(user1, currentNftId, user1BalanceBefore, { from: user2 }),
      'ERC1155NFT: MUST_HAVE_MINTER_ROLE_TO_BURN',
    );

    // burn tokens
    await this.ERC1155NFT.burn(user1, currentNftId, user1BalanceBefore);

    const user1BalanceAfter = await this.ERC1155NFT.balanceOf(user1, currentNftId);

    expect(user1BalanceBefore).to.bignumber.be.eq(new BN('10'));
    expect(user1BalanceAfter).to.bignumber.be.eq(new BN('0'));
  });

  it('should transfer tokens correctly', async () => {
    // add excepted address to receive multiple tokens
    await this.ERC1155NFT.addExceptedAddress(minter);

    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, minter);

    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 1, { from: minter });
    await this.ERC1155NFT.mint(user2, 'https://token-cdn-domain/{2}.json', 1, { from: minter });
    await this.ERC1155NFT.mint(minter, 'https://token-cdn-domain/{3}.json', 10, { from: minter });

    // transfer nft
    await this.ERC1155NFT.safeTransferFrom(user1, user3, 1, 1, '0x837', { from: user1 });

    await this.ERC1155NFT.safeTransferFrom(minter, user3, 3, 1, '0x837', { from: minter });

    await expectRevert(
      this.ERC1155NFT.safeTransferFrom(minter, user3, 3, 1, '0x837', { from: minter }),
      'ERC1155NFT: TOKEN_ALREADY_EXIST',
    );

    await expectRevert(
      this.ERC1155NFT.mint(user3, 'https://token-cdn-domain/{1}.json', 2, { from: minter }),
      'ERC1155NFT: USER_CAN_TRANSFER_ONLY_ONE_TOKEN',
    );

    const user1Balance = await this.ERC1155NFT.balanceOf(user1, '1');
    expect(user1Balance).to.bignumber.be.eq(new BN('0'));

    const user2Balance = await this.ERC1155NFT.balanceOf(user2, '2');
    expect(user2Balance).to.bignumber.be.eq(new BN('1'));

    const user3Balance = await this.ERC1155NFT.balanceOf(user3, '3');
    expect(user3Balance).to.bignumber.be.eq(new BN('1'));

    const minterBalance = await this.ERC1155NFT.balanceOf(minter, '3');
    expect(minterBalance).to.bignumber.be.eq(new BN('9'));
  });

  it('should not allow transfers in case of paused contract', async () => {
    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    const pauserRole = await this.ERC1155NFT.PAUSER_ROLE();

    await this.ERC1155NFT.grantRole(minterRole, minter);

    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 1, { from: minter });

    await expectRevert(this.ERC1155NFT.pause({ from: minter }), 'ERC1155NFT: must have pauser role to pause');

    // make minter a pauser as well
    await this.ERC1155NFT.grantRole(pauserRole, minter);

    // should pause correctly
    await this.ERC1155NFT.pause({ from: minter });

    await expectRevert(
      this.ERC1155NFT.safeTransferFrom(user1, user3, 1, 1, '0x837', { from: user1 }),
      'ERC1155Pausable: token transfer while paused',
    );
    // also burning is not allowed in this case
    await expectRevert(this.ERC1155NFT.burn(user1, 1, 1), 'ERC1155Pausable: token transfer while paused');

    // should unpause correctly
    await expectRevert(this.ERC1155NFT.unpause({ from: user1 }), 'ERC1155NFT: must have pauser role to unpause');
    await this.ERC1155NFT.unpause({ from: minter });

    await this.ERC1155NFT.safeTransferFrom(user1, user3, 1, 1, '0x837', { from: user1 });

    const user1Balance = await this.ERC1155NFT.balanceOf(user3, '1');
    expect(user1Balance).to.bignumber.be.eq(new BN('1'));
  });

  it('should not allow mints in case of paused contract', async () => {
    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    const pauserRole = await this.ERC1155NFT.PAUSER_ROLE();

    await this.ERC1155NFT.grantRole(minterRole, minter);
    // make minter a pauser as well
    await this.ERC1155NFT.grantRole(pauserRole, minter);
    await this.ERC1155NFT.pause({ from: minter });

    await expectRevert(
      this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 1, { from: minter }),
      'ERC1155Pausable: token transfer while paused',
    );
  });

  it('should not allow a non pauser to pause', async () => {
    await expectRevert(this.ERC1155NFT.pause({ from: minter }), 'ERC1155NFT: must have pauser role to pause');
  });

  it('should approve tokens correctly', async () => {
    // add excepted address to receive multiple tokens
    await this.ERC1155NFT.addExceptedAddress(minter);

    // grant minter role to user
    const minterRole = await this.ERC1155NFT.MINTER_ROLE();
    await this.ERC1155NFT.grantRole(minterRole, minter);

    await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 1, { from: minter });
    await this.ERC1155NFT.mint(minter, 'https://token-cdn-domain/{3}.json', 10, { from: minter });

    const isApprovalForAllBefore = await this.ERC1155NFT.isApprovedForAll(minter, user3);

    // approve nft
    await this.ERC1155NFT.setApprovalForAll(user3, true, { from: minter });

    const isApprovalForAllAfter = await this.ERC1155NFT.isApprovedForAll(minter, user3);

    expect(isApprovalForAllBefore).to.be.eq(false);
    expect(isApprovalForAllAfter).to.be.eq(true);

    // get type2 nft from minter
    await this.ERC1155NFT.safeTransferFrom(minter, user3, 2, 1, '0x837', { from: user3 });

    await expectRevert(
      this.ERC1155NFT.safeTransferFrom(minter, user3, 1, 1, '0x837', { from: user3 }),
      'ERC1155: insufficient balance for transfer',
    );

    // transfer type1 nft to minter
    await this.ERC1155NFT.safeTransferFrom(user1, minter, 1, 1, '0x837', { from: user1 });

    // get type1 nft from minter
    await this.ERC1155NFT.safeTransferFrom(minter, user3, 1, 1, '0x837', { from: user3 });

    await expectRevert(
      this.ERC1155NFT.safeTransferFrom(minter, user3, 2, 1, '0x837', { from: user3 }),
      'ERC1155NFT: TOKEN_ALREADY_EXIST',
    );

    const user1Balance = await this.ERC1155NFT.balanceOf(user1, '1');
    expect(user1Balance).to.bignumber.be.eq(new BN('0'));

    const minterBalance = await this.ERC1155NFT.balanceOf(minter, '2');
    expect(minterBalance).to.bignumber.be.eq(new BN('9'));
  });

  it('Should add excepted address correctly', async () => {
    const isExceptedAddressBefore = await this.ERC1155NFT.isExceptedAddress(user1);

    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(user1);

    const isExceptedAddressAfter = await this.ERC1155NFT.isExceptedAddress(user1);
    expect(isExceptedAddressBefore).to.be.eq(false);
    expect(isExceptedAddressAfter).to.be.eq(true);
    await expectRevert(this.ERC1155NFT.addExceptedAddress(user1), 'ERC1155: ALREADY_EXCEPTED_ADDRESS');
  });

  it('should remove excepted address correctly', async () => {
    // add excepted address
    await this.ERC1155NFT.addExceptedAddress(user1);
    await this.ERC1155NFT.addExceptedAddress(user2);

    const isExceptedAddressUser1Before = await this.ERC1155NFT.isExceptedAddress(user1);
    const isExceptedAddressUser2Before = await this.ERC1155NFT.isExceptedAddress(user2);

    expect(isExceptedAddressUser1Before).to.be.eq(true);
    expect(isExceptedAddressUser2Before).to.be.eq(true);

    await this.ERC1155NFT.removeExceptedAddress(user1);
    await this.ERC1155NFT.removeExceptedAddress(user2);

    const isExceptedAddressUser1After = await this.ERC1155NFT.isExceptedAddress(user1);
    const isExceptedAddressUser2After = await this.ERC1155NFT.isExceptedAddress(user2);

    expect(isExceptedAddressUser1After).to.be.eq(false);
    expect(isExceptedAddressUser2After).to.be.eq(false);

    await expectRevert(this.ERC1155NFT.removeExceptedAddress(user3), 'ERC1155NFT: CANNOT_FIND_USER');
  });

  describe('Getters', () => {
    beforeEach(async () => {
      // grant minter role to user
      const minterRole = await this.ERC1155NFT.MINTER_ROLE();
      await this.ERC1155NFT.grantRole(minterRole, minter);

      // add excepted address
      await this.ERC1155NFT.addExceptedAddress(user1);
      // mint NFT
      await this.ERC1155NFT.mint(user1, 'https://token-cdn-domain/{1}.json', 10, { from: minter });
    });

    it('should get current nft id correctly', async () => {
      const currentNftId = await this.ERC1155NFT.getCurrentNftId();

      expect(currentNftId).to.bignumber.be.eq(new BN('1'));
    });

    it('should get nft url correctly', async () => {
      const tokenURI = await this.ERC1155NFT.getIpfsHash('1');

      expect(tokenURI).to.be.eq('https://token-cdn-domain/{1}.json');
    });
  });
});
