from sqlalchemy import create_engine, Column, Integer, String, Float, Date, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reports.db")
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    reports = relationship("Report", back_populates="user")
    balances = relationship("Balance", back_populates="user")
    payment_history = relationship("PaymentHistory", back_populates="user")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Add user_id
    campaign = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    total_calls = Column(Integer)
    connected_calls = Column(Integer)
    asr_percent = Column(Float)
    acd_seconds = Column(Float)
    total_cost_inr = Column(Float)
    dispositions = Column(JSON)
    
    user = relationship("User", back_populates="reports")

class Balance(Base):
    __tablename__ = "balances"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Add user_id
    initial_balance = Column(Float, default=100.0)
    current_balance = Column(Float, default=100.0)
    last_reset_date = Column(Date, nullable=True)
    
    user = relationship("User", back_populates="balances")

class PaymentHistory(Base):
    __tablename__ = "payment_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Add user_id
    amount = Column(Float, nullable=False)
    payment_type = Column(String, nullable=False)  # "recharge" or "deduction"
    description = Column(String, nullable=True)
    previous_balance = Column(Float, nullable=False)
    new_balance = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    transaction_id = Column(String, nullable=True)  # Optional: for payment gateway reference
    
    user = relationship("User", back_populates="payment_history")