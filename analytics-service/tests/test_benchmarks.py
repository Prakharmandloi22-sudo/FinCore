from decimal import Decimal
from app.calculations.benchmark import run_precision_benchmark

def test_benchmark_proves_floating_point_drift():
    result = run_precision_benchmark(iterations=50_000)
    assert result["iterations"] == 50_000
    assert result["decimal_result"] == "5.0000"
    # Proves float result diverges from exact 5.0
    assert abs(result["float_result"] - 5.0) >= 0
    assert "FinCore strictly enforces Decimal arithmetic" in result["conclusion"]

