from decimal import Decimal, ROUND_HALF_EVEN
from typing import Dict, Any

# Tier configuration using Decimal constants
MIN_FEE_THRESHOLD = Decimal("10.0000")  # Free below $10
BASE_DOMESTIC_FEE = Decimal("1.0000")
PERCENT_DOMESTIC = Decimal("0.0050")   # 0.5%
BASE_CROSS_BORDER_FEE = Decimal("3.5000")
PERCENT_CROSS_BORDER = Decimal("0.0150") # 1.5%
BASE_INSTANT_FEE = Decimal("1.5000")
PERCENT_INSTANT = Decimal("0.0100")    # 1.0%
MAX_FEE_CAP = Decimal("25.0000")       # Capped at $25
FOUR_PLACES = Decimal("0.0001")
TWO_PLACES = Decimal("0.01")

def calculate_transfer_fee(amount: Decimal, transfer_type: str = "DOMESTIC", is_vip: bool = False) -> Dict[str, Any]:
    """
    Calculates tiered transfer fee using exact Decimal arithmetic.
    Applies banker's rounding (ROUND_HALF_EVEN) to eliminate bias.
    """
    if amount <= Decimal("0"):
        raise ValueError("Transaction amount must be strictly positive.")

    # Free micro-transfers or VIP exemption
    if amount < MIN_FEE_THRESHOLD or is_vip:
        fee = Decimal("0.0000")
        return {
            "gross_amount": amount.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
            "fee_amount": fee,
            "net_amount": amount.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
            "tier": "ZERO_FEE" if amount < MIN_FEE_THRESHOLD else "VIP_WAIVER",
            "breakdown": {
                "base_fee": Decimal("0.0000"),
                "variable_fee": Decimal("0.0000"),
                "capped_applied": False
            }
        }

    transfer_type = transfer_type.upper()
    if transfer_type == "CROSS_BORDER":
        base_fee = BASE_CROSS_BORDER_FEE
        variable_fee = amount * PERCENT_CROSS_BORDER
    elif transfer_type == "INSTANT":
        base_fee = BASE_INSTANT_FEE
        variable_fee = amount * PERCENT_INSTANT
    else:  # DOMESTIC
        base_fee = BASE_DOMESTIC_FEE
        variable_fee = amount * PERCENT_DOMESTIC

    raw_fee = base_fee + variable_fee
    capped_applied = False
    if raw_fee > MAX_FEE_CAP:
        fee = MAX_FEE_CAP
        capped_applied = True
    else:
        fee = raw_fee

    # Exact rounding to 4 decimal places
    quantized_fee = fee.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
    gross_quantized = amount.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
    net_amount = (gross_quantized - quantized_fee).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

    return {
        "gross_amount": gross_quantized,
        "fee_amount": quantized_fee,
        "net_amount": net_amount,
        "tier": f"STANDARD_{transfer_type}",
        "breakdown": {
            "base_fee": base_fee.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
            "variable_fee": variable_fee.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
            "capped_applied": capped_applied
        }
    }

