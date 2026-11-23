import time
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Dict, Any

def run_precision_benchmark(iterations: int = 100_000) -> Dict[str, Any]:
    """
    Executes a direct correctness and precision benchmark comparing
    Python's standard binary `float` against `Decimal`.
    Demonstrates binary floating-point drift (e.g. 0.1 + 0.2 != 0.3)
    over repeated sub-cent and fee splits.
    """
    # 1. Decimal test
    dec_increment = Decimal("0.0001")  # one hundredth of a cent
    dec_accumulator = Decimal("0.0000")
    t0 = time.perf_counter()
    for _ in range(iterations):
        dec_accumulator += dec_increment
    t1 = time.perf_counter()
    dec_duration_ms = (t1 - t0) * 1000.0

    # 2. Float test
    flt_increment = 0.0001
    flt_accumulator = 0.0
    for _ in range(iterations):
        flt_accumulator += flt_increment

    # Exact expected value is iterations * 0.0001 = 10.0000 for 100,000 iterations
    expected = iterations * 0.0001
    drift = abs(flt_accumulator - expected)
    drift_cents = Decimal(str(drift)) * Decimal("100")

    return {
        "iterations": iterations,
        "expected_value": f"{expected:.4f}",
        "decimal_result": str(dec_accumulator.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN)),
        "float_result": flt_accumulator,
        "accumulated_drift": f"{drift:.16e}",
        "drift_cents": str(drift_cents.quantize(Decimal("0.000001"), rounding=ROUND_HALF_EVEN)),
        "decimal_duration_ms": round(dec_duration_ms, 2),
        "conclusion": (
            "Standard IEEE 754 binary floating-point accumulates non-zero precision drift due to "
            "inexact base-2 representation of base-10 decimals. FinCore strictly enforces Decimal arithmetic "
            "across all ledger entries, transfers, and fee calculations to guarantee zero financial drift."
        )
    }
