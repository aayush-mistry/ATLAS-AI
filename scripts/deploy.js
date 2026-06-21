import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying Escrow contract using direct Ethers.js...");

  const artifactPath = path.resolve("artifacts/contracts/Escrow.sol/Escrow.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Artifact not found. Please run: npx hardhat compile");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Connect to the provider
  const rpcUrl = process.env.POLYGON_AMOY_RPC || "http://127.0.0.1:8545";
  console.log(`Connecting to RPC: ${rpcUrl}`);
  
  let address = "0xD3C07974beC39a17e36Ba4A6b4d238FF944BacB4"; // Mock fallback address
  let deployedReal = false;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    
    // Test connection with a short timeout
    await Promise.race([
      provider.getNetwork(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
    ]);

    // Use private key or default hardhat local account #0
    const privateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Deploying with wallet address: ${wallet.address}`);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log("Sending deploy transaction...");
    const contract = await factory.deploy();

    console.log("Waiting for deployment to complete...");
    await contract.waitForDeployment();
    address = await contract.getAddress();
    deployedReal = true;
    console.log(`Escrow contract successfully deployed to: ${address}`);
  } catch (err) {
    console.warn("⚠️ Network connection or deployment failed. Writing mock contract address for local simulation.");
    console.warn(`Details: ${err.message}`);
  }

  // Save the address and ABI to src/contracts for frontend use
  const addressesDir = path.resolve("src/contracts");
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(addressesDir, "addresses.json"),
    JSON.stringify({ Escrow: address, deployedReal }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(addressesDir, "Escrow.json"),
    JSON.stringify(artifact.abi, null, 2)
  );

  console.log("ABI and deployment address written to src/contracts/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
