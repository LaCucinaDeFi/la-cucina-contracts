const { expect } = require('chai')
const { expectRevert, BN } = require('@openzeppelin/test-helpers')
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades')
const { PizzaBase, pepper, tomato, mashroom } = require('./ingredientsData')

const fs = require('fs')
const path = require('path')

require('chai').should()

const Chef = artifacts.require('Chef')

contract('Chef', (accounts) => {
  const owner = accounts[0]
  const minter = accounts[1]
  const user1 = accounts[2]
  const user2 = accounts[3]
  const user3 = accounts[4]
  let dishId = 1

  before(async () => {
    this.Chef = await deployProxy(Chef, [], {
      initializer: 'initialize',
    })

    // add pizza base ingredients
    await this.Chef.addBaseIngredient('PizzaBase', PizzaBase)

    // add ingredients
    await this.Chef.addIngredient('pepper', '100', pepper)
    await this.Chef.addIngredient('tomato', '200', tomato)
    await this.Chef.addIngredient('mashroom', '300', mashroom)
  })

  it('should prepare dish with pepper, tomato and mashroom correctly', async () => {
    // prepare dish
    await this.Chef.prepareDish(1, [1, 2, 3])

    const currentDishId = await this.Chef.getCurrentDishId()

    // get dish
    const dish = await this.Chef.serveDish(currentDishId)

    const addresssPath = await path.join(
      'dishes',
      'pizza' + dishId.toString() + '.svg',
    )
    dishId++

    await fs.writeFile(addresssPath, dish.toString(), (err) => {
      if (err) throw err
    })
  })

  it('should prepare dish with pepper and tomato correctly', async () => {
    // prepare dish
    await this.Chef.prepareDish(1, [1, 2])

    const currentDishId = await this.Chef.getCurrentDishId()

    // get dish
    const dish = await this.Chef.serveDish(currentDishId)

    const addresssPath = await path.join(
      'dishes',
      'pizza' + dishId.toString() + '.svg',
    )
    dishId++

    await fs.writeFile(addresssPath, dish.toString(), (err) => {
      if (err) throw err
    })
  })

  it('should prepare dish with tomato and mashroom correctly', async () => {
    // prepare dish
    await this.Chef.prepareDish(1, [2, 3])

    const currentDishId = await this.Chef.getCurrentDishId()

    // get dish
    const dish = await this.Chef.serveDish(currentDishId)

    const addresssPath = await path.join(
      'dishes',
      'pizza' + dishId.toString() + '.svg',
    )
    dishId++

    await fs.writeFile(addresssPath, dish.toString(), (err) => {
      if (err) throw err
    })
  })

  it('should prepare dish with pepper and mashroom correctly', async () => {
    // prepare dish
    await this.Chef.prepareDish(1, [1, 3])

    const currentDishId = await this.Chef.getCurrentDishId()

    // get dish
    const dish = await this.Chef.serveDish(currentDishId)

    const addresssPath = await path.join(
      'dishes',
      'pizza' + dishId.toString() + '.svg',
    )
    dishId++

    await fs.writeFile(addresssPath, dish.toString(), (err) => {
      if (err) throw err
    })
  })
})
