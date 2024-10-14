import random
import datetime

def generate_cc():
    # Generate a random 16-digit Visa card number
    # Visa card numbers start with '4' and can have varied second digits
    card_number = ['4']  # Start with '4'
    
    # Generate the next 15 digits (the rest of the card number)
    for i in range(15):
        card_number.append(str(random.randint(0, 9)))
    
    return ''.join(card_number)

def verify_cc(card_number):
    """Verifies a credit card number using the Luhn algorithm
    Args:
        card_number: The credit card number to verify.
    Returns:
        True if the card number is valid, False Otherwise."""

    total =0
    for i, digit in enumerate(reversed(card_number)): 

        digit = int(digit)
        if i%2 ==1:
            digit *=2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0

def generate_expiration_date():
    # Generate an expiration date between 1 month from now and 5 years from now
    current_date = datetime.date.today()
    months_to_add = random.randint(1, 60)  # 1 month to 5 years
    expiration_date = current_date.replace(day=1) + datetime.timedelta(days=months_to_add*31)
    return expiration_date.strftime('%m/%y')

def generate_cvv():
    # Generate a random 3-digit CVV number
    cvv = str(random.randint(100, 999))
    return cvv

def main():
    verified_ccs = []
    total_cards = 1000000
    print(f"Generating {total_cards} valid Visa card numbers...")
    
    for i in range(total_cards):
        card_number = generate_cc()
        if verify_cc(card_number):
            expiration_date = generate_expiration_date()
            cvv = generate_cvv()
            verified_ccs.append(f"{card_number}|{expiration_date[:2]}|{expiration_date[3:]}|{cvv}")
            print(f"Generated card number: {card_number} | Exp: {expiration_date[:2]}/{expiration_date[3:]} | CVV: {cvv}")
        else:
            print(f"Generated invalid card number: {card_number}. Skipping...")
        
        if (i + 1) % 1000 == 0:
            print(f"Progress: {i + 1} / {total_cards} cards generated")
    
    print("Writing generated card numbers to cards.txt...")
    with open('cards.txt', 'w') as f:
        for cc in verified_ccs:
            f.write(cc + '\n')
    
    print("Card numbers written to cards.txt successfully.")

if __name__ == '__main__':
    main()
