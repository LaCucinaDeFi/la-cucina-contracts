# La Cucina Contracts 

[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)
![Coverage](https://raw.githubusercontent.com/la-cucina/la-cucina-contracts/master/coverage_badge.svg)

## NFT Marketplace

This repository contains the smart contracts related with the NFT marketplace.

This is an NFT marketplace where the minter is the only one that can create NFTs and put them up for their initial sale (**New NFTs Market**).
The sale can happen either for a fixed price for an NFT or through an auction.
The initial sale can happen in the `PrivateMarketplace` contract - The "Private" notion comes from the fact that only the minter is able to put
NFTs for sale / auction in this market.
The NFTs created from the minter can be purchased by anyone through the methods described above (fixed price or auction).

> _Note: The auction in the New NFTs Market is only available for unique NFTs._

Once an NFT is purchased from the _New NFTs market_, the new owner is able to put their NFT for sale into the **Public Market**.
The sale in the Public Market can happen either for a fixed price or through an auction - same as for the _New NFTs Market_.

The price of the NFTs can be any supported ERC-20 token. A list of supported tokens will be maintained on the contract and the admin will be able to modify that list.

One restriction on this NFT marketplace is that one address can hold **only one** NFT from a specific NFT type.

## Architecture

We have 2 main contracts:

- [Marketplace](#1-marketplace)
- [NFT Contract](#2-nft-contract)

>NOTE: Private and Public Marketplace contracts are extending the base Marketplace contract

### 1. Marketplace

- Required setup:
- Market contract contains **all** the logic for NFT marketplace.
- It allows users to buy/sell NFTs, create/cancel auction, place/remove bid and also mint new NFTs.
- It has the minter role for the nft contract. This minter role is set on the nft contract.
- It will be the owner of NFT contract. As a owner, the market contrac can mint the nft tokens.
- This contract is upgradable.

- **Methods:**

  #### Minting and Initial Sale of NFTs - Private Marketplace

  - **createAndSellNFT()**:

    - This method allows a user with minter role to mint the new tokens.
    - Internally it calls the `mint()` method of the ERC1155 contract and the `_sellNFT()` from the NFTMarket contract.

    - Parameters required:

      - Nft price
      - Token Address(ex. WETH / WNBN)
      - Ipfs hash url as a token uri
      - No. of copies

    - All the metadata of an NFT will be a JSON file stored on IPFS and a hash of that will be stored on the NFT itself

  - **createAndAuctionNFT()**:

    - This method allows a user with minter role to mint the new **unique nft** and sell it through the marketplace .
    - Internally it calls the `mint()` method of the ERC1155 contract and the `_createAuction()` from the NFTMarket contract.

    - Parameters required:

      - Nft price
      - Token Address(ex. WETH / WNBN)
      - Ipfs hash url as a token uri
      - Start block
      - Duration

    - All the metadata of an NFT will be a JSON file stored on IPFS and a hash of that will be stored on the NFT itself

  #### Fixed Price Sale - Public Marketplace

  - **sellNFT()**:

    - This method allows nft holder to sell his nft for a fixed price.
    - This method allows owner to set the selling price for nft whatever he wants and the currency i.e token address in which owner wants get paid in.
    - Required parameters:
      - nftID
      - nftPrice
      - currency i.e token address.

  - **buyNFT()**:

    - This method allows users to buy the nft for the fixed price set by the nft owner from the market.
    - it performs the following operations:
      - Check the owner allowance of nft
      - gets the royalty info which returns the royalty receiver and the royalty amount for the trading price.
      - TransferFrom the sale price - royalty amount of tokens to the nft seller
      - TransferFrom the royalty amount of tokens to the royaltyReceiver
      - TransferFrom the nft to the buyer.
    - Required parameters:
      - saleId

  - **cancelSaleAndClaimToken()**

    - Allows nft seller to cancel the sale of the nft and transfer the nft back to the owner/seller.
    - required parameters:
      - saleId

  #### Sale through an Auction

  - **setAuctionForNFT()**:

    - This method allows users to sell the nft in auction.
    - Before calling this function, the owner must approve the NFTs to the market contrac, either All using the setApprovalForAll()or specific one using setApproval() method of the ERC1155.

    - Generate new AuctionId using the oz generator.
    - Store Auction details
    - Store AuctionID for the owner/seller.
    - Add the AuctionId in active auctions.
    - TransferFrom the nft to the market contract.
    - Required parameters:
      - tokenId
      - Starting price
      - Token address
      - startBlock
      - Duration

  - **placeBid()**

    - This method allows users to place a bid for the Auction.
    - Generate new BidId using the oz generator
    - Store the bid details.
    - Add the bidId in the list of bidIds of Auction and update the WinningBidId
    - Required parameters:
      - AuctionId
      - BidAmount

    - Checks:
      - bidAmount must be greater than the winningAmount
      - bidAmount must be greater than starting price in case of first bid

  - **resolveAuction()**

    - This method identify the winner of the Auction and stores the details of the winner for the auction.
    - Anyone can call the ResolveAuction() method
    - Checks that the startBlock + duration is in the past
    - Check that the buyer has the required amount of selling tokens,
      - if yes then we will transferFrom selling tokens from the buyer and transfer the NFT to the buyer
      - if not, we need to find the next highest bid that has the required amount of selling tokens and then transferFrom tokens from the buyer and transfer the NFT to the buyer - in this case, we need to also update the WinningBidId as well.
    - gets the royalty info which returns the royalty receiver and the royalty amount for the trading price.
    - TransferFrom the sale price - royalty amount of tokens to the nft seller
    - TransferFrom the royalty amount of tokens to the royaltyReceiver
  
    - Required parameters:
      - AuctionId

  - **cancelAuctionAndClaimToken()**

    - Allows nft seller to cancel the Auction and claim back the nft.
    - This will update the status of auction to canceled.
    - This will transfer the nft back to the seller.
    - Required parameters:

      - Auction id

    - **Note:** seller can cancel auction **only** if the auction has no bids.

  - **removeBid()**
    - Allows bidder to remove his bid.
    - This method will remove the bidId from the list of bid ids of the auction.
    - Require paramters:
      - bidId

  #### Supported Tokens

  - **addSupportedToken()**

    - Allows admin to add the supported token for buying the NFT.
    - required parameters:
      - token address

  - **removeSupportedToken()**

    - Allow admin to remove the supported token.
    - required parameters:
      - token address.

  #### WEB3 Getters

  - **getAuctionWinningBid()**

    - Returns the winning bid of the Auction
    - RequiredParameters:
      - AuctionId

  - **getActiveAuctions()**

    - Returns all active auction ids

  - **getInactiveAuctions()**

    - Return all inactive auction ids.

  - **getActiveSales()**
    - Return all the active sale ids for all nftIds;

  - **getActiveSalesForNFT()**
    - Return all the active sale ids for given nftIds;
    
  - **isActiveAuction()**
    - Check if given Auction is active or not. Returns true if yes otherwise false.
    - required parameters:
      - AuctionID

# Recipe Contracts
Their are four main contracts in recipe which are listed below-
* IngredientsNFT Contract
* Pantry Contract
* DishesNFT Contract
* Oven Contract 

## IngredientsNFT Contract

 * IngredientsNFT contract extends the BaseERC1155 contract and the BaseERC1155WithRoyalties contracts. 
 * The BaseERC1155 contract is basic ERC1155 NFT token contract which allows us to mint the new nfts.
 * The BaseERC1155WithRoyalties contract supports the ERC2981 standard to get the royalties on nfts. The marketplace contracts which supports the royaltyPayments can call the royaltyInfo() method of this contract to get the royalty amount and the royalty receiver`s address.
 * This contract allows admins to manage different ingredients and their variations. It stores the svgs for the cooked version of the ingredients and the metadata for the ingredients.
 * It allows users` to get the multiplier for the Ingredients which are caluclated using the nutirtions hash.
 * This contract also ensures that each user will have only one NFT except the excepted addressses which are allowed to hold multiple nfts. these excepted addresses are mostly the contracts` addresses.
 * This contract allows Market contract to create new nfts.
  
## Pantry Contract

* Pantry contract allows admin to store and manage all the data related with the dishes. It stores the baseIngredients information and the svgs for the different variations of the base ingredients.
* The Pantry contract is mainly used in the Dishes NFT contract for preparing and serving the dish.
* All supported dishes are added in the pantry contract. 

## DishesNFT Contract

* DishesNFT contract is ERC721 NFT token contract which contains the logic for preparing and serving a dish.
* This contract mints the Dish NFT to the user when user prepares the dish using disfferent ingredeints.
* This contract stores all the data related with the dish.
* It also ensures that the dishes are non-transferable. only the excepted addresses can transfer the dishNFT.
* This contract is mainly used by the Oven contract for preparing and uncooking the dish. 

## Oven Contract

* Oven Contract allows users to prepare and uncook the dish using the differnt Ingredients.
* This contract uses the Dishes NFT contract for preparing a dish and minting the dishNFT to the user.
* Users must have at least two ingredient NFTs to prepare the dish. 
* When user wants to prepare the dish, The Oven contracts gets the ingredient NFT from the user and mints the unique dishNFT to the user. User needs to select the flame type to prepare a dish. 
* The flame allows user to speed up or slow down the dish preparation time. If user wants to minimize the preparation time, user needs to pay the fees in LAC token depending on the flame type.If user wants to increase the preparation time, the oven contract returns the extra LAC tokens that he paid for higher flame and only charge the fees for selected flame type.
* User can also uncook the dish and get the ingredient NFTS. User needs to return the dishNft to the oven contract in this case. user can uncook the dish only after the dish preparation time. 

# Contract Deployment

## Deploy and setup IngredientsNFT Contract
* First admin deploy the IngredientsNFT contract. We initialize the contract with the following parameters-

  * _baseTokenURI: Indicates the uri for the ERC1155 nft tokens.
  * _royaltyReceiver: Indicates the address of the royalty receiver who will receive the royalty payment.
  * _royaltyFee: Indicates the royalty fee percentage which is charged on the trading of NFT in marketplace. maximum royalty fee is 25% i.e 250;
* Admin needs to add the ingredient using the **addIngredient()** method which requires the ingredient name and nutrisions hash parameters.
* Then, admin adds the different variations for the ingredient using the **addIngredientVariation()** method which requires the ingredientId, variation name and the svg for the variation.


## Deploy Pantry contract 
* After deploying the IngredientsNFT contract, admin deploy the Pantry contract.
* Then admin adds the dish in the pantry using the **addDish()** method which requires the name of the dish as a parameter.
* After adding a dish, admin need to add the baseIngredient for the dish using the **addBaseIngredientForDish()** method which requires the dishID and the name of the baseIngredient as a parameter.
* Then admin adds the different variations of the baseIngredient using the **addBaseIngredientVariation()** method which requires the baseIngredientId, variation name and the svg for the variation.

## Deploy DishesNFT contract
* Admin deploys the DishesNFT contract and initializes it with the following parameters-
  * _name: Indicates the name of the ERC721 token contract.
  * _symbol: Indicates the symbol of the dish contract.
  * _baseTokenUri: Indicates the uri for the ERC721 tokens.
  * _ingredientNFTAddress: Indicates the address of the ingredient contract.
  * _pantryAddress: Indicates the address of the pantry contract.

## Deploy Oven contract
* After deploying the above contracts, admin need to deploy the oven contract with following parameters-
  * _ingredientAddress: Indicates the address of the ingredient contract.
  * _dishNFTAddress: Indicates the dishNFT contracts address.
  * _lacTokenAddress: Indicates the lacToken address.
* Add the Oven contract`s address as excepted contract address in IngredientsNFT contract using the **addExceptedAddress()** method which requires the oven contract address as a parameter.
* Add the Oven contract`s address as excepted contract address in DishesNFT contract using the **addExceptedAddress()** method which requires the oven contract address as a parameter.
* Grant the OVEN_ROLE to the oven contract in DishesNFT contract using the **grantRole()** method.
* Add the different types of flames usingthe **addFlame()** method which requires flame type name, preparation duration in seconds and the lac charge for selecting the flame.

# Development

## clone repo

```bash
git clone <repo_url>
```

## install dependencies

```bash
yarn i
```

or

```bash
yarn install
```

Add secrets.json and secrets.test.json file and copy the content from secrets.example file to these files

## compile the contracts

```bash
yarn run compile
```

or

```bash
yarn compile
```

## start the ganache instance

- For starting ganache for the testnet run the following command

  ```bash
  yarn run ganache_test
  ```

- For starting ganache for the mainnet run the following command
  ```bash
  yarn run ganache_main
  ```

## Migrate the contracts

- For deploying contracts on the test net run the following command

  ```bash
  yarn run migrate_bsc_test
  ```

- For deploying contracts on the main net run the following command

  ```bash
  yarn run migrate_bsc_main
  ```

## Run the tests

```bash
yarn run test
```

## Verify Contracts

To verify contracts on test network following command can be used-

```bash
yarn run verify_test CONTRACT_NAME@CONTRACT_ADDDRESS
```

To verify contracts on main network following command can be used-

```bash
yarn run verify_main CONTRACT_NAME@CONTRACT_ADDDRESS
```
