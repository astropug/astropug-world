import * as path from "path";
import BN from "bn.js";
import chalk from "chalk";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { LCDClient, LocalTerra, MnemonicKey, MsgExecuteContract } from "@terra-money/terra.js";
import {
  toEncodedBinary,
  sendTransaction,
  storeCode,
  instantiateContract,
  queryNativeTokenBalance,
  queryTokenBalance,
} from "./helpers";

chai.use(chaiAsPromised);
const { expect } = chai;

//----------------------------------------------------------------------------------------
// Variables
//----------------------------------------------------------------------------------------

const terra = new LCDClient({
  URL: 'https://bombay-lcd.terra.dev',
  chainID: 'bombay-12',
});

console.log("Start");
console.log(process.env.ASTROPUG_MNEMONIC_KEY);

// create a key out of a mnemonic
const mk = new MnemonicKey({
  mnemonic: process.env.ASTROPUG_MNEMONIC_KEY,
});

// a wallet can be created out of any key
// wallets abstract transaction building
const wallet = terra.wallet(mk);


let obj: any = {};
const deployer = wallet; //terra.wallets.test1;
const user1 = obj; //terra.wallets.test2;
const user2 = obj; //terra.wallets.test3;

const tokenArtifactPath = "../artifacts/cw20_base.wasm";
const stakingArtifactPath = "../artifacts/cw20_staking.wasm";

let mirrorToken: string;
let terraswapPair: string;
let terraswapLpToken: string;

//----------------------------------------------------------------------------------------
// Setup
//----------------------------------------------------------------------------------------

async function setupTest() {
  // // Step 0. Upload Staking Token code
  // process.stdout.write("Staking code...");

  // const stakeCodeId = await storeCode(
  //   terra,
  //   deployer,
  //   path.resolve(__dirname, stakingArtifactPath)
  // );

  const ScodeId=29256
  const stakeCodeId = ScodeId

  console.log(chalk.green("Done!"), `${chalk.blue("codeId")}=${stakeCodeId}`);

  // Step 2. Instantiate Staking Token contract
  process.stdout.write("Instantiating Staking Token contract... ");

  const stakingResult = await instantiateContract(terra, deployer, deployer, stakeCodeId, {
    name: "AstroPugStakeTest",
    symbol: "APUGST",
    decimals: 6,
    validator: deployer.key.accAddress,
    unbonding_period: 2592000,
    exit_tax: 0.05,
    min_withdrawal: 1000000000000
  });

  console.log(stakingResult);
  const stakeToken = stakingResult.logs[0].events[0].attributes[3].value;

  console.log(chalk.green("Done!"), `${chalk.blue("contractAddress")}=${stakeToken}`);

  // Step 1. Upload TerraSwap Token code
  process.stdout.write("Uploading TerraSwap Token code... ");

  const cw20CodeId = await storeCode(
    terra,
    deployer,
    path.resolve(__dirname, tokenArtifactPath)
  );

  console.log(chalk.green("Done!"), `${chalk.blue("codeId")}=${cw20CodeId}`);

  // Step 2. Instantiate TerraSwap Token contract
  process.stdout.write("Instantiating TerraSwap Token contract... ");

  const tokenResult = await instantiateContract(terra, deployer, deployer, cw20CodeId, {
    name: "AstroPugTest",
    symbol: "APUGT",
    decimals: 6,
    initial_balances: [
      { address: deployer.key.accAddress, amount: "50000000000000000" }
    ],
    mint: {
      minter: stakeToken,
      cap: "100000000000000000"
    }
  });

  mirrorToken = tokenResult.logs[0].events[0].attributes[3].value;

  console.log(chalk.green("Done!"), `${chalk.blue("contractAddress")}=${mirrorToken}`);

  // Step 3. Upload TerraSwap Pair code
  process.stdout.write("Uploading TerraSwap pair code... ");

  const codeId = await storeCode(
    terra,
    deployer,
    path.resolve(__dirname, "../artifacts/terraswap_pair.wasm")
  );

  console.log(chalk.green("Done!"), `${chalk.blue("codeId")}=${codeId}`);

  // Step 4. Instantiate TerraSwap Pair contract
  process.stdout.write("Instantiating TerraSwap pair contract... ");

  /*{
    "asset_infos": [{
    "token": {
      "contract_addr": "terra12sxpgy9l5qcyeyxguks6u7rurn3hen9vy6k5vr"
    }
  },
    {
      "native_token": {
        "denom": "uusd"
      }
    }
  ],
      "token_code_id": 28689
  }*/

  /*let a = {
    asset_infos: [{
    token: {
      contract_addr: mirrorToken
    }
  },
    {
      native_token: {
        denom: "uusd"
      }
    }
  ],
      token_code_id: cw20CodeId
  };*/

  const pairResult = await instantiateContract(terra, deployer, deployer, codeId, {
    asset_infos: [{
      token: {
        contract_addr: mirrorToken
      }
    },
    {
      native_token: {
        denom: "uusd"
      }
    }
    ],
    token_code_id: 154
  });

  process.stdout.write("POST.. ");

  const event = pairResult.logs[0].events.find((event) => {
    return event.type == "instantiate_contract";
  });

  terraswapPair = event?.attributes[3].value as string;
  terraswapLpToken = event?.attributes[7].value as string;

  console.log(
    chalk.green("Done!"),
    `${chalk.blue("terraswapPair")}=${terraswapPair}`,
    `${chalk.blue("terraswapLpToken")}=${terraswapLpToken}`
  );

  // Step 5. Mint tokens for use in testing
  process.stdout.write("Fund user 1 with MIR... ");

  /*await sendTransaction(terra, deployer, [
    new MsgExecuteContract(deployer.key.accAddress, mirrorToken, {
      mint: {
        recipient: user1.key.accAddress,
        amount: "10000000000",
      },
    }),
  ]);

  console.log(chalk.green("Done!"));*/
  console.log(chalk.yellow("Skipping!!!!!!!!"));

  process.stdout.write("Fund user 2 with MIR... ");

  /*await sendTransaction(terra, deployer, [
    new MsgExecuteContract(deployer.key.accAddress, mirrorToken, {
      mint: {
        recipient: user2.key.accAddress,
        amount: "10000000000",
      },
    }),
  ]);

  console.log(chalk.green("Done!"));*/
  console.log(chalk.yellow("Skipping!!!!!!!!"));
}

//----------------------------------------------------------------------------------------
// Test 1. Provide Initial Liquidity
//
// User 1 provides 69 MIR + 420 UST
// User 1 should receive sqrt(69000000 * 420000000) = 170235131 uLP
//
// Result
// ---
// pool uMIR  69000000
// pool uusd  420000000
// user uLP   170235131
//----------------------------------------------------------------------------------------

async function testProvideLiquidity() {
  process.stdout.write("Should provide liquidity... ");

  await sendTransaction(terra, user1, [
    new MsgExecuteContract(user1.key.accAddress, mirrorToken, {
      increase_allowance: {
        amount: "100000000",
        spender: terraswapPair,
      },
    }),
    new MsgExecuteContract(
      user1.key.accAddress,
      terraswapPair,
      {
        provide_liquidity: {
          assets: [
            {
              info: {
                token: {
                  contract_addr: mirrorToken,
                },
              },
              amount: "69000000",
            },
            {
              info: {
                native_token: {
                  denom: "uusd",
                },
              },
              amount: "420000000",
            },
          ],
        },
      },
      {
        uusd: "420000000",
      }
    ),
  ]);

  const poolUMir = await queryTokenBalance(terra, terraswapPair, mirrorToken);
  expect(poolUMir).to.equal("69000000");

  const poolUUsd = await queryNativeTokenBalance(terra, terraswapPair, "uusd");
  expect(poolUUsd).to.equal("420000000");

  const userULp = await queryTokenBalance(terra, user1.key.accAddress, terraswapLpToken);
  expect(userULp).to.equal("170235131");

  console.log(chalk.green("Passed!"));
}

//----------------------------------------------------------------------------------------
// Test 2. Swap
//
// User 2 sells 1 MIR for UST
//
// k = poolUMir * poolUUsd
// = 69000000 * 420000000 = 28980000000000000
// returnAmount = poolUusd - k / (poolUMir + offerUMir)
// = 420000000 - 28980000000000000 / (69000000 + 1000000)
// = 6000000
// fee = returnAmount * feeRate
// = 6000000 * 0.003
// = 18000
// returnAmountAfterFee = returnUstAmount - fee
// = 6000000 - 18000
// = 5982000
// returnAmountAfterFeeAndTax = deductTax(5982000) = 5976023
// transaction cost for pool = addTax(5976023) = 5981999
//
// Result
// ---
// pool uMIR  69000000 + 1000000 = 70000000
// pool uusd  420000000 - 5981999 = 414018001
// user uLP   170235131
// user uMIR  10000000000 - 1000000 = 9999000000
// user uusd  balanceBeforeSwap + 5976023 - 4500000 (gas)
//----------------------------------------------------------------------------------------

async function testSwap() {
  process.stdout.write("Should swap... ");

  const userUusdBefore = await queryNativeTokenBalance(
    terra,
    user2.key.accAddress,
    "uusd"
  );

  await sendTransaction(terra, user2, [
    new MsgExecuteContract(user2.key.accAddress, mirrorToken, {
      send: {
        amount: "1000000",
        contract: terraswapPair,
        msg: toEncodedBinary({
          swap: {},
        }),
      },
    }),
  ]);

  const poolUMir = await queryTokenBalance(terra, terraswapPair, mirrorToken);
  expect(poolUMir).to.equal("70000000");

  const poolUUsd = await queryNativeTokenBalance(terra, terraswapPair, "uusd");
  expect(poolUUsd).to.equal("414018001");

  const userULp = await queryTokenBalance(terra, user1.key.accAddress, terraswapLpToken);
  expect(userULp).to.equal("170235131");

  const userUMir = await queryTokenBalance(terra, user2.key.accAddress, mirrorToken);
  expect(userUMir).to.equal("9999000000");

  const userUusdExpected = new BN(userUusdBefore)
    .add(new BN("5976023"))
    .sub(new BN("4500000"))
    .toString();

  const userUUsd = await queryNativeTokenBalance(terra, user2.key.accAddress, "uusd");
  expect(userUUsd).to.equal(userUusdExpected);

  console.log(chalk.green("Passed!"));
}

//----------------------------------------------------------------------------------------
// Test 3. Slippage tolerance
//
// User 2 tries to swap a large amount of MIR (say 50 MIR, while the pool only has 70) to
// UST with a low max spread. The transaction should fail
//----------------------------------------------------------------------------------------

async function testSlippage() {
  process.stdout.write("Should check max spread... ");

  await expect(
    sendTransaction(terra, user2, [
      new MsgExecuteContract(user2.key.accAddress, mirrorToken, {
        send: {
          amount: "50000000",
          contract: terraswapPair,
          msg: toEncodedBinary({
            swap: {
              max_spread: "0.01",
            },
          }),
        },
      }),
    ])
  ).to.be.rejectedWith("Max spread assertion");

  console.log(chalk.green("Passed!"));
}

//----------------------------------------------------------------------------------------
// Main
//----------------------------------------------------------------------------------------

(async () => {
  console.log(chalk.yellow("\nStep 1. Info"));

  console.log(`Use ${chalk.cyan(deployer.key.accAddress)} as deployer`);
  /*console.log(`Use ${chalk.cyan(user1.accAddress)} as user 1`);
  console.log(`Use ${chalk.cyan(user2.accAddress)} as user 2`);*/

  console.log(chalk.yellow("\nStep 2. Setup"));

  await setupTest();

  console.log(chalk.yellow("\nStep 3. Tests"));

  await testProvideLiquidity();
  await testSwap();
  await testSlippage();

  console.log("");
})();
