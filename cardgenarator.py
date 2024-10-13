import random
import datetime

def generate_cc():
    # Generate a random 16-digit Visa card number
    card_number = ['4']  # Visa cards start with '4'
    
    # Generate the next 15 digits (the rest of the card number)
    for i in range(15):
        card_number.append(str(random.randint(0, 9)))
    
    return ''.join(card_number)

def verify_cc(card_number):
    # Verify the card number using the Luhn algorithm
    total_sum = 0
    for i, digit in enumerate(reversed(card_number)):
        n = int(digit)
        if i % 2 == 1:  # Double every second digit from the right
            n *= 2
            if n > 9:
                n -= 9
        total_sum += n
    return total_sum % 10 == 0

def generate_expiration_date():
    # Generate an expiration date between 1 month from now and 5 years from now
    current_date = datetime.date.today()
    months_to_add = random.randint(1, 60)  # 1 month to 5 years
    expiration_date = current_date.replace(day=1) + datetime.timedelta(days=months_to_add*31)
    return expiration_date.strftime('%m/%y')

def generate_cvv():
    # Generate a random 3-digit CVV number
    return str(random.randint(100, 999))

def main():
    total_cards = 10000000  # 1 billion cards
    chunk_size = 1000000  # Write to the file in chunks to avoid memory overflow
    file_name = 'cards.txt'
    
    print(f"Generating {total_cards} valid Visa card numbers...")

    with open(file_name, 'w') as f:
        for i in range(total_cards):
            card_number = generate_cc()
            if verify_cc(card_number):
                expiration_date = generate_expiration_date()
                cvv = generate_cvv()
                f.write(f"{card_number}|{expiration_date[:2]}|{expiration_date[3:]}|{cvv}\n")
            else:
                print(f"Generated invalid card number: {card_number}. Skipping...")

            # Log progress
            if (i + 1) % 100000 == 0:
                print(f"Progress: {i + 1} / {total_cards} cards generated")

    print(f"Card numbers written to {file_name} successfully.")

if __name__ == '__main__':
    main()
