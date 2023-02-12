import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const OrdinaryOranges = 'OrdinaryOranges'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy(OrdinaryOranges, {
    from: deployer,
    log: true,
    args: [],
    value: ethers.utils.parseEther('0.025'),
  })

  // deploy
  // force burn through contract
}
export default func
func.tags = [OrdinaryOranges]
