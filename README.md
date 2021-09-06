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
