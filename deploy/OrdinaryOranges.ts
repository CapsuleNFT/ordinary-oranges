import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'
import { LedgerSigner } from '@anders-t/ethers-ledger'
import ICapsule from '../artifacts/contracts/interfaces/ICapsule.sol/ICapsule.json'

const OrdinaryOranges = 'OrdinaryOranges'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute, deploy } = deployments
  
  const { deployer } = await getNamedAccounts()

  const capsuleCollectionAddress = "0x1b41F57D52FE6dB3a63bceB4E8845c0F9F31f859"

  const OOContract = await deploy(OrdinaryOranges, {
    from: deployer,
    log: true,
    args: [capsuleCollectionAddress]
  })

  console.log("Deployment done!")
  
  const provider = new ethers.providers.JsonRpcProvider(process.env.NODE_URL)
  const signer = new LedgerSigner(provider)
  const capsuleCollectionContract = new ethers.Contract(capsuleCollectionAddress, ICapsule.abi, provider)

  //await capsuleCollectionContract.connect(signer).transferOwnership(OOContract.address)

  //await capsuleCollectionContract.connect(signer).updateTokenURIOwner(OOContract.address)

  await execute(OrdinaryOranges, { from: deployer, log: true }, "claimCollectionBurnerRole");
}
export default func
func.tags = [OrdinaryOranges]
