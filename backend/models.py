from sqlalchemy import create_engine, Column, Integer, String, Float, Date, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reports.db")
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    campaign = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    total_calls = Column(Integer)
    connected_calls = Column(Integer)
    asr_percent = Column(Float)
    acd_seconds = Column(Float)
    total_cost_inr = Column(Float)
    dispositions = Column(JSON)

class Balance(Base):
    __tablename__ = "balances"
    id = Column(Integer, primary_key=True, index=True)
    initial_balance = Column(Float, default=100.0)  # ✅ Starting balance for the day
    current_balance = Column(Float, default=100.0)  # ✅ Current balance after deductions
    last_reset_date = Column(Date, nullable=True)   # ✅ Track when balance was last reset

