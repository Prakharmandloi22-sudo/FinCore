from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import (
    FeeCalculationRequest, FeeCalculationResponse,
    InterestCalculationRequest, InterestCalculationResponse,
    StatementVerificationRequest, StatementVerificationResponse,
    RiskAssessmentRequest, RiskAssessmentResponse,
    ReconciliationRequest, ReconciliationResponse,
    BenchmarkResult
)
from app.calculations.fees import calculate_transfer_fee
from app.calculations.interest import calculate_daily_compound_interest
from app.calculations.statement import verify_statement_balance
from app.calculations.benchmark import run_precision_benchmark
from app.risk.engine import evaluate_risk, generate_synthetic_operations_report
from app.reconciliation.engine import perform_reconciliation

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Precision financial calculation engine (Decimal arithmetic) and real-time transaction risk analytics service."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "precision_engine": "python-decimal",
        "rounding_mode": settings.ROUNDING_MODE
    }

# --- Financial Calculations Endpoints ---

@app.post("/api/v1/calculate/fee", response_model=FeeCalculationResponse, tags=["Calculations"])
def calculate_fee_endpoint(payload: FeeCalculationRequest):
    try:
        res = calculate_transfer_fee(payload.amount, payload.transfer_type, payload.is_vip)
        return FeeCalculationResponse(
            gross_amount=res["gross_amount"],
            fee_amount=res["fee_amount"],
            net_amount=res["net_amount"],
            currency=payload.currency,
            fee_breakdown=res["breakdown"],
            rounding_mode=settings.ROUNDING_MODE
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

@app.post("/api/v1/calculate/interest", response_model=InterestCalculationResponse, tags=["Calculations"])
def calculate_interest_endpoint(payload: InterestCalculationRequest):
    try:
        res = calculate_daily_compound_interest(
            payload.principal,
            payload.annual_rate_percentage,
            payload.days,
            payload.compounding_frequency_per_year
        )
        return InterestCalculationResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

@app.post("/api/v1/calculate/statement-verify", response_model=StatementVerificationResponse, tags=["Calculations"])
def verify_statement_endpoint(payload: StatementVerificationRequest):
    try:
        res = verify_statement_balance(
            payload.account_id,
            payload.opening_balance,
            payload.closing_balance,
            payload.entries
        )
        return StatementVerificationResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

@app.get("/api/v1/calculate/benchmark", response_model=BenchmarkResult, tags=["Calculations"])
def run_benchmark_endpoint(iterations: int = 100_000):
    if iterations <= 0 or iterations > 1_000_000:
        raise HTTPException(status_code=400, detail="Iterations must be between 1 and 1,000,000")
    res = run_precision_benchmark(iterations)
    return BenchmarkResult(**res)

# --- Risk Analytics Endpoints ---

@app.post("/api/v1/risk/evaluate", response_model=RiskAssessmentResponse, tags=["Risk"])
def evaluate_risk_endpoint(payload: RiskAssessmentRequest):
    res = evaluate_risk(payload)
    return RiskAssessmentResponse(**res)

@app.get("/api/v1/risk/operations-report", tags=["Risk"])
def get_operations_report():
    return generate_synthetic_operations_report()

# --- Reconciliation Endpoints ---

@app.post("/api/v1/reconciliation/run", response_model=ReconciliationResponse, tags=["Reconciliation"])
def run_reconciliation_endpoint(payload: ReconciliationRequest):
    res = perform_reconciliation(payload)
    return ReconciliationResponse(**res)

