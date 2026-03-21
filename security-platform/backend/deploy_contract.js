const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');
require('dotenv').config();

// ── Configuration ──
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const CONTRACT_PATH = path.join(__dirname, 'contracts', 'AuditLogStore.sol');

async function deploy() {
    console.log('🚀 Starting deployment to Sepolia...');

    // 1. Read Contract Source
    const source = fs.readFileSync(CONTRACT_PATH, 'utf8');

    // 2. Compile with solc
    const input = {
        language: 'Solidity',
        sources: {
            'AuditLogStore.sol': { content: source }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode']
                }
            }
        }
    };

    console.log('📦 Compiling contract...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
        output.errors.forEach(err => console.error(err.formattedMessage));
        if (output.errors.some(err => err.severity === 'error')) process.exit(1);
    }

    const contractData = output.contracts['AuditLogStore.sol']['AuditLogStore'];
    const abi = contractData.abi;
    const bytecode = contractData.evm.bytecode.object;

    // 3. Setup Ethers
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    if (!PRIVATE_KEY) {
        throw new Error('WALLET_PRIVATE_KEY is missing from .env');
    }
    
    const cleanKey = PRIVATE_KEY.trim();
    // Aggressively clean: keep only 0x and hex characters
    const hexPart = cleanKey.replace(/^0x/i, '');
    const finalKey = '0x' + hexPart.replace(/[^0-9a-fA-F]/g, '');
    
    console.log(`🔑 Private Key Info: original_length=${cleanKey.length}, final_length=${finalKey.length}`);
    
    const wallet = new ethers.Wallet(finalKey, provider);
    
    console.log(`🔗 Connected to Sepolia as ${wallet.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`);

    // 4. Deploy
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    console.log('📤 Sending deployment transaction...');
    const contract = await factory.deploy();
    
    // Wait for deployment
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`✅ Contract deployed successfully!`);
    console.log(`📍 Address: ${address}`);

    // 5. Update .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${address}`);
    } else {
        envContent += `\nCONTRACT_ADDRESS=${address}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('📝 Updated .env with CONTRACT_ADDRESS');

    return address;
}

deploy().catch(err => {
    console.error('❌ Deployment failed:', err);
    process.exit(1);
});
