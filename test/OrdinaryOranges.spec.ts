import { ethers } from 'hardhat'
import { expect } from 'chai'
import { OrdinaryOranges, ICapsule } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Address } from './utils'

describe('Ordinary Oranges tests', async function () {
  const baseURI = 'http://localhost/'
  const deployerAddress = '0xB58992cfA9B39A2FFA0dd286248503A2eFbc65Db'
  const capsuleCollectionAddress = '0x1b41F57D52FE6dB3a63bceB4E8845c0F9F31f859'
  let OrdinaryOranges: OrdinaryOranges, capsuleMinter
  let capsule
  let oldCollectionOwner: SignerWithAddress, governor: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress

  let capsuleCollectionTax, mintFee, governorMintFee, maxUsdcAmount

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[governor, user1, user2] = await ethers.getSigners()

    oldCollectionOwner = await ethers.getImpersonatedSigner(deployerAddress)
    
    // Note setting owner address here so that later we don't have to call connect for owner
    const factory = await ethers.getContractFactory('OrdinaryOranges', governor)
    OrdinaryOranges = (await factory.deploy(capsuleCollectionAddress)) as OrdinaryOranges

    const OOCapsuleCollection = await ethers.getContractAt('ICapsule', capsuleCollectionAddress)
    await OOCapsuleCollection.connect(oldCollectionOwner).transferOwnership(OrdinaryOranges.address)
    await OOCapsuleCollection.connect(oldCollectionOwner).updateTokenURIOwner(OrdinaryOranges.address)
  })

  beforeEach(async function () {
    const collection = await OrdinaryOranges.capsuleCollection()
    expect(collection).to.properAddress
    capsule = await ethers.getContractAt('ICapsule', collection)

    capsuleMinter = await ethers.getContractAt('ICapsuleMinter', await OrdinaryOranges.CAPSULE_MINTER())
    governorMintFee = await ethers.utils.parseEther('0.001')
    mintFee = await ethers.utils.parseEther('1')

    // set baseURI
    await OrdinaryOranges.connect(governor).updateBaseURI(baseURI)
  })

  context('Verify deployment', function () {
    it('Should verify OO deployed correctly', async function () {
      // Given OO is deployed and collection is created
      expect(await OrdinaryOranges.isMintEnabled(), 'Minting should be disabled').to.false
    })
  })

  describe('Mint status', function () {
    it('Should revert if non governor toggle mint status', async function () {
      // When mint status is toggled by non governor user
      const tx = OrdinaryOranges.connect(user2).toggleMint()
      // Then revert with
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should toggle mint status', async function () {
      // Given OO is deployed
      expect(await OrdinaryOranges.isMintEnabled(), 'mint should be disabled').to.false
      // When mint status is toggled
      const tx = OrdinaryOranges.toggleMint()
      await expect(tx).to.emit(OrdinaryOranges, 'MintToggled').withArgs(true)
      // Then minting should be enabled
      expect(await OrdinaryOranges.isMintEnabled(), 'mint should be enabled').to.true
      // When mint status is toggled again
      await OrdinaryOranges.toggleMint()
      // Then minting should be disabled
      expect(await OrdinaryOranges.isMintEnabled(), 'mint should be disabled').to.false
    })
  })

  context('Mint OO', function () {
    it('Should revert if minting is not allowed', async function () {
      // Then mint should revert with mint-is-not-enabled
      await expect(OrdinaryOranges.mint()).to.revertedWith('mint-is-not-enabled')
    })

    it('Should revert when mint tax is not sent', async function () {
      await OrdinaryOranges.toggleMint()
      // When minting OO without sending mint tax
      const tx = OrdinaryOranges.connect(user1).mint()
      // Then revert with 'wrong-mint-fee-paid'
      await expect(tx).to.revertedWith('wrong-mint-fee-paid')
    })

    it('Should fail governorMint if not governor', async function () {
      // When governor minting OO
      const tx = OrdinaryOranges.connect(user1).governorMint({ value: governorMintFee })
      // Then revert with 'not-governor'
      await expect(tx).to.revertedWith('not-governor')
    })

    it('Should governorMint OO', async function () {
      // When governor minting OO
      const tx = OrdinaryOranges.connect(governor).governorMint({ value: governorMintFee })
      // Then verify event is emitted with proper args
      await expect(tx).to.emit(OrdinaryOranges, 'OrdinaryOrangeMinted').withArgs(governor.address)
    })

    it('Should mint OO', async function () {
      // When minting OO
      const tx = OrdinaryOranges.connect(user1).mint({ value: mintFee })
      // Then verify event is emitted with proper args
      await expect(tx).to.emit(OrdinaryOranges, 'OrdinaryOrangeMinted').withArgs(user1.address)
    })

    it('Should verify data after OO minting', async function () {
      const id = (await capsule.counter()).toString()
      // When minting OO
      await OrdinaryOranges.connect(user1).mint({ value: mintFee })
      const uri = `${baseURI}${id}`
      // Then verify tokenURI is correct
      expect(await capsule.tokenURI(id), 'tokenURI is incorrect').to.eq(uri)
    })
  })

  context('Burn OO', function () {
    let id
    beforeEach(async function () {
      id = await capsule.counter()
      await OrdinaryOranges.connect(user2).mint({ value: mintFee })
    })

    it('should burn OO', async function () {
      await capsule.connect(user2).approve(OrdinaryOranges.address, id)
      // Then verify user2 OO balance is 1
      expect(await capsule.balanceOf(user2.address), 'incorrect balance').to.eq(1)
      // Then verify user2 is owner of OO
      expect(await capsule.ownerOf(id), '!owner').to.eq(user2.address)
      // When user2 burns OO
      const tx = OrdinaryOranges.connect(user2).burn(id, 'bitcoin-address')
      // Then verify event is emitted with proper args
      await expect(tx).to.emit(OrdinaryOranges, 'OrdinaryOrangeBurnt').withArgs(user2.address, id, 'bitcoin-address')
      // Then verify user2 OO balance is zero
      expect(await capsule.balanceOf(user2.address), 'incorrect balance').to.eq(0)
    })
  })

  context('Transfer collection ownership', function () {
    it('Should revert if non governor user call transfer ownership', async function () {
      const tx = OrdinaryOranges.connect(user1).transferCollectionOwnership(user2.address)
      await expect(tx).to.revertedWith('not governor')
    })

    it('Should transfer collection ownership of OO collection', async function () {
      expect(await capsule.owner()).to.eq(OrdinaryOranges.address)
      await OrdinaryOranges.transferCollectionOwnership(user1.address)
      expect(await capsule.owner()).to.eq(user1.address)
    })
  })

  context('Update baseURI', function () {
    it('Should revert if non governor user call updateBaseURI', async function () {
      const tx = OrdinaryOranges.connect(user1).updateBaseURI('https://google.com')
      await expect(tx).revertedWith('not governor')
    })

    it('Should update baseURI of OO collection', async function () {
      const newBaseURI = 'https://www.google.com'
      expect(await capsule.baseURI()).eq(baseURI)
      await OrdinaryOranges.updateBaseURI(newBaseURI)
      expect(await capsule.baseURI()).eq(newBaseURI)
    })
  })
})
