from fastapi import FastAPI, Query
import requests
import random
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, date, timezone, timedelta
import pytz
from models import Report, Balance, SessionLocal, Base, engine

# --- Load Environment Variables ---
load_dotenv()

app = FastAPI(title="Vicidial Cost & ASR Dashboard", version="1.0")

# --- CORS Setup ---
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Function ---
def get_balance(db=None):
    """Fetch the current balance from the database."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    try:
        balance = db.query(Balance).first()
        if not balance:
            new_balance = Balance(
                initial_balance=100.0,
                current_balance=100.0,
                last_reset_date=date.today()
            )
            db.add(new_balance)
            db.commit()
            return 100.0
        return round(balance.current_balance, 2)
    finally:
        if close_db:
            db.close()

# --- Database Initialization ---
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        balance_row = db.query(Balance).first()
        if not balance_row:
            new_balance = Balance(
                initial_balance=100.00,
                current_balance=100.00,
                last_reset_date=date.today()
            )
            db.add(new_balance)
            db.commit()
            print("💰 Initialized default balance: $100.00")
        else:
            # ✅ REMOVED: No auto-reset on new day
            # Balance carries forward from previous day
            print(f"💰 Current balance: ${balance_row.current_balance:.2f}")
    finally:
        db.close()


# --- Balance Management Endpoints ---
@app.get("/server-date")
def get_server_date():
    """Get Vicidial server's current date (in server timezone)"""
    vici_now = datetime.now(VICI_TIMEZONE)
    return {
        "server_date": vici_now.strftime("%Y-%m-%d"),
        "server_datetime": vici_now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "timezone": str(VICI_TIMEZONE)
    }


@app.get("/balance")
def get_current_balance():
    """Get the current balance"""
    db = SessionLocal()
    try:
        balance = get_balance(db)
        balance_row = db.query(Balance).first()
        return {
            "current_balance": balance,
            "initial_balance": round(balance_row.initial_balance, 2) if balance_row else 0.0,
            "last_reset_date": str(balance_row.last_reset_date) if balance_row and balance_row.last_reset_date else None
        }
    finally:
        db.close()


@app.post("/balance/add")
def add_balance(amount: float = Query(..., description="Amount to add", gt=0)):
    """Add balance (recharge/top-up)"""
    db = SessionLocal()
    try:
        balance_row = db.query(Balance).first()
        if not balance_row:
            return {"error": "Balance record not found"}
        
        old_current = balance_row.current_balance
        old_initial = balance_row.initial_balance
        
        # ✅ Update BOTH current and initial balance
        new_current = round(old_current + amount, 2)
        new_initial = round(old_initial + amount, 2)
        
        balance_row.current_balance = new_current
        balance_row.initial_balance = new_initial
        db.commit()
        
        print(f"💵 Balance recharged: ${old_current:.2f} + ${amount:.2f} = ${new_current:.2f}")
        print(f"   Initial balance also updated: ${old_initial:.2f} → ${new_initial:.2f}")
        
        return {
            "success": True,
            "message": f"Successfully added ${amount:.2f}",
            "previous_balance": round(old_current, 2),
            "added_amount": round(amount, 2),
            "new_balance": new_current
        }
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding balance: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@app.post("/balance/set")
def set_balance(amount: float = Query(..., description="New balance amount", ge=0)):
    """Set balance to a specific amount"""
    db = SessionLocal()
    try:
        balance_row = db.query(Balance).first()
        if not balance_row:
            return {"error": "Balance record not found"}
        
        old_balance = balance_row.current_balance
        new_balance = round(amount, 2)
        
        balance_row.current_balance = new_balance
        balance_row.initial_balance = new_balance
        db.commit()
        
        print(f"💵 Balance set: ${old_balance:.2f} → ${new_balance:.2f}")
        
        return {
            "success": True,
            "message": f"Balance set to ${new_balance:.2f}",
            "previous_balance": round(old_balance, 2),
            "new_balance": new_balance
        }
    except Exception as e:
        db.rollback()
        print(f"❌ Error setting balance: {e}")
        return {"error": str(e)}
    finally:
        db.close()
    print("✅ Database initialized successfully")

# --- Vicidial Config ---
VICI_URL = os.getenv("VICI_URL", "http://74.50.85.175/vicidial/non_agent_api.php")
VICI_USER = os.getenv("VICI_USER", "6666")
VICI_PASS = os.getenv("VICI_PASS", "Dialer2025")

# ✅ Vicidial server timezone (adjust based on your server location)
# Common US timezones: 'America/New_York', 'America/Chicago', 'America/Los_Angeles'
VICI_TIMEZONE = pytz.timezone(os.getenv("VICI_TIMEZONE", "America/New_York"))  # Change if needed

CONNECTED_DISPOS = [
    "A", "AA", "AB", "ADAIR", "B", "CNAV", "DC", "DNC", "DROP", "DeadC",
    "HU", "INCALL", "N", "NE", "NI", "PDROP", "SALE", "WNB"
]

# --- Main API Endpoint ---
@app.get("/report")
def get_vici_report(
    campaign: str = Query("0006", description="Campaign ID"),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)")
):
    db = SessionLocal()
    try:
        # ✅ Use Vicidial server's current date (not local server time)
        vici_now = datetime.now(VICI_TIMEZONE)
        today = vici_now.strftime("%Y-%m-%d")
        is_today = start_date == end_date == today
        
        # ✅ Check if querying recent data (based on Vicidial server time)
        query_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        today_date = vici_now.date()
        days_old = (today_date - query_date).days
        
        # Handle future dates
        if days_old < 0:
            print(f"⚠️  Query date {start_date} is in the future (Vicidial server date: {today_date})")
            return {
                "error": f"Cannot query future date. Vicidial server date is {today_date}",
                "vicidial_server_date": str(today_date),
                "query_date": start_date,
                "balance": get_balance(db)
            }
        
        # Only use cache for data older than 1 day (on Vicidial server)
        should_use_cache = days_old > 1
        
        print(f"🕐 Vicidial server time: {vici_now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        print(f"📅 Query date: {start_date}, Days old: {days_old}, Use cache: {should_use_cache}")

        # --- 1️⃣ Use cached report for old data only ---
        if should_use_cache:
            existing = (
                db.query(Report)
                .filter(
                    Report.campaign == campaign,
                    Report.start_date == datetime.strptime(start_date, "%Y-%m-%d").date(),
                    Report.end_date == datetime.strptime(end_date, "%Y-%m-%d").date(),
                )
                .first()
            )
            if existing:
                print(f"📦 Using cached report (ID: {existing.id})")
                return {
                    "campaign": existing.campaign,
                    "date_range": {
                        "start": str(existing.start_date),
                        "end": str(existing.end_date),
                    },
                    "total_calls": existing.total_calls,
                    "connected_calls": existing.connected_calls,
                    "ASR_percent": existing.asr_percent,
                    "ACD_seconds": existing.acd_seconds,
                    "billing": {"total_cost_inr": existing.total_cost_inr},
                    "dispositions": existing.dispositions,
                    "balance": get_balance(db),
                    "source": "database",
                }

        # --- 2️⃣ Fetch live Vicidial data ---
        print("⚡ Fetching live Vicidial data...")
        total_calls, connected_calls, dispo_dict = 0, 0, {}

        params_total = {
            "source": "test",
            "user": VICI_USER,
            "pass": VICI_PASS,
            "function": "call_dispo_report",
            "campaigns": campaign,
            "query_date": start_date,
            "end_date": end_date,
        }

        res_total = requests.get(VICI_URL, params=params_total, timeout=20)
        res_total.raise_for_status()
        lines = res_total.text.strip().splitlines()
        for line in lines:
            if line.startswith("TOTAL"):
                parts = line.split(",")
                if len(parts) >= 2 and parts[1].isdigit():
                    total_calls = int(parts[1])
                    break

        if total_calls == 0:
            return {"error": "No total calls found for the given date range."}

        # --- 3️⃣ Dispositions ---
        params_dispo = {
            "source": "test",
            "user": VICI_USER,
            "pass": VICI_PASS,
            "function": "call_status_stats",
            "campaigns": campaign,
            "query_date": start_date,
            "end_date": end_date,
        }

        res_dispo = requests.get(VICI_URL, params=params_dispo, timeout=20)
        res_dispo.raise_for_status()
        raw_text = res_dispo.text.strip()

        if "|" in raw_text:
            parts = raw_text.split("|")
            if len(parts) >= 5:
                dispo_part = parts[4]
                pairs = dispo_part.split(",")
                for pair in pairs:
                    if "-" in pair:
                        code, count = pair.split("-", 1)
                        code, count = code.strip(), count.strip()
                        if count.isdigit():
                            dispo_dict[code] = int(count)
                            if code in CONNECTED_DISPOS:
                                connected_calls += int(count)

        # --- 4️⃣ Compute Metrics ---
        asr = round((connected_calls / total_calls) * 100, 2) if total_calls > 0 else 0
        rate_per_call = 0.00145
        total_cost = round(total_calls * rate_per_call, 2)
        acd = round(random.uniform(0.14, 0.28), 2)
        
        print(f"📊 Metrics - Total calls: {total_calls}, Cost: ${total_cost}, ASR: {asr}%")

        # --- 5️⃣ Update Balance if Today ---
        balance_row = db.query(Balance).first()
        
        if is_today and balance_row:
            # ✅ Use Vicidial server's date for comparisons
            today_date = vici_now.date()
            
            # If it's a new day, set initial_balance to yesterday's current_balance
            if balance_row.last_reset_date and balance_row.last_reset_date != today_date:
                balance_row.initial_balance = balance_row.current_balance
                balance_row.last_reset_date = today_date
                db.commit()
                print(f"🔄 New day detected. Starting balance: ${balance_row.initial_balance:.2f}")
            
            # If last_reset_date is None (first run), set it to today
            if balance_row.last_reset_date is None:
                balance_row.initial_balance = balance_row.current_balance
                balance_row.last_reset_date = today_date
                db.commit()
                print(f"🔄 First run today. Starting balance: ${balance_row.initial_balance:.2f}")
            
            # ✅ Calculate balance from TODAY'S initial balance - total cost
            new_balance = max(0, balance_row.initial_balance - total_cost)
            balance_row.current_balance = new_balance
            db.commit()
            print(f"💰 Live balance updated: ${new_balance:.2f} (Initial: ${balance_row.initial_balance:.2f}, Cost: ${total_cost})")
        
        # ✅ ALWAYS show current balance from database (consistent across all tabs)
        updated_balance = get_balance(db)

        # --- 6️⃣ Save to DB if Not Recent ---
        if should_use_cache:
            # Only save reports for dates older than 1 day
            report = Report(
                campaign=campaign,
                start_date=datetime.strptime(start_date, "%Y-%m-%d").date(),
                end_date=datetime.strptime(end_date, "%Y-%m-%d").date(),
                total_calls=total_calls,
                connected_calls=connected_calls,
                asr_percent=asr,
                acd_seconds=acd,
                total_cost_inr=total_cost,
                dispositions=dispo_dict,
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            print(f"✅ New report saved (ID: {report.id})")

        # --- 7️⃣ Return Final Response ---
        return {
            "campaign": campaign,
            "date_range": {"start": start_date, "end": end_date},
            "total_calls": total_calls,
            "connected_calls": connected_calls,
            "ASR_percent": asr,
            "ACD_seconds": acd,
            "billing": {"total_cost_inr": total_cost},
            "dispositions": dispo_dict,
            "balance": updated_balance,
            "source": "live" if not should_use_cache else "database",
        }

    except Exception as e:
        db.rollback()
        print(f"❌ Error in /report: {e}")
        return {"error": str(e)}
    finally:
        db.close()