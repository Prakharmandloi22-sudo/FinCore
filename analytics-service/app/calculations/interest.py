from decimal import Decimal, ROUND_HALF_EVEN
from typing import Dict, Any, List

FOUR_PLACES = Decimal("0.0001")
TWO_PLACES = Decimal("0.01")
EIGHT_PLACES = Decimal("0.00000001")

def calculate_daily_compound_interest(
    principal: Decimal,
    annual_rate_percentage: Decimal,
    days: int,
    compounding_frequency: int = 365
) -> Dict[str, Any]:
    """
    Computes exact daily compound interest for wallet balances.
    Formula: A = P * (1 + r/n)^(n*t)
    All intermediate terms computed with Decimal precision to prevent penny drift.
    """
    if principal <= Decimal("0"):
        raise ValueError("Principal must be greater than zero.")
    if annual_rate_percentage < Decimal("0"):
        raise ValueError("Annual interest rate cannot be negative.")
    if days <= 0:
        raise ValueError("Days must be positive integer.")

    # Convert percentage to nominal decimal rate: e.g. 5.0% -> 0.05
    nominal_rate = annual_rate_percentage / Decimal("100")
    daily_rate = nominal_rate / Decimal(str(compounding_frequency))

    current_balance = principal
    daily_log: List[Dict[str, Any]] = []

    for day in range(1, days + 1):
        day_interest = current_balance * daily_rate
        current_balance += day_interest
        if day <= 5 or day == days:  # Sample preview points
            daily_log.append({
                "day": day,
                "accrued_today": day_interest.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
                "cumulative_balance": current_balance.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
            })

    total_accrued = current_balance - principal
    
    # Effective Annual Yield (APY) = (1 + r/n)^n - 1
    apy = ((Decimal("1") + daily_rate) ** compounding_frequency) - Decimal("1")
    apy_percentage = (apy * Decimal("100")).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

    return {
        "principal": principal.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "nominal_rate": nominal_rate.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "days": days,
        "accrued_interest": total_accrued.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "final_balance": current_balance.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "effective_annual_yield": apy_percentage,
        "daily_breakdown_preview": daily_log
    }
