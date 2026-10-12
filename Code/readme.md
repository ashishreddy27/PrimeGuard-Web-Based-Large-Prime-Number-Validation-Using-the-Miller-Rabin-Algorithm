# PrimeGuard — Primality Intelligence

A responsive browser-based Miller–Rabin primality testing project. No backend or external JavaScript libraries are required.

## Features
- Large integer input using JavaScript `BigInt`
- Configurable Miller–Rabin rounds (`k`, 1–50)
- Random or repeatable fixed-base demonstration mode
- Real modular exponentiation and Miller–Rabin witness checks
- Prime / composite report, runtime, confidence estimate and error bound
- Live stage counter, progress bar and process log
- CSV, TXT, and JSON dataset upload
- Dataset column selection, batch processing and CSV result export
- Responsive layout for laptop and mobile
- Runs locally in your browser

## Run the project
**Option 1 — easiest:** double-click `index.html` and open it in Chrome, Edge, or Firefox.

**Option 2 — recommended in VS Code:**
1. Extract `PrimeGuard.zip`.
2. Open the extracted `PrimeGuard` folder in VS Code.
3. Install the **Live Server** extension by Ritwick Dey.
4. Right-click `index.html` → **Open with Live Server**.
5. The site opens in your browser. No `npm install` is needed.

## Dataset format
CSV example:
```csv
number,label
2,prime
4,composite
97,prime
1000000007,large candidate
```
The algorithm uses the selected number column only. `label` is optional and is not used to decide the result. A plain text file may contain one integer per line. JSON may be an array of numbers, such as `[2, 3, 97]`, or an array of objects such as `[{"number":"97"},{"number":"561"}]`.

Use **decimal integer strings**, not decimal fractions, scientific notation, or values already rounded by a spreadsheet. For very large numbers, keep the column as text in Excel/Google Sheets to avoid precision loss.

## What Kaggle dataset should I use?
PrimeGuard needs a dataset containing integer candidates, not a particular file type or a huge training dataset. On Kaggle, search for:
- **prime numbers dataset**
- **primality test dataset**
- **prime and composite numbers CSV**
- **number theory integer dataset**

Download the CSV and make sure it has one column with integer values. If the dataset has columns such as `number` and `is_prime`, choose `number` in PrimeGuard. The `is_prime` label is useful only for comparing the algorithm's output afterward; PrimeGuard does not train a machine-learning model.

For the most reliable project demo, start with the included `sample_numbers.csv`. Kaggle dataset titles and availability change, so check the file preview and licence before downloading. Avoid datasets where numbers are stored only in scientific notation or where very large integers have been rounded.

## Important interpretation notes
- Miller–Rabin is probabilistic for general large integers. Passing `k` independent uniformly random rounds gives a false-prime probability bound of at most `4^-k` for an odd composite input.
- `1 - 4^-k` is a conventional confidence estimate **conditional on the number being composite and on independent random bases**. It is not a universal Bayesian probability that any input is prime.
- If a witness proves compositeness, the app reports composite with certainty; its error bound is effectively zero for that test.
- The included fixed-base mode is for repeatable demonstrations, not a universal deterministic proof for arbitrary-size integers. Random-base mode is the appropriate default for the probabilistic bound.
- Browser `Math.random()` is used to choose bases in this educational implementation; do not use this as a cryptographic key-generation system. Production cryptographic systems should use a vetted cryptographic library and a cryptographically secure random source.
- Very large values and high round counts can take longer. The trace illustrates the major computation stages and logs round calculations; the synchronous BigInt calculation itself executes on the browser's JavaScript thread.

## Suggested presentation/demo
1. Test `97` with `k = 8` — probable prime.
2. Test `561` — composite (a Carmichael number).
3. Test `1000000007` — large probable prime.
4. Upload `sample_numbers.csv`, choose `number`, and run the batch.
5. Export the results CSV and explain the witness/error-bound panel.

## Project structure
- `index.html` — layout and content
- `styles.css` — responsive visual design
- `app.js` — BigInt Miller–Rabin algorithm, trace, dataset parsing and exports
- `sample_numbers.csv` — ready-to-use demo dataset
