from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# --- Financial Calculation Schemas ---

class FeeCalculationRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Gross transaction amount")
    currency: str = Field(default="USD", max_length=3)
    transfer_type: str = Field(default="DOMESTIC", description="DOMESTIC, CROSS_BORDER, or INSTANT")
    is_vip: bool = Field(default=False)

class FeeCalculationResponse(BaseModel):
    gross_amount: Decimal
    fee_amount: Decimal
    net_amount: Decimal
    currency: str
    fee_breakdown: Dict[str, Any]
    rounding_mode: str

class InterestCalculationRequest(BaseModel):
    principal: Decimal = Field(..., gt=0)
    annual_rate_percentage: Decimal = Field(..., ge=0, description="Annual rate in percent (e.g. 4.5 for 4.5%)")
    days: int = Field(..., gt=0, le=366)
    compounding_frequency_per_year: int = Field(default=365, gt=0)

class InterestCalculationResponse(BaseModel):
    principal: Decimal
    nominal_rate: Decimal
    days: int
    accrued_interest: Decimal
    final_balance: Decimal
    effective_annual_yield: Decimal
    daily_breakdown_preview: List[Dict[str, Any]]

class StatementEntry(BaseModel):
    entry_id: str
    timestamp: str
    type: str  # CREDIT or DEBIT
    amount: Decimal = Field(..., gt=0)
    description: str

class StatementVerificationRequest(BaseModel):
    account_id: str
    currency: str
    opening_balance: Decimal
    closing_balance: Decimal
    entries: List[StatementEntry]

class StatementVerificationResponse(BaseModel):
    account_id: str
    is_balanced: bool
    opening_balance: Decimal
    closing_balance: Decimal
    total_debits: Decimal
    total_credits: Decimal
    calculated_closing_balance: Decimal
    discrepancy: Decimal
    audit_passed: bool
    notes: List[str]

# --- Risk Analytics Schemas ---

class HistoricalTransaction(BaseModel):
    id: str
    amount: Decimal
    timestamp: str
    destination_account: str
    status: str

class RiskAssessmentRequest(BaseModel):
    user_id: str
    wallet_id: str
    amount: Decimal = Field(..., gt=0)
    currency: str = "USD"
    destination_account: str
    is_new_beneficiary: bool = False
    beneficiary_created_minutes_ago: Optional[int] = None
    recent_transactions: List[HistoricalTransaction] = []
    failed_attempts_last_hour: int = 0
    ip_country: Optional[str] = "US"
    user_registered_days_ago: int = 30

class RiskTrigger(BaseModel):
    code: str
    description: str
    weight: int

class RiskAssessmentResponse(BaseModel):
    user_id: str
    risk_score: int = Field(..., ge=0, le=100)
    risk_tier: str  # LOW, MEDIUM, HIGH, CRITICAL
    recommendation: str  # APPROVE, REQUIRE_MFA, MANUAL_REVIEW, REJECT_AND_FREEZE
    triggers: List[RiskTrigger]
    metrics: Dict[str, Any]
    decision_support_disclaimer: str = (
        "Risk scores are decision support only, not proof of fraud. "
        "High-risk transactions must be investigated by an operations analyst."
    )

# --- Reconciliation Schemas ---

class InternalLedgerRecord(BaseModel):
    reference_id: str
    amount: Decimal
    status: str
    created_at: str

class ExternalProviderRecord(BaseModel):
    provider_event_id: str
    reference_id: str
    amount: Decimal
    fee: Decimal
    net: Decimal
    status: str

class ReconciliationRequest(BaseModel):
    batch_id: str
    currency: str
    internal_records: List[InternalLedgerRecord]
    provider_records: List[ExternalProviderRecord]

class ReconciliationItem(BaseModel):
    reference_id: str
    status: str  # MATCHED, VARIANCE, MISSING_IN_PROVIDER, MISSING_IN_LEDGER
    internal_amount: Optional[Decimal] = None
    provider_amount: Optional[Decimal] = None
    variance: Decimal = Decimal("0.0000")
    details: str

class ReconciliationResponse(BaseModel):
    batch_id: str
    total_internal_records: int
    total_provider_records: int
    matched_count: int
    discrepancy_count: int
    total_internal_volume: Decimal
    total_provider_volume: Decimal
    net_variance: Decimal
    reconciled_status: str  # RECONCILED or VARIANCE_FLAGGED
    items: List[ReconciliationItem]

# --- Benchmark Schema ---

class BenchmarkResult(BaseModel):
    iterations: int
    decimal_sum: str
    float_sum: float
    accumulated_drift: str
    drift_cents: str
    decimal_duration_ms: float
    conclusion: str

