import fs from 'fs';
import readline from 'readline';
import { Wallet } from 'ethers';
import axios from 'axios';
import { banner } from './banner.js';
import chalk from 'chalk';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Read proxies from proxy.txt
const proxies = fs.existsSync('proxy.txt') ? fs.readFileSync('proxy.txt', 'utf8').split('\n').map(p => p.trim()).filter(p => p) : [];

console.log (banner);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question (chalk.green(" 👀 👀 How many accounts do you want to create? "), async (num) => {
  num = parseInt(num);
  if (isNaN(num) || num <= 0) {
    console.log (chalk.red(" 🥲 🥲 Invalid number. Exiting..."));
    rl.close();
    return;
  }

  for (let i = 0; i < num; i++) {
    console.log(chalk.blue(`Creating account ${i + 1}...`));
    
    // Select a random proxy
    let proxy = null;
    if (proxies.length > 0) {
      const randomIndex = Math.floor(Math.random() * proxies.length);
      proxy = proxies[randomIndex];
      console.log(chalk.green(` 💫 Using Proxy: ${proxy}`));
    } else {
      console.log(chalk.red(" 👽 No proxy found. Using direct connection."));
    }

    await createAccount(proxy);

    // Add 3 seconds delay
    if (i < num - 1) {
    
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  rl.close();
});

async function createAccount(proxy) {
  try {
    const wallet = Wallet.createRandom();
    fs.appendFileSync('privatekey.txt', `${wallet.privateKey}\n`, 'utf8');
    fs.appendFileSync('address.txt', `${wallet.address}\n`, 'utf8');
    console.log (chalk.blue (" ✅  Generated Wallet Address:", wallet.address));

    const nonce = `timestamp_${Date.now()}`;


    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    };

    // Apply proxy if available
    if (proxy) {
      const isSocks = proxy.startsWith("socks");
      const agent = isSocks ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy);
      axiosConfig.httpsAgent = agent;
    }

    // Request auth ticket
    const authTicketResponse = await axios.post(
      'https://api-kiteai.bonusblock.io/api/auth/get-auth-ticket',
      { nonce },
      axiosConfig
    );


    const rawMessage = authTicketResponse.data.payload;
    const signedMessage = await wallet.signMessage(rawMessage);
    

    // Authenticate with eth
    const authEthResponse = await axios.post(
      'https://api-kiteai.bonusblock.io/api/auth/eth',
      {
        blockchainName: "ethereum",
        signedMessage,
        nonce,
        referralId: "optionalReferral"
      },
      axiosConfig
    );

    
    const authToken = authEthResponse.data.payload?.session?.token;
    if (!authToken) throw new Error("Authentication failed: No token received.");

    // Complete onboarding
    const onboardingResponse = await axios.get(
      'https://api-kiteai.bonusblock.io/api/kite-ai/complete-onboarding',
      { headers: { 'x-auth-token': authToken, 'Accept': 'application/json' } }
    );

    console.log (chalk.blue(" 🪁🪁🪁 Onboarding Response:", JSON.stringify(onboardingResponse.data, null, 2)));

    // Complete social task
    const socialTaskResponse = await axios.post(
      'https://api-kiteai.bonusblock.io/api/forward-link/go/kiteai-mission-social-3',
      {},
      { headers: { 'x-auth-token': authToken, 'Accept': 'application/json' } }
    );



  } catch (error) {
    console.error(chalk.red("Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message));
  }
          }
